"""
Unit tests for readability measurement — Improvement 1.

All tests are pure — no server, no API calls, no AI provider required.
Tests cover: scoring, target validation, comorbid target resolution,
short section handling, lesson summary computation, and integration
with the Stage 4 pipeline function.
"""

import pytest
from models.requests import LearnerContext
from models.responses import LessonJSON, Section, KeyTerm, StageFlags
from utils.readability import (
    get_target,
    measure_section,
    validate_section,
    compute_lesson_summary,
    READABILITY_TARGETS,
)
from pipeline.stage4_concepts import extract_concepts, measure_readability


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

def make_context(
    profiles: list[str],
    language_level: int = 2,
    content_difficulty: int = 2,
    pathway_stage: str = "Foundation",
) -> LearnerContext:
    return LearnerContext(
        learner_id="test-readability-001",
        cognitive_profiles=profiles,
        language_level=language_level,
        content_difficulty=content_difficulty,
        pathway_stage=pathway_stage,
    )


def make_lesson(sections: list[Section] | None = None) -> LessonJSON:
    return LessonJSON(
        title="Test Lesson",
        sections=sections or [
            Section(
                heading="Test Section",
                body=(
                    "Plants make food from sunlight. "
                    "This process is called photosynthesis. "
                    "Plants need water and air to do this. "
                    "The green colour in leaves helps them catch sunlight. "
                    "Sunlight gives plants the energy they need to grow."
                ),
                visual_hint="diagram of a plant",
                reading_level=2,
            )
        ],
        key_terms=[KeyTerm(term="photosynthesis", definition="how plants make food")],
        estimated_minutes=3,
        profile="dyslexia",
        stage_flags=StageFlags(),
    )


# Simple text samples at different reading levels
SIMPLE_TEXT = (
    "The sun is hot. It warms the ground. "
    "Water gets warm too. Warm water rises up. "
    "It forms clouds in the sky. Rain falls down. "
    "The water goes back into rivers and the sea."
)

MEDIUM_TEXT = (
    "Photosynthesis is the process by which plants convert sunlight into energy. "
    "Plants absorb carbon dioxide from the air through tiny pores in their leaves. "
    "Water is drawn up through the roots and transported to the leaves. "
    "Using sunlight, plants combine carbon dioxide and water to produce glucose. "
    "Oxygen is released as a byproduct of this chemical reaction. "
    "The glucose produced provides energy for the plant's growth and reproduction."
)

COMPLEX_TEXT = (
    "The biochemical mechanism of oxygenic photosynthesis involves the sequential "
    "operation of two photosystems within the thylakoid membranes of chloroplasts. "
    "Photosystem II oxidises water molecules through a manganese-containing oxygen-evolving "
    "complex, generating molecular oxygen as a byproduct of this light-driven catalysis. "
    "The electrons extracted from water traverse an electron transport chain, generating "
    "a proton gradient that drives ATP synthesis via the chemiosmotic mechanism. "
    "Photosystem I utilises this electron flow to reduce NADP+ to NADPH, which "
    "subsequently participates in carbon fixation during the Calvin-Benson cycle."
)


# ---------------------------------------------------------------------------
# measure_section — scoring correctness
# ---------------------------------------------------------------------------

def test_simple_text_produces_high_flesch():
    scores = measure_section(SIMPLE_TEXT)
    assert scores["flesch_reading_ease"] >= 70, (
        f"Simple text should score ≥70 Flesch, got {scores['flesch_reading_ease']}"
    )


def test_complex_text_produces_low_flesch():
    scores = measure_section(COMPLEX_TEXT)
    assert scores["flesch_reading_ease"] < 40, (
        f"Complex text should score <40 Flesch, got {scores['flesch_reading_ease']}"
    )


def test_complex_text_produces_high_grade():
    scores = measure_section(COMPLEX_TEXT)
    assert scores["flesch_kincaid_grade"] >= 12, (
        f"Complex text should be grade ≥12, got {scores['flesch_kincaid_grade']}"
    )


def test_simple_text_produces_low_grade():
    scores = measure_section(SIMPLE_TEXT)
    assert scores["flesch_kincaid_grade"] <= 6, (
        f"Simple text should be grade ≤6, got {scores['flesch_kincaid_grade']}"
    )


def test_all_three_scores_are_returned():
    scores = measure_section(MEDIUM_TEXT)
    assert "flesch_reading_ease" in scores
    assert "flesch_kincaid_grade" in scores
    assert "smog_grade" in scores


def test_scores_are_floats():
    scores = measure_section(MEDIUM_TEXT)
    for key, value in scores.items():
        assert isinstance(value, float), f"{key} should be float, got {type(value)}"


def test_short_section_returns_conservative_estimate():
    """Sections under 30 words return safe fallback values rather than unreliable scores."""
    short = "Plants need sunlight to grow."
    scores = measure_section(short)
    assert scores["flesch_reading_ease"] > 0
    assert scores["flesch_kincaid_grade"] > 0
    assert scores["smog_grade"] > 0


