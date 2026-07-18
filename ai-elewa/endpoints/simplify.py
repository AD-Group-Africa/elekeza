import logging
from fastapi import APIRouter
from fastapi.responses import JSONResponse

from models.requests import SimplifyTextRequest, SimplifyImageRequest
from models.responses import LessonJSON
from models.errors import AIServiceError, ErrorResponse, ERROR_EMPTY_CONTENT, ERROR_OVERSIZED, ERROR_NON_ENGLISH
from utils.error_handler import error_json_response
import config
from pipeline.stage1_profile import build_system_prompt
from pipeline.stage2_simplify import simplify
from pipeline.stage3_verify import verify
from pipeline.stage4_concepts import extract_concepts

logger = logging.getLogger(__name__)
router = APIRouter()


def _validate_text(raw_text: str) -> None:
    if not raw_text or not raw_text.strip():
        raise AIServiceError(ErrorResponse(
            error_code=ERROR_EMPTY_CONTENT,
            message="raw_text is empty or contains only whitespace.",
            stage="validation",
        ))

    word_count = len(raw_text.split())
    if word_count > config.MAX_WORDS:
        raise AIServiceError(ErrorResponse(
            error_code=ERROR_OVERSIZED,
            message=(
                f"Content is {word_count} words, exceeding the 5000-word limit. "
                "Split the content into smaller chunks and send each separately."
            ),
            stage="validation",
        ))

    words = raw_text.split()
    ascii_words = [w for w in words if w.isascii() and w.isalpha()]
    if len(words) > 10 and len(ascii_words) / len(words) < 0.3:
        raise AIServiceError(ErrorResponse(
            error_code=ERROR_NON_ENGLISH,
            message="Content appears to be non-English or contains too many non-text characters.",
            stage="validation",
        ))


async def _run_pipeline(raw_text: str, learner_context) -> LessonJSON:
    """Shared pipeline runner — used by both text and image endpoints."""
    system_prompt = build_system_prompt(learner_context)
    lesson = await simplify(
        system_prompt=system_prompt,
        raw_text=raw_text,
        learner_context=learner_context,
    )
    lesson = await verify(
        lesson_json=lesson,
        raw_text=raw_text,
        learner_context=learner_context,
    )
    lesson = extract_concepts(lesson)
    return lesson


@router.post("/ai/simplify/text", response_model=LessonJSON)
async def simplify_text(request: SimplifyTextRequest):
    try:
        _validate_text(request.raw_text)
        lesson = await _run_pipeline(request.raw_text, request.learner_context)
        return lesson

    except AIServiceError as e:
        return error_json_response(e.error_response)

    except Exception as e:
        logger.error(f"Unhandled error in /ai/simplify/text: {e}", exc_info=True)
        return error_json_response(ErrorResponse(
            error_code="SCHEMA_INVALID",
            message="An unexpected error occurred. Please try again.",
            stage="simplify_text",
        ))


@router.post("/ai/simplify/image", response_model=LessonJSON)
async def simplify_image(request: SimplifyImageRequest):
    try:
        from utils.ocr import extract_text_from_image
        raw_text = await extract_text_from_image(
            base64_image=request.base64_image,
            media_type=request.media_type,
        )
        _validate_text(raw_text)
        lesson = await _run_pipeline(raw_text, request.learner_context)
        return lesson

    except AIServiceError as e:
        return error_json_response(e.error_response)

    except Exception as e:
        logger.error(f"Unhandled error in /ai/simplify/image: {e}", exc_info=True)
        return error_json_response(ErrorResponse(
            error_code="SCHEMA_INVALID",
            message="An unexpected error occurred. Please try again.",
            stage="simplify_image",
        ))

