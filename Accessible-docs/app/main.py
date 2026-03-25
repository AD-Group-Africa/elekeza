from fastapi import FastAPI
from fastapi.responses import JSONResponse
import logging
from fastapi.middleware.cors import CORSMiddleware

# Import Gemini client and helper from config
from app.config import client, MODEL_NAME, generate_content

# Import routers
from app.routes.simplify import router as simplify_router
from app.routes.terms import router as terms_router
from app.routes.process import router as process_router
from app.routes.qa import router as qa_router
from app.routes.extract import router as extract_router
from app.routes import extract, process, simplify, quiz

# Import vector store initializer
from app.services.rag_service import initialize_vector_store

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="AccessibleDocs AI Service",
    description="AI service for document simplification, term extraction, RAG question answering using Gemini",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  
    allow_credentials=True,
    allow_methods=["*"],  
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup_event():
    try:
        # Initialize vector store
        initialize_vector_store()
        logger.info("Vector store initialized successfully")

        # Optional: Test Gemini model with a quick prompt
        test_prompt = "Hello, Gemini! Are you online?"
        response_text = generate_content(test_prompt)
        if response_text:
            logger.info("Gemini model initialized successfully")
        else:
            logger.warning("Gemini model responded with empty text")

    except Exception as e:
        logger.error(f"Startup failed: {e}")
        raise e


@app.get("/", tags=["Health"])
async def root():
    return JSONResponse(
        content={
            "status": "running",
            "service": "AccessibleDocs AI Service",
            "version": "1.0.0"
        }
    )


@app.get("/health", tags=["Health"])
async def health():
    return JSONResponse(content={"status": "healthy"})


# Include routers
app.include_router(simplify_router)
app.include_router(terms_router)
app.include_router(process_router)
app.include_router(qa_router)
app.include_router(extract_router)
app.include_router(quiz.router)