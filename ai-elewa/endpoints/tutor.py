import logging
from fastapi import APIRouter
from models.requests import TutorChatRequest
from models.responses import TutorChatResponse
from models.errors import AIServiceError, ErrorResponse, ERROR_SCHEMA_INVALID
from utils.error_handler import error_json_response
from utils.learner_messages import attach_learner_message
from ai_client import complete
import config

logger = logging.getLogger(__name__)
router = APIRouter()


def _profile_label(request: TutorChatRequest) -> str:
    profiles = request.learner_context.cognitive_profiles
    return profiles[0] if len(profiles) == 1 else f"{profiles[0]}+{profiles[1]}"


def _build_system_prompt(profile: str, language_level: int, action: str | None) -> str:
    base = f"""You are Elekeza Tutor — an educational assistant for learners with cognitive disabilities.
You help learners understand their lessons in a supportive, patient, and encouraging way.

LEARNER PROFILE: {profile}
LANGUAGE LEVEL: {language_level} (1=basic, 2=intermediate, 3=advanced)

RULES:
- dyslexia: short sentences (max 12 words), active voice, simple vocabulary, no walls of text.
- adhd: direct and energetic, get to the point fast, use numbered steps where helpful.
- autism: literal and factual, no idioms, no ambiguity, state exactly what you mean.
- intellectual_disability: max 8 words per sentence, very simple vocabulary, warm and patient tone.
- For comorbid profiles: apply the strictest rules from each profile.
- Never diagnose, prescribe, or make high-stakes decisions about the learner.
- Never claim to be a human teacher.
- If you do not know something, say so clearly — do not guess or hallucinate facts.
- Keep replies short unless the learner asks for more detail.
- Always respond in English unless translating to Kiswahili is explicitly requested."""

    action_instructions = {
        "explain": "\nYour task: Explain the concept in the lesson clearly and simply.",
        "practice": "\nYour task: Give the learner one short practice question related to the lesson.",
        "read_aloud": "\nYour task: Read the lesson content aloud in a clear, simple way.",
        "translate": "\nYour task: Translate the lesson content or the learner's question into Kiswahili. Keep it simple.",
        "diagram": "\nYour task: Describe a simple visual diagram that would help the learner understand the concept. Use clear, step-by-step descriptions.",
        "summarise": "\nYour task: Give a brief 2-3 sentence summary of the lesson.",
    }

    if action and action in action_instructions:
        base += action_instructions[action]

    return base


def _build_messages_payload(request: TutorChatRequest) -> list[dict]:
    messages = []

    if request.lesson_context:
        messages.append({
            "role": "user",
            "content": f"Here is the lesson I am studying:\n\n{request.lesson_context}",
        })
        messages.append({
            "role": "assistant",
            "content": "I have read your lesson. I am ready to help you.",
        })

    for msg in request.messages:
        messages.append({"role": msg.role, "content": msg.content})

    return messages


@router.post("/ai/tutor/chat", response_model=TutorChatResponse)
async def tutor_chat(request: TutorChatRequest):
    try:
        profile = _profile_label(request)
        system_prompt = _build_system_prompt(
            profile=profile,
            language_level=request.learner_context.language_level,
            action=request.current_action,
        )

        messages = _build_messages_payload(request)
        last_user_message = messages[-1]["content"] if messages else ""

        reply = await complete(
            system_prompt=system_prompt,
            user_prompt=last_user_message,
            model=config.STAGE3_MODEL,
            temperature=0.4,
            stage="tutor_chat",
            profile=profile,
        )

        reply = reply.strip()

        if not reply:
            return TutorChatResponse(
                reply="I am sorry, I could not generate a response. Please try again.",
                action_handled=request.current_action,
                fallback=True,
            )

        return TutorChatResponse(
            reply=reply,
            action_handled=request.current_action,
            fallback=False,
        )

    except AIServiceError as e:
        attach_learner_message(e.error_response, request.learner_context.cognitive_profiles)
        return error_json_response(e.error_response)

    except Exception as e:
        logger.error(f"Unhandled error in /ai/tutor/chat: {e}", exc_info=True)
        return error_json_response(attach_learner_message(ErrorResponse(
            error_code=ERROR_SCHEMA_INVALID,
            message="An unexpected error occurred in the tutor.",
            stage="tutor_chat",
        ), request.learner_context.cognitive_profiles))