import pytest
from models.responses import LessonJSON, Section, KeyTerm, StageFlags
from models.requests import LearnerContext
from pipeline.stage4_concepts import extract_concepts
from pipeline.stage3_verify import WORD_THRESHOLD


def make_lesson(key_terms=None, sections=None):
    return LessonJSON(
        title="Test Lesson",
        sections=sections or [
            Section(heading="Test", body="Test body.", visual_hint=None, reading_level=2)
        ],
        key_terms=key_terms or [],
        estimated_minutes=3,
        profile="dyslexia",
        stage_flags=StageFlags(),
    )


# ---------------------------------------------------------------------------
# Stage 4 — concept extraction
# ---------------------------------------------------------------------------

def test_extract_concepts_returns_clean_terms():
    lesson = make_lesson(key_terms=[
        KeyTerm(term="Photosynthesis", definition="Making food from sunlight."),
        KeyTerm(term="Chlorophyll", definition="Green pigment in plants."),
    ])
    result = extract_concepts(lesson)
    assert len(result.key_terms) == 2
    assert result.key_terms[0].term == "Photosynthesis"


def test_extract_concepts_deduplicates():
    lesson = make_lesson(key_terms=[
        KeyTerm(term="Photosynthesis", definition="Making food from sunlight."),
        KeyTerm(term="photosynthesis", definition="Duplicate entry."),
    ])
    result = extract_concepts(lesson)
    assert len(result.key_terms) == 1


def test_extract_concepts_removes_empty_terms():
    lesson = make_lesson(key_terms=[
        KeyTerm(term="", definition="No term here."),
        KeyTerm(term="Chlorophyll", definition="Green pigment."),
    ])
    result = extract_concepts(lesson)
    assert len(result.key_terms) == 1
    assert result.key_terms[0].term == "Chlorophyll"


def test_extract_concepts_handles_empty_list():
    lesson = make_lesson(key_terms=[])
    result = extract_concepts(lesson)
    assert result.key_terms == []


# ---------------------------------------------------------------------------
# Stage 3 — word threshold gate
# ---------------------------------------------------------------------------

def test_word_threshold_value():
    """Confirm threshold is set to 500 as per spec."""
    assert WORD_THRESHOLD == 500


def test_short_text_is_below_threshold():
    short_text = "This is a short text. " * 20  # ~100 words
    assert len(short_text.split()) <= WORD_THRESHOLD


def test_long_text_is_above_threshold():
    # 13 words per repetition × 45 = 585 words — safely above 500
    long_text = "This is a longer text with many words included for testing purposes here. " * 45
    assert len(long_text.split()) > WORD_THRESHOLD

