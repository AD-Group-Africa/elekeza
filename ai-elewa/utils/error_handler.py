from fastapi.responses import JSONResponse
from models.errors import ErrorResponse

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


def error_json_response(error: ErrorResponse) -> JSONResponse:
    """Convert an ErrorResponse into a JSONResponse with the correct HTTP status."""
    status = ERROR_STATUS_MAP.get(error.error_code, 500)
    return JSONResponse(status_code=status, content=error.model_dump())
