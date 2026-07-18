from pydantic import BaseModel
from typing import Literal, Optional

# ---------------------------------------------------------------------------
# LessonJSON building blocks
# ---------------------------------------------------------------------------

class Section(BaseModel):
    heading: str
    body: str
    visual_hint: Optional[str] = None
    reading_level: int
    mermaid: str = ""  # Mermaid.js diagram for this section


class KeyTerm(BaseModel):
    term: str
    definition: str


class StageFlags(BaseModel):
    verification_triggered: bool = False
    correction_applied: bool = False
    profile_merged: bool = False


# ---------------------------------------------------------------------------
# LessonJSON — the core contract shared with Harrison (Spring Boot)
# This exact shape is what /ai/simplify/text and /ai/simplify/image return
# Share this model definition with Harrison — he must store/forward it exactly
# ---------------------------------------------------------------------------

class LessonJSON(BaseModel):
    title: str
    sections: list[Section]
    key_terms: list[KeyTerm]
    estimated_minutes: int
    profile: str                    # the active profile string e.g. "dyslexia"
    stage_flags: StageFlags


# ---------------------------------------------------------------------------
# Quiz response models
# ---------------------------------------------------------------------------

class QuizOption(BaseModel):
    id: str                         # "a", "b", "c", "d"
    text: str


class QuizQuestion(BaseModel):
    id: str                         # "q1", "q2", etc.
    text: str
    options: list[QuizOption]
    correct_id: str
    explanation: str


class QuizResponse(BaseModel):
    questions: list[QuizQuestion]


# ---------------------------------------------------------------------------
# Adaptive response
# ---------------------------------------------------------------------------

class AdaptiveResponse(BaseModel):
    learner_message: str
    directive: Literal["easier", "same", "harder", "revisit"]


# ---------------------------------------------------------------------------
# Wrong answer flow — both fields always present
# ---------------------------------------------------------------------------

class WrongAnswerFlowResponse(BaseModel):
    re_explanation: str
    reattempt_question: str


# ---------------------------------------------------------------------------
# Process endpoint response — backend compatibility
# ---------------------------------------------------------------------------

class ProcessResponse(BaseModel):
    simplified_text: str
    word_count: int
