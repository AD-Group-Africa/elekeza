import asyncio
import json
import structlog
import time
from fastapi import APIRouter
from fastapi.responses import JSONResponse
from pydantic import ValidationError

import config
from ai_client import complete
from models.requests import QuizGenerateRequest, AdaptiveResponseRequest, WrongAnswerFlowRequest
from models.responses import (
    QuizResponse, QuizQuestion, QuizOption,
    AdaptiveResponse, WrongAnswerFlowResponse,
)
from models.errors import AIServiceError, ErrorResponse, ERROR_SCHEMA_INVALID
from utils.error_handler import error_json_response as _error_response
from utils.learner_messages import attach_learner_message
from utils.adaptive_rules import (
    get_adaptive_rule,
    validate_directive,
    build_adaptive_context_block,
)
from utils.explanation_strategies import (
    get_strategy,
    build_reexplanation_system_prompt,
    validate_explanation_structure,
)

logger = structlog.get_logger(__name__)
router = APIRouter()


def _profile_label(request) -> str:
    profiles = request.learner_context.cognitive_profiles
    return profiles[0] if len(profiles) == 1 else f"{profiles[0]}+{profiles[1]}"


# ---------------------------------------------------------------------------
# POST /ai/quiz/generate
# ---------------------------------------------------------------------------

QUIZ_SYSTEM_PROMPT = """
You are a quiz generator for learners with cognitive disabilities.
Generate quiz questions based on the provided lesson content.

RULES:
- Each question must test a concept directly stated in the lesson.
- Never test information not present in the lesson.
- Options must be plausible — wrong answers should not be obviously absurd.
- Explanations must be brief and clear (max 2 sentences).
- dyslexia: max 12 words in question, active voice, simple vocabulary.
- adhd: punchy, direct questions — no lengthy preamble.
- autism: literal, factual, no ambiguity.
- intellectual_disability: max 8 words in question, max 5 words per option.

Return ONLY valid JSON. No markdown. No extra text.

{
  "questions": [
    {
      "id": "q1",
      "text": "question text",
      "options": [
        {"id": "a", "text": "option a"},
        {"id": "b", "text": "option b"},
        {"id": "c", "text": "option c"},
        {"id": "d", "text": "option d"}
      ],
      "correct_id": "a",
      "explanation": "brief explanation"
    }
  ]
}
"""


@router.post("/ai/quiz/generate", response_model=QuizResponse)
async def quiz_generate(request: QuizGenerateRequest):
    try:
        profile = _profile_label(request)

        user_prompt = f"""LEARNER PROFILE: {profile}
LANGUAGE LEVEL: {request.learner_context.language_level}
NUMBER OF QUESTIONS: {request.num_questions}

LESSON CONTENT:
{json.dumps(request.lesson_json, indent=2)}

Generate {request.num_questions} quiz question(s) for this lesson.
"""

        raw_response = await complete(
            system_prompt=QUIZ_SYSTEM_PROMPT,
            user_prompt=user_prompt,
            model=config.QUIZ_MODEL,
            temperature=config.TEMPERATURE_QUIZ,
            stage="quiz_generate",
            profile=profile,
        )

        cleaned = raw_response.strip()
        if cleaned.startswith("```"):
            cleaned = "\n".join(cleaned.split("\n")[1:-1]).strip()

        try:
            data = json.loads(cleaned)
        except json.JSONDecodeError as e:
            raise AIServiceError(ErrorResponse(
                error_code=ERROR_SCHEMA_INVALID,
                message=f"Quiz JSON parse error: {str(e)}",
                stage="quiz_generate",
            ))

        questions = []
        for q in data.get("questions", []):
            options = [QuizOption(id=o["id"], text=o["text"]) for o in q.get("options", [])]
            questions.append(QuizQuestion(
                id=q["id"],
                text=q["text"],
                options=options,
                correct_id=q["correct_id"],
                explanation=q["explanation"],
            ))

        return QuizResponse(questions=questions)

    except AIServiceError as e:
        attach_learner_message(e.error_response, request.learner_context.cognitive_profiles)
        return _error_response(e.error_response)

    except Exception as e:
        logger.error(f"Unhandled error in /ai/quiz/generate: {e}", exc_info=True)
        return _error_response(attach_learner_message(ErrorResponse(
            error_code=ERROR_SCHEMA_INVALID,
            message="An unexpected error occurred generating the quiz.",
            stage="quiz_generate",
        ), request.learner_context.cognitive_profiles))