# ---------------------------------------------------------------------------
# get_target — target resolution
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("profile", ["dyslexia", "adhd", "autism", "intellectual_disability"])
@pytest.mark.parametrize("level", [1, 2, 3])
def test_target_exists_for_all_profiles_and_levels(profile, level):
    target = get_target(profile, level)
    assert target.flesch_min >= 0
    assert target.flesch_max <= 100
    assert target.flesch_min < target.flesch_max
    assert target.fk_grade_max > 0
    assert target.max_words_per_sentence > 0
    assert target.max_sentences_per_section > 0


def test_id_profile_is_strictest_at_level_1():
    id_target = get_target("intellectual_disability", 1)
    dyslexia_target = get_target("dyslexia", 1)
    assert id_target.flesch_min > dyslexia_target.flesch_min, (
        "ID profile should require higher Flesch minimum (easier text) than dyslexia"
    )
    assert id_target.fk_grade_max < dyslexia_target.fk_grade_max, (
        "ID profile should have a lower grade ceiling than dyslexia"
    )


def test_level_3_is_more_permissive_than_level_1():
    """Higher language level allows more complex content."""
    for profile in ["dyslexia", "adhd", "autism", "intellectual_disability"]:
        target_l1 = get_target(profile, 1)
        target_l3 = get_target(profile, 3)
        assert target_l3.fk_grade_max >= target_l1.fk_grade_max, (
            f"Level 3 should allow higher grade than level 1 for {profile}"
        )
        assert target_l3.max_words_per_sentence >= target_l1.max_words_per_sentence, (
            f"Level 3 should allow longer sentences than level 1 for {profile}"
        )


def test_comorbid_target_is_stricter_than_either_single_profile():
    dyslexia = get_target("dyslexia", 1)
    id_profile = get_target("intellectual_disability", 1)
    comorbid = get_target("dyslexia+intellectual_disability", 1)

    assert comorbid.flesch_min >= dyslexia.flesch_min
    assert comorbid.flesch_min >= id_profile.flesch_min
    assert comorbid.fk_grade_max <= dyslexia.fk_grade_max
    assert comorbid.fk_grade_max <= id_profile.fk_grade_max


def test_comorbid_order_does_not_matter():
    """dyslexia+adhd and adhd+dyslexia should produce the same target."""
    target_ab = get_target("dyslexia+adhd", 2)
    target_ba = get_target("adhd+dyslexia", 2)
    assert target_ab.flesch_min == target_ba.flesch_min
    assert target_ab.fk_grade_max == target_ba.fk_grade_max


# ---------------------------------------------------------------------------
# validate_section — warning generation
# ---------------------------------------------------------------------------

def test_simple_text_passes_id_level_1():
    target = get_target("intellectual_disability", 1)
    scores = measure_section(SIMPLE_TEXT)
    warnings = validate_section("Test", SIMPLE_TEXT, scores, target)
    # Simple text should produce few or no Flesch/grade warnings
    flesch_warnings = [w for w in warnings if "Flesch" in w or "SMOG" in w or "Kincaid" in w]
    assert len(flesch_warnings) == 0, (
        f"Simple text should pass ID level 1 Flesch check, got: {flesch_warnings}"
    )


def test_complex_text_fails_id_level_1():
    target = get_target("intellectual_disability", 1)
    scores = measure_section(COMPLEX_TEXT)
    warnings = validate_section("Test", COMPLEX_TEXT, scores, target)
    assert len(warnings) > 0, "Complex text should fail ID level 1 validation"


def test_long_sentence_generates_warning():
    long_sentence_text = (
        "The biochemical process of photosynthesis involves the conversion of "
        "light energy into chemical energy stored within glucose molecules. "
        "Plants are small. Water is wet. Sun is bright. Leaves are green."
    )
    target = get_target("intellectual_disability", 1)  # max 8 words/sentence
    scores = measure_section(long_sentence_text)
    warnings = validate_section("Test", long_sentence_text, scores, target)
    sentence_warnings = [w for w in warnings if "words exceeds" in w]
    assert len(sentence_warnings) > 0, "Long sentence should trigger a word count warning"


def test_warning_contains_section_heading():
    target = get_target("intellectual_disability", 1)
    scores = measure_section(COMPLEX_TEXT)
    warnings = validate_section("My Section", COMPLEX_TEXT, scores, target)
    for w in warnings:
        assert "My Section" in w, f"Warning should reference the section heading: {w}"


def test_passing_section_returns_empty_warnings():
    target = get_target("dyslexia", 3)  # most permissive dyslexia level
    scores = measure_section(SIMPLE_TEXT)
    warnings = validate_section("Easy Section", SIMPLE_TEXT, scores, target)
    # Simple text at the most permissive level should produce no warnings
    grade_warnings = [w for w in warnings if "grade" in w.lower() or "Flesch" in w]
    assert len(grade_warnings) == 0


