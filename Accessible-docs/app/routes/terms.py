from fastapi import APIRouter, HTTPException
from app.models import TermsRequest
from app.services.chunk_service import chunk_text
from app.services.gemini_service import extract_terms  

router = APIRouter()


@router.post("/extract-terms", tags=["AI Terms Extraction"])
async def extract_terms_route(request: TermsRequest):
    try:
        text = request.text.strip()

        if not text:
            raise HTTPException(status_code=400, detail="Text cannot be empty")

        #  Chunk large documents
        chunks = chunk_text(text)

        all_terms = []

        #  Extract terms per chunk
        for chunk in chunks:
            terms = extract_terms(chunk)  # ✅ updated function call

            if isinstance(terms, list):
                all_terms.extend(terms)

        #  Remove duplicates (case-insensitive)
        unique_terms = list({term['term'].lower(): term for term in all_terms}.values())

        return {
            "terms": unique_terms,
            "count": len(unique_terms)
        }

    except HTTPException:
        raise

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))