# ---------------------------------------------------------------------------
# POST /ai/quiz/adaptive-response  (Improvement 5 wired in)
# ---------------------------------------------------------------------------

ADAPTIVE_SYSTEM_PROMPT_BASE = """
You are an adaptive learning assistant for learners with cognitive disabilities.
You will receive information about a quiz question, the learner's answer, and
whether it was correct.

Your job is to:
1. Write a short, encouraging learner_message appropriate to the profile.
2. Return a directive that tells the system what to do next.

DIRECTIVE RULES — return exactly one of these four values:
- "easier"  — learner answered wrong and took a long time
- "revisit" — learner answered wrong and was within normal time
- "same"    — learner answered correctly but took a long time
- "harder"  — learner answered correctly and quickly

LEARNER MESSAGE RULES:
- dyslexia: short sentences (max 12 words), positive tone, active voice.
- adhd: punchy, energetic, 1-2 sentences max.
- autism: literal, factual, no emotional language, state what happens next.
- intellectual_disability: max 8 words per sentence, simple vocabulary, warm tone.
- For comorbid: apply stricter vocabulary, more direct structure.

You must respond with ONLY a valid JSON object. No markdown, no extra text.

{
  "learner_message": "string — message shown directly to the learner",
  "directive": "easier" | "same" | "harder" | "revisit"
}
"""


def _build_adaptive_user_prompt(request: AdaptiveResponseRequest) -> str:
    profile = _profile_label(request)
    outcome = "CORRECT" if request.is_correct else "INCORRECT"
    rule = get_adaptive_rule(profile)
    context_block = build_adaptive_context_block(
        profile=profile,
        language_level=request.learner_context.language_level,
        is_correct=request.is_correct,
        latency_ms=request.latency_ms,
        rule=rule,
    )

    return f"""LEARNER PROFILE: {profile}
LANGUAGE LEVEL: {request.learner_context.language_level}

QUESTION: {request.question}
LEARNER'S ANSWER: {request.selected_option}
OUTCOME: {outcome}
RESPONSE TIME: {request.latency_ms}ms

{context_block}

Based on this, return the learner_message and directive JSON object.
"""


def _parse_adaptive_response(raw_response: str) -> dict:
    """Parse adaptive response JSON. Raises AIServiceError on failure."""
    cleaned = raw_response.strip()
    if cleaned.startswith("```"):
        cleaned = "\n".join(cleaned.split("\n")[1:-1]).strip()

    try:
        data = json.loads(cleaned)
    except json.JSONDecodeError as e:
        raise AIServiceError(ErrorResponse(
            error_code=ERROR_SCHEMA_INVALID,
            message=f"Adaptive response JSON parse error: {str(e)}",
            stage="adaptive_response",
        ))

    valid_directives = {"easier", "same", "harder", "revisit"}
    directive = data.get("directive", "")
    if directive not in valid_directives:
        raise AIServiceError(ErrorResponse(
            error_code=ERROR_SCHEMA_INVALID,
            message=(
                f"Invalid directive '{directive}'. "
                f"Must be one of: {', '.join(sorted(valid_directives))}."
            ),
            stage="adaptive_response",
        ))

    return data


@router.post("/ai/quiz/adaptive-response", response_model=AdaptiveResponse)
async def adaptive_response(request: AdaptiveResponseRequest):
    try:
        profile = _profile_label(request)
        rule = get_adaptive_rule(profile)

        wall_start = time.monotonic()

        raw_response = await complete(
            system_prompt=ADAPTIVE_SYSTEM_PROMPT_BASE,
            user_prompt=_build_adaptive_user_prompt(request),
            model=config.ADAPTIVE_MODEL,
            temperature=config.TEMPERATURE_ADAPTIVE,
            stage="adaptive_response",
            profile=profile,
        )

        wall_latency_ms = (time.monotonic() - wall_start) * 1000
        if wall_latency_ms > 800:
            logger.warning(f"Adaptive response exceeded 800ms target: {wall_latency_ms:.0f}ms")

        data = _parse_adaptive_response(raw_response)

        # Improvement 5 — validate directive against profile rules
        validated_directive, directive_reason = validate_directive(
            directive=data["directive"],
            profile=profile,
            rule=rule,
        )

        return AdaptiveResponse(
            learner_message=data["learner_message"],
            directive=validated_directive,
            directive_reason=directive_reason,
        )

    except AIServiceError as e:
        attach_learner_message(e.error_response, request.learner_context.cognitive_profiles)
        return _error_response(e.error_response)

    except Exception as e:
        logger.error(f"Unhandled error in /ai/quiz/adaptive-response: {e}", exc_info=True)
        return _error_response(attach_learner_message(ErrorResponse(
            error_code=ERROR_SCHEMA_INVALID,
            message="An unexpected error occurred in adaptive response.",
            stage="adaptive_response",
        ), request.learner_context.cognitive_profiles))


