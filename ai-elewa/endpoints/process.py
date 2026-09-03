import structlog
from fastapi import APIRouter, Request
from models.requests import ProcessRequest
from models.responses import ProcessResponse
from utils.ocr import extract_text_from_file
from pipeline.stage1_profile import build_system_prompt
from pipeline.stage2_simplify import simplify
from pipeline.stage3_verify import verify
from pipeline.stage4_concepts import extract_concepts, measure_readability, standardise_visual_hints
from models.errors import AIServiceError, ErrorResponse, ERROR_EMPTY_CONTENT, ERROR_OVERSIZED, ERROR_NON_ENGLISH
from utils.error_handler import error_json_response
from utils.learner_messages import attach_learner_message
import config

logger = structlog.get_logger(__name__)
router = APIRouter()

@router.post("/process")
async def process_file(request: ProcessRequest):
    """
    Backend compatibility endpoint.
    Accepts file_path and sne_type, extracts text, runs simplification pipeline.
    Returns simplified_text and word_count.
    """
    try:
        # Extract text from file
        raw_text = await extract_text_from_file(request.file_path)

        if not raw_text or not raw_text.strip():
            raise AIServiceError(ErrorResponse(
                error_code=ERROR_EMPTY_CONTENT,
                message="File contains no extractable text.",
                stage="process",
            ))

        # Validate word count
        word_count = len(raw_text.split())
        if word_count > config.MAX_WORDS:
            raise AIServiceError(ErrorResponse(
                error_code=ERROR_OVERSIZED,
                message=f"Content is {word_count} words, exceeding the 5000-word limit.",
                stage="process",
            ))

        # Build learner context with default values (backend doesn't send profile)
        # Use sne_type to infer profile if available; NONE uses the neutral "none"
        # pathway — never silently classified as a supported SNE profile.
        from models.requests import LearnerContext
        learner_context = LearnerContext(
            learner_id="backend-upload",
            cognitive_profiles=[request.sne_type.lower()] if request.sne_type and request.sne_type != "NONE" else ["none"],
            language_level=2,
            content_difficulty=2,
            pathway_stage="Foundation"
        )

        # Run pipeline
        system_prompt = build_system_prompt(learner_context)
        lesson = await simplify(system_prompt, raw_text, learner_context)
        lesson = await verify(lesson, raw_text, learner_context)
        lesson = extract_concepts(lesson)
        lesson = measure_readability(lesson, learner_context)
        lesson = standardise_visual_hints(lesson, learner_context)

        return ProcessResponse(
            simplified_text=lesson.model_dump_json(),
            word_count=word_count
        )

    except AIServiceError as e:
        attach_learner_message(e.error_response, request.learner_context.cognitive_profiles if hasattr(request, "learner_context") else None)
        return error_json_response(e.error_response)
    except Exception as e:
        logger.error(f"Unhandled error in /process: {e}", exc_info=True)
        return error_json_response(attach_learner_message(ErrorResponse(
            error_code="SCHEMA_INVALID",
            message="An unexpected error occurred processing the file.",
            stage="process",
        ), request.learner_context.cognitive_profiles if hasattr(request, "learner_context") else None))



