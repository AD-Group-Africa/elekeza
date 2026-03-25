from fastapi import APIRouter, UploadFile, File, HTTPException
import uuid
import os
import logging

from app.services.extraction_service import (
    extract_text_from_file,
    clean_extracted_text
)
from app.services.rag_service import store_document

router = APIRouter()
logger = logging.getLogger(__name__)

UPLOAD_DIR = "temp_uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

@router.post("/process-document", tags=["RAG Processing"])
async def process_document(file: UploadFile = File(...)):
    try:
        # Validate file type
        allowed_extensions = (".pdf", ".docx", ".png", ".jpg", ".jpeg")

        if not file.filename.lower().endswith(allowed_extensions):
            raise HTTPException(
                status_code=400,
                detail="Unsupported file type. Use PDF, DOCX, or image."
            )

        # Save file temporarily
        document_id = str(uuid.uuid4())
        temp_path = os.path.join(UPLOAD_DIR, f"{document_id}_{file.filename}")

        with open(temp_path, "wb") as buffer:
            content = await file.read()
            buffer.write(content)

        # Extract text
        raw_text = extract_text_from_file(temp_path)

        if not raw_text:
            raise HTTPException(
                status_code=400,
                detail="Could not extract text from file."
            )

        # Clean extracted text
        cleaned_text = clean_extracted_text(raw_text)

        # Store in vector DB
        result = store_document(document_id, cleaned_text)

        return {
            "message": "Document processed successfully",
            "document_id": document_id,
            "chunks_stored": result["chunks"]
        }

    except HTTPException:
        raise

    except Exception as e:
        logger.error(f"Processing failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))
        
    finally:
        if 'temp_path' in locals() and os.path.exists(temp_path):
            os.remove(temp_path)