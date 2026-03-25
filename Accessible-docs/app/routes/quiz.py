from fastapi import APIRouter, HTTPException
import json
import logging
from app.models import QuizRequest, QuizResponse, QuizQuestion
from app.config import generate_content 

router = APIRouter()
logger = logging.getLogger(__name__)

@router.post("/generate-diagnostic", response_model=QuizResponse, tags=["Active Learning"])
async def generate_diagnostic_quiz(request: QuizRequest):
    try:
        prompt = f"""
        You are an expert inclusive educator specializing in cognitive accessibility. 
        Read the following text and generate a 3-question diagnostic check to ensure the user actually understands the core concepts.

        TEXT TO ANALYZE:
        {request.text}

        READING LEVEL TARGET: {request.level}

        STRICT RULES FOR COGNITIVE ACCESSIBILITY:
        1. NO trick questions, NO double negatives, and NO "All of the above" or "None of the above" options.
        2. Keep the language literal, direct, and empathetic.
        3. The 'concept_tested' must be a short 1-2 word tag (e.g., "Timeline", "Core Right", "Penalty").
        4. The 'helpful_hint' should gently guide the user to the answer without giving it away.
        5. The 'explanation' must clearly explain WHY it is correct in simple terms.

        You MUST respond with ONLY a valid JSON array of objects. Do not include markdown formatting like ```json.
        Format exactly like this:
        [
            {{
                "question": "What happens if you do not pay the rent by the 5th of the month?",
                "options": ["You get a warning", "You pay a late fee", "You are evicted immediately", "Nothing happens"],
                "correct_answer": "You pay a late fee",
                "concept_tested": "Penalties",
                "helpful_hint": "Look at the section that talks about the 5th day of the month.",
                "explanation": "The document states that a late fee is applied if payment is not received by the 5th."
            }}
        ]
        """
        
        raw_response = generate_content(prompt)
        
        # Strip markdown if Groq sneaks it in
        cleaned_response = raw_response.strip().replace("```json", "").replace("```", "")
        quiz_data = json.loads(cleaned_response)
        
        # Validate through Pydantic
        questions = [QuizQuestion(**q) for q in quiz_data]
            
        return QuizResponse(questions=questions)

    except Exception as e:
        logger.error(f"Diagnostic generation failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to generate diagnostic check.")