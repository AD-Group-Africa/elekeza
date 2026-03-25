from pydantic import BaseModel, Field
from typing import Optional, Dict, List

class SimplifyRequest(BaseModel):
    text: str = Field(..., description="Text to simplify")


class TermsRequest(BaseModel):
    text: str = Field(..., description="Text to extract key terms from")


class QuestionRequest(BaseModel):
    document_id: str = Field(..., description="Document identifier")
    question: str = Field(..., description="User question about the document")


class ProcessDocumentRequest(BaseModel):
    document_id: str = Field(..., description="Unique document ID")
    text: str = Field(..., description="Full extracted document text")



class SimplifyResponse(BaseModel):
    child: str
    teen: str
    adult: str
    reading_analysis: Optional[Dict] = None
    extracted_terms: Optional[List[Dict[str, str]]] = []


class TermsResponse(BaseModel):
    terms: List[Dict]


class QuestionResponse(BaseModel):
    answer: str


class GenericResponse(BaseModel):
    message: str
    
class QuizRequest(BaseModel):
    text: str
    level: str

class QuizQuestion(BaseModel):
    question: str
    options: list[str]
    correct_answer: str
    concept_tested: str   
    helpful_hint: str    
    explanation: str      

class QuizResponse(BaseModel):
    questions: list[QuizQuestion]