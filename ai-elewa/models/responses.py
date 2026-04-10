from pydantic import BaseModel
from typing import Literal, Optional

# ---------------------------------------------------------------------------
# LessonJSON building blocks
# ---------------------------------------------------------------------------

class RhythmScore(BaseModel):
    """
    Sentence rhythm analysis for a single lesson section.

    score: 0.0–1.0. Higher is better.
        1.0 = perfect adherence to profile rhythm rules
        0.6 = minimum acceptable threshold
        below 0.6 = flagged for correction in readability_warnings

    profile_rule: human-readable description of which rhythm rule was applied.
    violations: list of specific sentences that broke the rhythm rule,
                with their word counts and positions.
    """
    score: float
    profile_rule: str
    violations: list[str] = []


class ReadabilityScore(BaseModel):
    """
    Readability measurements for a single lesson section.

    flesch_reading_ease: 0–100. Higher = easier.
        90–100: Very easy (age 11)
        70–80:  Easy (age 13)
        60–70:  Standard (age 14–15)
        50–60:  Fairly difficult (age 16+)
        below 30: Very difficult (university level)

    flesch_kincaid_grade: US school grade equivalent.
        4 = age 9–10, 6 = age 11–12, 8 = age 13–14

    smog_grade: More accurate for health/civic content.
        Weights polysyllabic words more heavily than Flesch-Kincaid.
        Use this for medical, legal, or government content.
    """
    flesch_reading_ease: float
    flesch_kincaid_grade: float
    smog_grade: float
    rhythm: Optional[RhythmScore] = None


class Section(BaseModel):
    heading: str
    body: str
    visual_hint: Optional[str] = None
    visual_hint_type: Optional[str] = None
    reading_level: int
    readability: Optional[ReadabilityScore] = None
    rhythm_score: Optional[float] = None


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

class ReadabilitySummary(BaseModel):
    """
    Aggregated readability across the whole lesson.
    Derived from per-section scores — not an independent measurement.
    """
    avg_flesch_reading_ease: float
    avg_flesch_kincaid_grade: float
    avg_smog_grade: float
    within_target: bool
    target_flesch_min: float
    target_flesch_max: float


class LessonJSON(BaseModel):
    title: str
    sections: list[Section]
    key_terms: list[KeyTerm]
    estimated_minutes: int
    profile: str
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
    directive_reason: Optional[str] = None


# ---------------------------------------------------------------------------
# Wrong answer flow — both fields always present
# ---------------------------------------------------------------------------

class WrongAnswerFlowResponse(BaseModel):
    re_explanation: str
    reattempt_question: str
    explanation_strategy: Optional[str] = None