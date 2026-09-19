from pydantic import BaseModel
from typing import Literal, Optional


class RhythmScore(BaseModel):
    score: float
    profile_rule: str
    violations: list[str] = []


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


class Section(BaseModel):
    heading: str
    body: str
    visual_hint: Optional[str] = None
    reading_level: int
    mermaid: str = ""
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
    readability_correction_applied: bool = False        # Improvement 7


class LessonJSON(BaseModel):
    title: str
    sections: list[Section]
    key_terms: list[KeyTerm]
    estimated_minutes: int
    profile: str
    stage_flags: StageFlags
    readability_summary: Optional[ReadabilitySummary] = None


class QuizOption(BaseModel):
    id: str
    text: str


class QuizQuestion(BaseModel):
    id: str
    text: str
    options: list[QuizOption]
    correct_id: str
    explanation: str


class QuizResponse(BaseModel):
    questions: list[QuizQuestion]


class AdaptiveResponse(BaseModel):
    learner_message: str
    directive: Literal["easier", "same", "harder", "revisit"]
    directive_reason: Optional[str] = None             # Improvement 5


class WrongAnswerFlowResponse(BaseModel):
    re_explanation: str
    reattempt_question: str
    explanation_strategy: Optional[str] = None         # Improvement 6


class ProcessResponse(BaseModel):
    simplified_text: str
    word_count: int
    
class TutorChatResponse(BaseModel):
    reply: str
    action_handled: Optional[str] = None
    fallback: bool = False