import hmac
import os
from fastapi import Request
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from dotenv import load_dotenv

from models.errors import ErrorResponse, ERROR_UNAUTHORISED

load_dotenv()

INTERNAL_SECRET = os.getenv("INTERNAL_SECRET", "")

# Endpoints that bypass auth entirely
EXEMPT_PATHS = {"/health"}


class InternalAuthMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        # Exempt paths — no auth required
        if request.url.path in EXEMPT_PATHS:
            return await call_next(request)

        incoming_key = request.headers.get("X-Internal-Key", "")

        # Fail-CLOSED: an unconfigured INTERNAL_SECRET must never authenticate
        # anyone. With the previous bare compare_digest("", "") a missing env
        # var made every request without a key valid (verified P0: no-key
        # request reached the pipeline when the secret was unset). When no
        # secret is configured, every authenticated endpoint returns 401.
        key_valid = bool(INTERNAL_SECRET) and hmac.compare_digest(
            incoming_key.encode("utf-8"),
            INTERNAL_SECRET.encode("utf-8")
        )

        if not key_valid:
            error = ErrorResponse(
                error_code=ERROR_UNAUTHORISED,
                message="Missing or invalid X-Internal-Key header.",
                stage=None,
                retried=False
            )
            return JSONResponse(
                status_code=401,
                content=error.model_dump()
            )

        return await call_next(request)