# ---------------------------------------------------------------------------
# compute_lesson_summary
# ---------------------------------------------------------------------------

def test_summary_within_target_for_appropriate_content():
    target = get_target("dyslexia", 2)
    scores = measure_section(MEDIUM_TEXT)
    sections_with_scores = [("Section 1", scores), ("Section 2", scores)]
    summary = compute_lesson_summary(sections_with_scores, target)
    assert "avg_flesch_reading_ease" in summary
    assert "avg_flesch_kincaid_grade" in summary
    assert "avg_smog_grade" in summary
    assert "within_target" in summary
    assert isinstance(summary["within_target"], bool)


def test_summary_averages_are_correct():
    target = get_target("dyslexia", 2)
    scores_a = {"flesch_reading_ease": 70.0, "flesch_kincaid_grade": 6.0, "smog_grade": 6.0}
    scores_b = {"flesch_reading_ease": 80.0, "flesch_kincaid_grade": 4.0, "smog_grade": 5.0}
    summary = compute_lesson_summary([("A", scores_a), ("B", scores_b)], target)
    assert summary["avg_flesch_reading_ease"] == 75.0
    assert summary["avg_flesch_kincaid_grade"] == 5.0
    assert summary["avg_smog_grade"] == 5.5


def test_empty_sections_handled_gracefully():
    target = get_target("dyslexia", 2)
    summary = compute_lesson_summary([], target)
    assert summary["within_target"] is False
    assert summary["avg_flesch_reading_ease"] == 0.0


# ---------------------------------------------------------------------------
# measure_readability — Stage 4 integration
# ---------------------------------------------------------------------------

def test_measure_readability_attaches_scores_to_sections():
    lesson = make_lesson()
    ctx = make_context(["dyslexia"])
    result = measure_readability(lesson, ctx)
    for section in result.sections:
        assert section.readability is not None
        assert section.readability.flesch_reading_ease > 0
        assert section.readability.flesch_kincaid_grade > 0
        assert section.readability.smog_grade > 0


def test_measure_readability_attaches_summary():
    lesson = make_lesson()
    ctx = make_context(["dyslexia"])
    result = measure_readability(lesson, ctx)
    assert result.readability_summary is not None
    assert result.readability_summary.avg_flesch_reading_ease > 0
    assert isinstance(result.readability_summary.within_target, bool)


def test_measure_readability_populates_warnings_for_complex_content():
    complex_section = Section(
        heading="Complex Section",
        body=COMPLEX_TEXT,
        visual_hint=None,
        reading_level=1,
    )
    lesson = make_lesson([complex_section])
    ctx = make_context(["intellectual_disability"], language_level=1)
    result = measure_readability(lesson, ctx)
    assert len(result.stage_flags.readability_warnings) > 0


def test_measure_readability_no_warnings_for_simple_id_content():
    simple_section = Section(
        heading="Simple Section",
        body=SIMPLE_TEXT,
        visual_hint="photo of rain",
        reading_level=1,
    )
    lesson = make_lesson([simple_section])
    ctx = make_context(["intellectual_disability"], language_level=1)
    result = measure_readability(lesson, ctx)
    grade_warnings = [
        w for w in result.stage_flags.readability_warnings
        if "grade" in w.lower() or "Flesch" in w
    ]
    assert len(grade_warnings) == 0, (
        f"Simple text should not trigger grade warnings for ID L1: {grade_warnings}"
    )


@pytest.mark.parametrize("profile", ["dyslexia", "adhd", "autism", "intellectual_disability"])
def test_measure_readability_runs_for_all_profiles(profile):
    lesson = make_lesson()
    ctx = make_context([profile])
    result = measure_readability(lesson, ctx)
    assert result.readability_summary is not None
    assert all(s.readability is not None for s in result.sections)


def test_measure_readability_runs_for_comorbid_profile():
    lesson = make_lesson()
    ctx = make_context(["dyslexia", "intellectual_disability"])
    result = measure_readability(lesson, ctx)
    assert result.readability_summary is not None


def test_stage_flags_readability_warnings_is_list():
    lesson = make_lesson()
    ctx = make_context(["dyslexia"])
    result = measure_readability(lesson, ctx)
    assert isinstance(result.stage_flags.readability_warnings, list)


def test_extract_concepts_still_works_after_readability_added():
    """Confirm extract_concepts is unaffected by the new readability fields."""
    lesson = make_lesson()
    lesson.key_terms = [
        KeyTerm(term="Photosynthesis", definition="Making food from sunlight."),
        KeyTerm(term="photosynthesis", definition="Duplicate."),
        KeyTerm(term="", definition="Empty term."),
    ]
    result = extract_concepts(lesson)
    assert len(result.key_terms) == 1
    assert result.key_terms[0].term == "Photosynthesis"