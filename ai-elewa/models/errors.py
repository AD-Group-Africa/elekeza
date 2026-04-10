from pydantic import BaseModel
from typing import Optional


# ---------------------------------------------------------------------------
# Error code constants
# Used throughout the service — never use raw strings for error codes.
# ---------------------------------------------------------------------------

ERROR_TIMEOUT         = "TIMEOUT"
ERROR_RATE_LIMIT      = "RATE_LIMIT"
ERROR_SCHEMA_INVALID  = "SCHEMA_INVALID"
ERROR_EMPTY_CONTENT   = "EMPTY_CONTENT"
ERROR_OVERSIZED       = "OVERSIZED"
ERROR_NON_ENGLISH     = "NON_ENGLISH"
ERROR_OCR_FAILED      = "OCR_FAILED"
ERROR_UNAUTHORISED    = "UNAUTHORISED"


# ---------------------------------------------------------------------------
# Error response schema
# ---------------------------------------------------------------------------

class ErrorResponse(BaseModel):
    error_code: str
    message: str
    stage: Optional[str] = None
    retried: bool = False
    learner_message: Optional[str] = None


# ---------------------------------------------------------------------------
# Internal exception type
# ---------------------------------------------------------------------------

class AIServiceError(Exception):
    def __init__(self, error_response: ErrorResponse):
        self.error_response = error_response
        super().__init__(error_response.error_code)