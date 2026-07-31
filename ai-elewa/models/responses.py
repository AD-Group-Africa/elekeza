from pydantic import BaseModel
from typing import Literal, Optional

# ---------------------------------------------------------------------------
# Readability and Rhythm models
# ---------------------------------------------------------------------------

class RhythmScore(BaseModel):
    score: float
    profile_rule: str
    violations: list[str]


class ReadabilityScore(BaseModel):
    flesch_reading_ease: float
    flesch_kincaid_grade: float
    smog_grade: float
    rhythm: Optional[RhythmScore] = None


class ReadabilitySummary(BaseModel):
    avg_flesch_reading_ease: float
    avg_flesch_kincaid_grade: float
    avg_smog_grade: float
    within_target: bool
    target_flesch_min: float
    target_flesch_max: float


# ---------------------------------------------------------------------------
# LessonJSON building blocks
# ---------------------------------------------------------------------------

class Section(BaseModel):
    heading: str
    body: str
    visual_hint: Optional[str] = None
    reading_level: int
    mermaid: str = ""  # Mermaid.js diagram for this section
    readability: Optional[ReadabilityScore] = None
    rhythm_score: Optional[float] = None
    visual_hint_type: Optional[str] = None


class KeyTerm(BaseModel):
    term: str
    definition: str


class StageFlags(BaseModel):
    verification_triggered: bool = False
    correction_applied: bool = False
    profile_merged: bool = False
    readability_warnings: list[str] = []


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
    readability_summary: Optional[ReadabilitySummary] = None


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
