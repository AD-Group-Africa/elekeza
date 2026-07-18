from pydantic import BaseModel
from typing import Optional

# ---------------------------------------------------------------------------
# Error code constants — used across the entire service
# ---------------------------------------------------------------------------

ERROR_TIMEOUT         = "TIMEOUT"
ERROR_RATE_LIMIT      = "RATE_LIMIT"
ERROR_SCHEMA_INVALID  = "SCHEMA_INVALID"
ERROR_EMPTY_CONTENT   = "EMPTY_CONTENT"
ERROR_OVERSIZED       = "OVERSIZED"
ERROR_NON_ENGLISH     = "NON_ENGLISH"
ERROR_OCR_FAILED      = "OCR_FAILED"
ERROR_UNAUTHORISED    = "UNAUTHORISED"


class ErrorResponse(BaseModel):
    """
    Structured error returned to Spring Boot on any failure.
    Never expose Python stack traces — always return this shape.
    """
    error_code: str
    message: str
    stage: Optional[str] = None
    retried: bool = False


class AIServiceError(Exception):
    """
    Raised anywhere in the pipeline, caught at the endpoint layer,
    and converted into an ErrorResponse + correct HTTP status code.

    Usage:
        raise AIServiceError(ErrorResponse(
            error_code=ERROR_TIMEOUT,
            message="Model did not respond in time.",
            stage="stage2_simplify",
            retried=True
        ))
    """
    def __init__(self, error_response: ErrorResponse):
        self.error_response = error_response
        super().__init__(error_response.error_code)
