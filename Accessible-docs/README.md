
# AccessibleDocs

**AccessibleDocs** is a containerized FastAPI microservice that provides OCR text extraction, simplification of complex legal and medical text across multiple reading levels, and context-strict Q&A using Retrieval-Augmented Generation (RAG).

## Tech Stack
- **Framework:** FastAPI (Python 3.11)
- **LLM Engine:** Groq API (Llama 3.3 70B) for low-latency inference
- **Embeddings:** `BAAI/bge-base-en-v1.5` (via SentenceTransformers, running locally)
- **Vector Database:** ChromaDB (persistent local storage)
- **OCR / Extraction:** Tesseract OCR & PyMuPDF
- **Deployment:** Docker & Docker Compose

## Quick Start (Developers & Judges)

This service is fully containerized, so no local Python or compiler setup is required.

### Prerequisites
- Docker Desktop installed and running
- Groq API Key (free tier supports 30 RPM)

### Environment Setup
Create a `.env` file in the project root:
```env
GROQ_API_KEY="gsk_your_api_key_here"
```

### Build and Run
Start the service using Docker Compose:
```bash
docker-compose up --build
```
The API will be available at: `http://127.0.0.1:8000`  
Interactive Swagger UI: `http://127.0.0.1:8000/docs`

## Core API Endpoints

1. **Extract Text**  
   `POST /extract-text`  
   Accepts a document (`.pdf`, `.docx`, `.png`, `.jpg`) and returns OCR-extracted text. Temporary files are automatically cleaned up.

2. **Process Document (RAG Ingestion)**  
   `POST /process-document`  
   - Extracts text from a document  
   - Chunks text with contextual overlap  
   - Generates 768-dimensional embeddings using `bge-base-en-v1.5`  
   - Stores embeddings in ChromaDB  
   Returns a `document_id` for subsequent Q&A.

3. **Term Extraction**  
   `POST /extract-terms`  
   Identifies complex legal, medical, or technical terms and returns a JSON array with plain-language definitions.

4. **Multi-Level Simplification**  
   `POST /simplify`  
   Rewrites text into three cognitive accessibility levels: Child, Teen, Adult, while preserving factual accuracy.

5. **Document Q&A (RAG)**  
   `POST /ask`  
   Requires a `document_id` and a question. Answers are generated strictly from the document content with exact quote citations to prevent hallucinations.
