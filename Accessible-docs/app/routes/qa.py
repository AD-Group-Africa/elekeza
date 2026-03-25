from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.services.rag_service import answer_with_rag


router = APIRouter()


class QuestionRequest(BaseModel):
    document_id: str
    question: str


@router.post("/ask", tags=["RAG Question Answering"])
async def ask_question(request: QuestionRequest):
    try:
        if not request.document_id:
            raise HTTPException(status_code=400, detail="document_id is required")

        if not request.question.strip():
            raise HTTPException(status_code=400, detail="Question cannot be empty")

        answer = answer_with_rag(
            document_id=request.document_id,
            question=request.question
        )

        return {
            "document_id": request.document_id,
            "question": request.question,
            "answer": answer
        }

    except HTTPException:
        raise

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))