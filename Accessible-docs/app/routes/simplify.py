from fastapi import APIRouter, HTTPException
from concurrent.futures import ThreadPoolExecutor
from functools import partial
import logging
import time  

from app.models import SimplifyRequest, SimplifyResponse
from app.services.gemini_service import simplify_all_levels, extract_terms
from app.services.reading_level_service import compare_reading_levels
from app.services.chunk_service import chunk_text, combine_chunks

router = APIRouter()
logger = logging.getLogger(__name__)

@router.post("/simplify", response_model=SimplifyResponse, tags=["AI Simplification"])
async def simplify_text(request: SimplifyRequest):
    try:
        original_text = request.text.strip()

        if not original_text:
            raise HTTPException(status_code=400, detail="Text cannot be empty")

        raw_terms_data = extract_terms(original_text)
        extracted_words = [item["term"] for item in raw_terms_data] if raw_terms_data else []

        chunks = chunk_text(original_text)

        simplified_results = {
            "child": [],
            "teen": [],
            "adult": []
        }

        with ThreadPoolExecutor(max_workers=2) as executor:
            simplify_func = partial(simplify_all_levels, terms=extracted_words)
            
            def throttled_simplify(chunk):
                time.sleep(2) 
                return simplify_func(chunk)
            
            results = list(executor.map(throttled_simplify, chunks))

        for chunk_result in results:
            simplified_results["child"].append(chunk_result.get("child", ""))
            simplified_results["teen"].append(chunk_result.get("teen", ""))
            simplified_results["adult"].append(chunk_result.get("adult", ""))

        combined_results = {
            "child": combine_chunks(simplified_results["child"]),
            "teen": combine_chunks(simplified_results["teen"]),
            "adult": combine_chunks(simplified_results["adult"]),
        }

        reading_analysis = compare_reading_levels(original_text, combined_results)

        return SimplifyResponse(
            child=combined_results["child"],
            teen=combined_results["teen"],
            adult=combined_results["adult"],
            reading_analysis=reading_analysis,
            extracted_terms=raw_terms_data
        )

    except HTTPException:
        raise

    except Exception as e:
        logger.error(f"Simplification route failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))