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
    compute_directive,
)

logger = structlog.get_logger(__name__)
router = APIRouter()


def _profile_label(request) -> str:
    profiles = request.learner_context.cognitive_profiles
    return profiles[0] if len(profiles) == 1 else f"{profiles[0]}+{profiles[1]}"


# ---------------------------------------------------------------------------
# Quiz generate (unchanged from Day 7 — kept here for single-file cohesion)
# ---------------------------------------------------------------------------

QUIZ_SYSTEM_PROMPT = """
You are a quiz generation assistant for learners with cognitive disabilities.
You will be given a simplified lesson and a learner profile.
Your job is to generate multiple choice questions that test understanding of
the lesson content — not memory of exact wording.

QUESTION RULES:
- Questions must be answerable from the lesson content only.
- Questions must use the same simplified language as the lesson — match the
  reading level and vocabulary of the profile.
- Each question must have exactly 4 options: id "a", "b", "c", "d".
- Only one option is correct.
- The explanation must say WHY the correct answer is right, in simple terms.
- Never use trick questions or double negatives.
- Space the questions across different sections of the lesson.

PROFILE-SPECIFIC RULES:
- dyslexia: short question text (max 12 words), simple vocabulary, active voice.
- adhd: engaging question openings, varied question types, keep it punchy.
- autism: literal factual questions only, no ambiguity, no figurative language.
- intellectual_disability: max 8 words per question, only common vocabulary,
  options max 5 words each.
- For comorbid profiles: apply the stricter vocabulary rule and the more
  engaging structure rule where compatible.

You must respond with ONLY a valid JSON object. No markdown fences, no extra text.

{
  "questions": [
    {
      "id": "q1",
      "text": "question text here",
      "options": [
        {"id": "a", "text": "option text"},
        {"id": "b", "text": "option text"},
        {"id": "c", "text": "option text"},
        {"id": "d", "text": "option text"}
      ],
      "correct_id": "b",
      "explanation": "explanation of why b is correct"
    }
  ]
}
"""


def _build_quiz_user_prompt(request: QuizGenerateRequest) -> str:
    lesson_dict = request.lesson_json.copy()
    lesson_dict.pop("stage_flags", None)
    profile = _profile_label(request)
    return f"""LEARNER PROFILE: {profile}
LANGUAGE LEVEL: {request.learner_context.language_level}
NUMBER OF QUESTIONS REQUIRED: {request.num_questions}

LESSON CONTENT:
{json.dumps(lesson_dict, indent=2)}

Generate exactly {request.num_questions} multiple choice questions.
Return ONLY the JSON object.
"""


def _parse_and_validate_quiz(raw_response: str, stage: str) -> QuizResponse:
    cleaned = raw_response.strip()
    if cleaned.startswith("```"):
        cleaned = "\n".join(cleaned.split("\n")[1:-1]).strip()
    try:
        data = json.loads(cleaned)
    except json.JSONDecodeError as e:
        raise AIServiceError(ErrorResponse(
            error_code=ERROR_SCHEMA_INVALID,
            message=f"Model returned invalid JSON: {str(e)}",
            stage=stage,
        ))
    try:
        return QuizResponse(**data)
    except ValidationError as e:
        raise AIServiceError(ErrorResponse(
            error_code=ERROR_SCHEMA_INVALID,
            message=f"Quiz response did not match schema: {str(e)}",
            stage=stage,
        ))


def _validate_quiz_completeness(quiz: QuizResponse, num_questions: int, stage: str) -> None:
    if len(quiz.questions) != num_questions:
        raise AIServiceError(ErrorResponse(
            error_code=ERROR_SCHEMA_INVALID,
            message=f"Model returned {len(quiz.questions)} questions but {num_questions} were requested.",
            stage=stage,
        ))
    for q in quiz.questions:
        option_ids = {opt.id for opt in q.options}
        if len(q.options) != 4:
            raise AIServiceError(ErrorResponse(
                error_code=ERROR_SCHEMA_INVALID,
                message=f"Question '{q.id}' has {len(q.options)} options — exactly 4 required.",
                stage=stage,
            ))
        if q.correct_id not in option_ids:
            raise AIServiceError(ErrorResponse(
                error_code=ERROR_SCHEMA_INVALID,
                message=f"Question '{q.id}' correct_id '{q.correct_id}' not in options {option_ids}.",
                stage=stage,
            ))


@router.post("/ai/quiz/generate", response_model=QuizResponse)
async def quiz_generate(request: QuizGenerateRequest):
    try:
        profile = _profile_label(request)
        raw_response = await complete(
            system_prompt=QUIZ_SYSTEM_PROMPT,
            user_prompt=_build_quiz_user_prompt(request),
            model=config.QUIZ_MODEL,
            temperature=config.TEMPERATURE_QUIZ,
            stage="quiz_generate",
            profile=profile,
        )
        quiz = _parse_and_validate_quiz(raw_response, stage="quiz_generate")
        _validate_quiz_completeness(quiz, request.num_questions, stage="quiz_generate")
        return quiz
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
# POST /ai/quiz/adaptive-response
# ---------------------------------------------------------------------------