# ---------------------------------------------------------------------------
# POST /ai/quiz/wrong-answer-flow  (Improvement 6 wired in)
# ---------------------------------------------------------------------------

REATTEMPT_SYSTEM_PROMPT = """
You are a question regeneration assistant for learners with cognitive disabilities.
A learner answered a quiz question incorrectly. Generate a NEW version of the same
question — testing the same concept but using different wording.

RULES:
- The new question must test the same concept as the original.
- Use simpler wording than the original if possible.
- Provide exactly 4 options: a, b, c, d.
- Only one option is correct.
- dyslexia: max 12 words in question, active voice.
- adhd: punchy opening, engaging phrasing.
- autism: literal, unambiguous, factual.
- intellectual_disability: max 8 words in question, max 5 words per option.

Return ONLY a plain string — the question followed by the options, like this:
Question: [question text]
a) [option a]
b) [option b]
c) [option c]
d) [option d]
Answer: [correct letter]

No JSON. No preamble. Just this format.
"""


@router.post("/ai/quiz/wrong-answer-flow", response_model=WrongAnswerFlowResponse)
async def wrong_answer_flow(request: WrongAnswerFlowRequest):
    try:
        profile = _profile_label(request)

        # Improvement 6 — profile-keyed re-explanation strategy
        strategy = get_strategy(profile)
        reexplain_system_prompt = build_reexplanation_system_prompt(profile)

        reexplain_prompt = f"""LEARNER PROFILE: {profile}
LANGUAGE LEVEL: {request.learner_context.language_level}

ORIGINAL QUESTION: {request.question}

LESSON SECTION CONTENT:
{request.section_content}

Re-explain the concept from this section clearly for this learner.
"""

        reattempt_prompt = f"""LEARNER PROFILE: {profile}
LANGUAGE LEVEL: {request.learner_context.language_level}

ORIGINAL QUESTION: {request.question}

LESSON SECTION CONTENT:
{request.section_content}

Generate a new version of this question testing the same concept.
"""

        parallel_start = time.monotonic()

        re_explanation_task = complete(
            system_prompt=reexplain_system_prompt,
            user_prompt=reexplain_prompt,
            model=config.STAGE2_MODEL,
            temperature=config.TEMPERATURE_SIMPLIFY,
            stage="wrong_answer_reexplain",
            profile=profile,
        )

        reattempt_task = complete(
            system_prompt=REATTEMPT_SYSTEM_PROMPT,
            user_prompt=reattempt_prompt,
            model=config.STAGE3_MODEL,
            temperature=config.TEMPERATURE_QUIZ,
            stage="wrong_answer_reattempt",
            profile=profile,
        )

        re_explanation, reattempt_question = await asyncio.gather(
            re_explanation_task,
            reattempt_task,
        )

        parallel_latency_ms = (time.monotonic() - parallel_start) * 1000
        logger.info(
            f"Wrong answer flow completed in {parallel_latency_ms:.0f}ms (parallel)"
        )

        # Improvement 6 — validate structure and attach strategy name
        passes, issues = validate_explanation_structure(
            re_explanation.strip(), strategy
        )
        if not passes:
            logger.warning(
                f"Re-explanation structure issues for {profile}: {issues}"
            )

        return WrongAnswerFlowResponse(
            re_explanation=re_explanation.strip(),
            reattempt_question=reattempt_question.strip(),
            explanation_strategy=strategy.strategy_name,
        )

    except AIServiceError as e:
        attach_learner_message(e.error_response, request.learner_context.cognitive_profiles)
        return _error_response(e.error_response)

    except Exception as e:
        logger.error(f"Unhandled error in /ai/quiz/wrong-answer-flow: {e}", exc_info=True)
        return _error_response(attach_learner_message(ErrorResponse(
            error_code=ERROR_SCHEMA_INVALID,
            message="An unexpected error occurred in wrong answer flow.",
            stage="wrong_answer_flow",
        ), request.learner_context.cognitive_profiles))