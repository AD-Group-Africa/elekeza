from contextlib import asynccontextmanager
import logging
import httpx
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from dotenv import load_dotenv

load_dotenv()

import config
from langfuse_client import init_langfuse
from ai_client import init_ai_clients
from security import InternalAuthMiddleware
from endpoints.simplify import router as simplify_router
from endpoints.quiz import router as quiz_router
from endpoints.process import router as process_router
from models.errors import ErrorResponse

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.http_client = httpx.AsyncClient(timeout=30.0)
    init_langfuse()
    init_ai_clients()
    yield
    await app.state.http_client.aclose()


app = FastAPI(
    title="Elewa AI Service",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(InternalAuthMiddleware)
app.include_router(process_router)
app.include_router(simplify_router)
app.include_router(quiz_router)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    errors = exc.errors()
    field_errors = "; ".join(
        f"{' -> '.join(str(loc) for loc in e['loc'])}: {e['msg']}"
        for e in errors
    )
    logger.warning(f"Request validation error on {request.url.path}: {field_errors}")
    return JSONResponse(
        status_code=422,
        content={"error_code": "SCHEMA_INVALID", "message": field_errors},
    )


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled exception on {request.url.path}: {exc}")
    return JSONResponse(
        status_code=500,
        content={"error_code": "INTERNAL", "message": "An unexpected error occurred."},
    )


@app.get("/health")
async def health():
    return {"status": "ok"}

