from contextlib import asynccontextmanager
import logging
import httpx
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from dotenv import load_dotenv

load_dotenv()

import config  # noqa: F401
from langfuse_client import init_langfuse
from ai_client import init_ai_clients
from security import InternalAuthMiddleware
from endpoints.simplify import router as simplify_router
from endpoints.quiz import router as quiz_router
from models.errors import ErrorResponse

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.http_client = httpx.AsyncClient(timeout=30.0)
    print("✅ HTTP client initialised")
    init_langfuse()
    init_ai_clients()
    yield
    await app.state.http_client.aclose()
    print("✅ HTTP client closed")


app = FastAPI(
    title="Elewa AI Service",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(InternalAuthMiddleware)
app.include_router(simplify_router)
app.include_router(quiz_router)


# ---------------------------------------------------------------------------
# Global exception handlers — final safety net
# No stack trace ever reaches the response under any condition
# ---------------------------------------------------------------------------

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """
    Catches Pydantic validation errors on incoming requests.
    Returns a clean ErrorResponse instead of FastAPI's default 422 detail format.
    """
    errors = exc.errors()
    field_errors = "; ".join(
        f"{' -> '.join(str(loc) for loc in e['loc'])}: {e['msg']}"
        for e in errors
    )
    logger.warning(f"Request validation error on {request.url.path}: {field_errors}")
    error = ErrorResponse(
        error_code="SCHEMA_INVALID",
        message=f"Request validation failed: {field_errors}",
        stage="request_validation",
        retried=False,
    )
    return JSONResponse(status_code=422, content=error.model_dump())


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """
    Catches any unhandled exception anywhere in the app.
    Last line of defence — no stack trace ever reaches the client.
    """
    logger.error(
        f"Unhandled exception on {request.url.path}: {type(exc).__name__}: {exc}",
        exc_info=True,
    )
    error = ErrorResponse(
        error_code="SCHEMA_INVALID",
        message="An unexpected internal error occurred. Please try again.",
        stage="global",
        retried=False,
    )
    return JSONResponse(status_code=500, content=error.model_dump())


@app.get("/health")
async def health():
    return {"status": "ok"}