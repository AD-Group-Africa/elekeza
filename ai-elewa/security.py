import hmac
import os
from fastapi import Request, HTTPException

INTERNAL_SECRET = os.getenv("AI_INTERNAL_SECRET", "").strip()
if not INTERNAL_SECRET or len(INTERNAL_SECRET) < 16:
    raise RuntimeError("AI_INTERNAL_SECRET must be set and at least 16 characters")

async def verify_internal_auth(request: Request):
    incoming = request.headers.get("X-Internal-Key", "")
    if not hmac.compare_digest(incoming, INTERNAL_SECRET):
        raise HTTPException(status_code=403, detail="Forbidden")
