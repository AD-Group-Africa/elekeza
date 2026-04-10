from fastapi.responses import JSONResponse
from models.errors import ErrorResponse
from utils.learner_messages import get_learner_message


# ---------------------------------------------------------------------------
# HTTP status mapping
# ---------------------------------------------------------------------------

ERROR_STATUS_MAP = {
    "TIMEOUT":        504,
    "RATE_LIMIT":     429,
    "SCHEMA_INVALID": 422,
    "EMPTY_CONTENT":  422,
    "OVERSIZED":      413,
    "NON_ENGLISH":    422,
    "OCR_FAILED":     422,
    "UNAUTHORISED":   401,
}


# ---------------------------------------------------------------------------
# Public interface
# ---------------------------------------------------------------------------

def error_json_response(
    error: ErrorResponse,
    profiles: list[str] | None = None,
) -> JSONResponse:
    # Inject learner message if not already set
    if error.learner_message is None:
        error.learner_message = get_learner_message(
            error_code=error.error_code,
            profiles=profiles,
        )

    status = ERROR_STATUS_MAP.get(error.error_code, 500)
    return JSONResponse(status_code=status, content=error.model_dump())