ADAPTIVE_SYSTEM_PROMPT_BASE = """
You are an adaptive learning assistant for learners with cognitive disabilities.
You will receive information about a quiz question, the learner's answer,
whether it was correct, and the difficulty decision the system has already
made for the learner's next step.

Your ONLY job is:
1. Write a short, encouraging learner_message appropriate to the profile and
   consistent with the decision provided to you.

The decision (easier / same / harder / revisit) is made by the system. Do not
question it, do not output a different decision, and do not add any field
other than learner_message.

LEARNER MESSAGE RULES:
- dyslexia: short sentences (max 12 words), positive tone, active voice.
- adhd: punchy, energetic, 1-2 sentences max.
- autism: literal, factual, no emotional language, state what happens next.
- intellectual_disability: max 8 words per sentence, simple vocabulary, warm tone.
- For comorbid: apply stricter vocabulary, more direct structure.

You must respond with ONLY a valid JSON object. No markdown, no extra text.

{
  "learner_message": "string ? message shown directly to the learner"
}
"""



def _build_adaptive_user_prompt(request: AdaptiveResponseRequest, directive: str) -> str:
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

The system's decision for the learner's next step is: {directive}

Write the learner_message JSON object for this decision.
"""



def _parse_adaptive_response(raw_response: str) -> dict:
    """Parse and validate the LLM learner-message JSON. Raises AIServiceError on failure."""
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

    message = data.get("learner_message", "")
    if not isinstance(message, str) or not message.strip():
        raise AIServiceError(ErrorResponse(
            error_code=ERROR_SCHEMA_INVALID,
            message="Adaptive response must include a non-empty learner_message string.",
            stage="adaptive_response",
        ))

    return data


@router.post("/ai/quiz/adaptive-response", response_model=AdaptiveResponse)
async def adaptive_response(request: AdaptiveResponseRequest):
    try:
        profile = _profile_label(request)
        rule = get_adaptive_rule(profile)

        # Directive is application-owned and deterministic — computed BEFORE
        # the LLM call, from the same rule machinery that informs the message.
        # The LLM is never authoritative for this field: whatever it returns
        # (or fails to return) cannot change the decision below.
        directive = compute_directive(
            is_correct=request.is_correct,
            latency_ms=request.latency_ms,
            rule=rule,
        )
        _, directive_reason = validate_directive(
            directive=directive,
            profile=profile,
            rule=rule,
        )

        wall_start = time.monotonic()

        raw_response = await complete(
            system_prompt=ADAPTIVE_SYSTEM_PROMPT_BASE,
            user_prompt=_build_adaptive_user_prompt(request, directive),
            model=config.ADAPTIVE_MODEL,
            temperature=config.TEMPERATURE_ADAPTIVE,
            stage="adaptive_response",
            profile=profile,
        )

        wall_latency_ms = (time.monotonic() - wall_start) * 1000
        logger.info(f"Adaptive response wall latency: {wall_latency_ms:.0f}ms")

        if wall_latency_ms > 800:
            logger.warning(f"Adaptive response exceeded 800ms target: {wall_latency_ms:.0f}ms")

        data = _parse_adaptive_response(raw_response)

        return AdaptiveResponse(
            learner_message=data["learner_message"],
            directive=directive,
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
# POST /ai/quiz/wrong-answer-flow
# ---------------------------------------------------------------------------

REEXPLAIN_SYSTEM_PROMPT = """
You are a re-explanation assistant for learners with cognitive disabilities.
A learner answered a quiz question incorrectly. You will be given the question
and the lesson section it came from.

Your job is to re-explain the concept clearly, using profile-appropriate language.

RULES:
- dyslexia: short sentences (max 12 words), simple vocabulary, active voice.
- adhd: hook opening, punchy sentences, 3-4 sentences max.
- autism: literal, factual, structured. State the fact, explain why, give one example.
- intellectual_disability: max 8 words per sentence, 1000 common words, warm tone.

Return ONLY the re-explanation as a plain string. No JSON. No labels. No preamble.
Just the re-explanation text the learner will read.
"""

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
        profiles = request.learner_context.cognitive_profiles
        profile = profiles[0] if len(profiles) == 1 else f"{profiles[0]}+{profiles[1]}"

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

        # Fire both calls concurrently — never sequential
        parallel_start = time.monotonic()

        re_explanation_task = complete(
            system_prompt=REEXPLAIN_SYSTEM_PROMPT,
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

        # asyncio.gather — both fire simultaneously
        re_explanation, reattempt_question = await asyncio.gather(
            re_explanation_task,
            reattempt_task,
        )

        parallel_latency_ms = (time.monotonic() - parallel_start) * 1000
        logger.info(
            f"Wrong answer flow — both calls completed in {parallel_latency_ms:.0f}ms "
            f"(parallel, not sequential)"
        )

        return WrongAnswerFlowResponse(
            re_explanation=re_explanation.strip(),
            reattempt_question=reattempt_question.strip(),
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




