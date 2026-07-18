from pydantic import BaseModel, Field
from typing import Literal, Optional

# ---------------------------------------------------------------------------
# Learner context — sent on every request from Spring Boot
# Shared with Harrison — these field constraints are enforced by Pydantic
# ---------------------------------------------------------------------------

CognitiveProfile = Literal[
    "dyslexia",
    "adhd",
    "autism",
    "intellectual_disability"
]

PathwayStage = Literal[
    "Foundation",
    "Intermediate",
    "Pre-vocational",
    "Vocational"
]


class LearnerContext(BaseModel):
    learner_id: str
    cognitive_profiles: list[CognitiveProfile] = Field(
        ...,
        min_length=1,
        max_length=2,
        description="1 or 2 cognitive profiles only"
    )
    language_level: Literal[1, 2, 3]
    content_difficulty: Literal[1, 2, 3]
    pathway_stage: PathwayStage


# ---------------------------------------------------------------------------
# Endpoint request bodies
# ---------------------------------------------------------------------------

class SimplifyTextRequest(BaseModel):
    learner_context: LearnerContext
    raw_text: str


class SimplifyImageRequest(BaseModel):
    learner_context: LearnerContext
    base64_image: str = Field(..., min_length=1)
    media_type: Literal["image/jpeg", "image/png", "image/webp"]


class QuizGenerateRequest(BaseModel):
    learner_context: LearnerContext
    lesson_json: dict                          # full LessonJSON object
    num_questions: int = Field(..., ge=1, le=10)


class AdaptiveResponseRequest(BaseModel):
    learner_context: LearnerContext
    question: str
    selected_option: str
    is_correct: bool
    latency_ms: int = Field(..., ge=0)


class WrongAnswerFlowRequest(BaseModel):
    learner_context: LearnerContext
    question: str
    section_content: str


class ProcessRequest(BaseModel):
    file_path: str
    sne_type: str = "NONE"


class ProcessResponse(BaseModel):
    simplified_text: str
    word_count: int

