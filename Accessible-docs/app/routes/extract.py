from fastapi import APIRouter, UploadFile, File, HTTPException
import os
import uuid
import logging

from app.services.extraction_service import (
    extract_text_from_file,
    clean_extracted_text
)

router = APIRouter()
logger = logging.getLogger(__name__)

UPLOAD_DIR = "temp_uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

@router.post("/extract-text", tags=["Text Extraction"])
async def extract_text(file: UploadFile = File(...)):
    try:
        allowed_extensions = (".pdf", ".docx", ".png", ".jpg", ".jpeg")

        if not file.filename.lower().endswith(allowed_extensions):
            raise HTTPException(
                status_code=400,
                detail="Unsupported file type."
            )

        temp_filename = f"{uuid.uuid4()}_{file.filename}"
        temp_path = os.path.join(UPLOAD_DIR, temp_filename)

        # Save temporarily
        with open(temp_path, "wb") as buffer:
            content = await file.read()
            buffer.write(content)

        # Extract
        raw_text = extract_text_from_file(temp_path)

        if not raw_text:
            raise HTTPException(
                status_code=400,
                detail="Could not extract text from file."
            )

        cleaned_text = clean_extracted_text(raw_text)

        return {
            "filename": file.filename,
            "text_length": len(cleaned_text),
            "text": cleaned_text
        }

    except HTTPException:
        raise

    except Exception as e:
        logger.error(f"Extraction failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))
        
    finally:
        if 'temp_path' in locals() and os.path.exists(temp_path):
            os.remove(temp_path)