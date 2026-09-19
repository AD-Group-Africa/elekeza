"""
Unit tests for sentence rhythm enforcement — Improvement 2.

All tests are pure — no server, no API calls, no AI provider required.
Tests cover: sentence splitting, word counting, rule resolution,
profile-specific scoring logic, comorbid rules, and Stage 4 integration.
"""

import pytest
from utils.rhythm import (
    split_sentences,
    word_count,
    get_rhythm_rule,
    analyse_rhythm,
    RHYTHM_RULES,
)
from models.requests import LearnerContext
from models.responses import LessonJSON, Section, KeyTerm, StageFlags
from pipeline.stage4_concepts import measure_readability


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

def make_context(
    profiles: list[str],
    language_level: int = 1,
) -> LearnerContext:
    return LearnerContext(
        learner_id="test-rhythm-001",
        cognitive_profiles=profiles,
        language_level=language_level,
        content_difficulty=1,
        pathway_stage="Foundation",
    )


def make_lesson(body: str, profile: str = "dyslexia") -> LessonJSON:
    return LessonJSON(
        title="Test Lesson",
        sections=[Section(
            heading="Test Section",
            body=body,
            visual_hint=None,
            reading_level=1,
        )],
        key_terms=[KeyTerm(term="test", definition="a test term")],
        estimated_minutes=2,
        profile=profile,
        stage_flags=StageFlags(),
    )


# ---------------------------------------------------------------------------
# Text samples per profile
# ---------------------------------------------------------------------------

# Dyslexia — all sentences within 10 words
DYSLEXIA_GOOD_L1 = (
    "Plants need sunlight. "
    "They use it to make food. "
    "This food gives them energy. "
    "Water helps too. "
    "Without water, plants cannot grow."
)

# Dyslexia — one sentence violates the 10-word limit
DYSLEXIA_BAD_L1 = (
    "Plants need sunlight. "
    "They use it to make food. "
    "The process by which green plants convert sunlight into usable energy occurs daily. "
    "Water helps too."
)

# ADHD — good alternation between short and long sentences
ADHD_GOOD_L1 = (
    "Plants need sun. "
    "Without sunlight, a plant cannot produce the glucose it needs to survive. "
    "Water helps. "
    "Roots absorb water from the soil and carry it up to the leaves. "
    "Leaves catch light."
)

# ADHD — all sentences are uniformly medium length (poor rhythm)
ADHD_BAD_L1 = (
    "Plants need sunlight to grow well. "
    "Water is also needed for the plant. "
    "Leaves help the plant use sunlight. "
    "Roots take water from the soil. "
    "The plant uses these to make food."
)

# Autism — consistent sentence lengths
AUTISM_GOOD_L1 = (
    "Plants need sunlight to grow. "
    "They also need water to live. "
    "Roots absorb water from the ground. "
    "Leaves collect the sunlight they need. "
    "These two things keep the plant alive."
)

# Autism — dramatic length variation between consecutive sentences
AUTISM_BAD_L1 = (
    "Plants grow. "
    "The complex biochemical process by which plants convert light energy from the sun "
    "into chemical energy stored as glucose is known as photosynthesis. "
    "Roots absorb water. "
    "Leaves use sunlight."
)

# ID — all sentences within 8 words
ID_GOOD_L1 = (
    "Plants need sun. "
    "Sun helps them grow. "
    "They need water too. "
    "Water comes from the ground. "
    "Plants make food from sun and water."
)

# ID — multiple sentences exceed the 8-word limit
ID_BAD_L1 = (
    "Plants need sunlight to grow and make food. "
    "They also need water from the soil each day. "
    "Leaves collect the sunlight that the plant needs to survive. "
    "Roots bring water and nutrients up into the plant stem."
)


# ---------------------------------------------------------------------------
# split_sentences
# ---------------------------------------------------------------------------

def test_split_simple_sentences():
    text = "The sun is hot. Plants need sunlight. Water is wet."
    result = split_sentences(text)
    assert len(result) == 3


def test_split_handles_exclamation_and_question():
    text = "Is that right? Yes! Plants do need sunlight."
    result = split_sentences(text)
    assert len(result) == 3


def test_split_does_not_split_mr_abbreviation():
    text = "Mr. Smith teaches science. He is a good teacher."
    result = split_sentences(text)
    assert len(result) == 2


def test_split_handles_single_sentence():
    text = "Plants need sunlight to grow."
    result = split_sentences(text)
    assert len(result) == 1


def test_split_strips_whitespace():
    text = "  Plants need sun.   They grow well.  "
    result = split_sentences(text)
    assert all(s == s.strip() for s in result)
    assert len(result) == 2


def test_split_normalises_multiple_spaces():
    text = "Plants   need   sun.  They grow."
    result = split_sentences(text)
    assert len(result) == 2


# ---------------------------------------------------------------------------
# word_count
# ---------------------------------------------------------------------------

def test_word_count_simple():
    assert word_count("Plants need sunlight to grow.") == 5


def test_word_count_excludes_punctuation_only_tokens():
    # Punctuation-only tokens should not count as words
    assert word_count("Hello — world.") == 2


def test_word_count_single_word():
    assert word_count("Photosynthesis.") == 1


def test_word_count_empty_string():
    assert word_count("") == 0


# ---------------------------------------------------------------------------
# get_rhythm_rule — rule resolution
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("profile", [
    "dyslexia", "adhd", "autism", "intellectual_disability"
])
@pytest.mark.parametrize("level", [1, 2, 3])
def test_rule_exists_for_all_profiles_and_levels(profile, level):
    rule = get_rhythm_rule(profile, level)
    assert rule.rule_description != ""


def test_id_hard_max_is_strictest_at_level_1():
    id_rule = get_rhythm_rule("intellectual_disability", 1)
    dyslexia_rule = get_rhythm_rule("dyslexia", 1)
    assert id_rule.hard_max <= dyslexia_rule.hard_max


def test_adhd_requires_alternation():
    rule = get_rhythm_rule("adhd", 1)
    assert rule.alternation_required is True


def test_dyslexia_does_not_require_alternation():
    rule = get_rhythm_rule("dyslexia", 1)
    assert rule.alternation_required is False


def test_autism_has_consistency_band():
    rule = get_rhythm_rule("autism", 1)
    assert rule.consistency_band is not None
    assert rule.consistency_band > 0


def test_comorbid_rule_is_stricter_than_either_single():
    dyslexia = get_rhythm_rule("dyslexia", 1)
    id_rule = get_rhythm_rule("intellectual_disability", 1)
    comorbid = get_rhythm_rule("dyslexia+intellectual_disability", 1)
    assert comorbid.hard_max <= dyslexia.hard_max
    assert comorbid.hard_max <= id_rule.hard_max


def test_comorbid_order_does_not_affect_hard_max():
    ab = get_rhythm_rule("dyslexia+intellectual_disability", 1)
    ba = get_rhythm_rule("intellectual_disability+dyslexia", 1)
    assert ab.hard_max == ba.hard_max


def test_level_3_allows_longer_sentences_than_level_1():
    for profile in ["dyslexia", "adhd", "autism", "intellectual_disability"]:
        l1 = get_rhythm_rule(profile, 1)
        l3 = get_rhythm_rule(profile, 3)
        if l1.hard_max and l3.hard_max:
            assert l3.hard_max >= l1.hard_max, (
                f"{profile}: L3 should allow longer sentences than L1"
            )


# ---------------------------------------------------------------------------
# analyse_rhythm — dyslexia profile
# ---------------------------------------------------------------------------

def test_dyslexia_good_text_scores_1_0():
    result = analyse_rhythm("Test", DYSLEXIA_GOOD_L1, "dyslexia", 1)
    assert result["score"] == 1.0
    assert len(result["violations"]) == 0


def test_dyslexia_bad_text_score_below_1():
    result = analyse_rhythm("Test", DYSLEXIA_BAD_L1, "dyslexia", 1)
    assert result["score"] < 1.0


def test_dyslexia_violation_mentions_sentence_number():
    result = analyse_rhythm("Test", DYSLEXIA_BAD_L1, "dyslexia", 1)
    assert any("sentence" in v.lower() for v in result["violations"])


def test_dyslexia_violation_mentions_word_count():
    result = analyse_rhythm("Test", DYSLEXIA_BAD_L1, "dyslexia", 1)
    assert any("words" in v for v in result["violations"])


def test_dyslexia_violation_shows_sentence_preview():
    result = analyse_rhythm("Test", DYSLEXIA_BAD_L1, "dyslexia", 1)
    # "The process by which green plants convert" is within the first 70 chars
    assert any("process by which" in v.lower() for v in result["violations"])


def test_dyslexia_l2_allows_12_words():
    twelve_word = (
        "The water cycle is the process by which water moves through Earth. "
        "Plants need both sunlight and water to produce energy through photosynthesis. "
        "Rain falls down and collects in rivers, lakes, and the ocean."
    )
    result = analyse_rhythm("Test", twelve_word, "dyslexia", 2)
    assert result["score"] == 1.0


# ---------------------------------------------------------------------------
# analyse_rhythm — adhd profile
# ---------------------------------------------------------------------------

def test_adhd_good_alternation_scores_well():
    result = analyse_rhythm("Test", ADHD_GOOD_L1, "adhd", 1)
    assert result["score"] >= 0.6


def test_adhd_uniform_medium_penalised():
    result = analyse_rhythm("Test", ADHD_BAD_L1, "adhd", 1)
    # Uniform medium-length sentences should score lower than good alternation
    good_result = analyse_rhythm("Test", ADHD_GOOD_L1, "adhd", 1)
    assert result["score"] <= good_result["score"]


def test_adhd_result_contains_rule_description():
    result = analyse_rhythm("Test", ADHD_GOOD_L1, "adhd", 1)
    assert "ADHD" in result["profile_rule"]
    assert "alternate" in result["profile_rule"].lower()


def test_adhd_run_of_three_generates_violation():
    # Three consecutive short sentences should flag alternation violation
    three_short = (
        "Plants need sun. "
        "Water is good. "
        "Roots grow down. "
        "This is how plants absorb the water and nutrients they need to survive."
    )
    result = analyse_rhythm("Test", three_short, "adhd", 1)
    alternation_violations = [v for v in result["violations"] if "alternation" in v.lower() or "consecutive" in v.lower()]
    assert len(alternation_violations) > 0


# ---------------------------------------------------------------------------
# analyse_rhythm — autism profile
# ---------------------------------------------------------------------------

def test_autism_consistent_text_scores_well():
    result = analyse_rhythm("Test", AUTISM_GOOD_L1, "autism", 1)
    assert result["score"] >= 0.6


def test_autism_dramatic_variation_penalised():
    result = analyse_rhythm("Test", AUTISM_BAD_L1, "autism", 1)
    assert result["score"] < 1.0


def test_autism_violation_mentions_variance():
    result = analyse_rhythm("Test", AUTISM_BAD_L1, "autism", 1)
    variance_violations = [v for v in result["violations"] if "varies" in v.lower() or "variance" in v.lower() or "vary" in v.lower()]
    assert len(variance_violations) > 0


def test_autism_violation_mentions_consistency():
    result = analyse_rhythm("Test", AUTISM_BAD_L1, "autism", 1)
    consistency_violations = [v for v in result["violations"] if "consistent" in v.lower() or "predictab" in v.lower()]
    assert len(consistency_violations) > 0


# ---------------------------------------------------------------------------
# analyse_rhythm — intellectual disability profile
# ---------------------------------------------------------------------------

def test_id_good_text_scores_1_0():
    result = analyse_rhythm("Test", ID_GOOD_L1, "intellectual_disability", 1)
    assert result["score"] == 1.0
    assert len(result["violations"]) == 0


def test_id_bad_text_generates_violations():
    result = analyse_rhythm("Test", ID_BAD_L1, "intellectual_disability", 1)
    assert result["score"] < 1.0
    assert len(result["violations"]) > 0


def test_id_violation_count_matches_bad_sentences():
    result = analyse_rhythm("Test", ID_BAD_L1, "intellectual_disability", 1)
    # ID_BAD_L1: sentence 1 = 8 words (passes), sentences 2/3/4 exceed 8 words
    assert len(result["violations"]) == 3


def test_id_score_is_zero_when_all_sentences_fail():
    all_long = (
        "The biochemical process of photosynthesis in plant cells is complex. "
        "Chloroplasts contain the green pigment called chlorophyll that absorbs sunlight. "
        "Carbon dioxide enters the leaf through tiny pores called stomata on the surface."
    )
    result = analyse_rhythm("Test", all_long, "intellectual_disability", 1)
    assert result["score"] == 0.0


# ---------------------------------------------------------------------------
# analyse_rhythm — general behaviour
# ---------------------------------------------------------------------------

def test_single_sentence_returns_perfect_score():
    """Single-sentence sections cannot be rhythm-checked — return 1.0."""
    result = analyse_rhythm("Test", "Plants need sun.", "dyslexia", 1)
    assert result["score"] == 1.0
    assert len(result["violations"]) == 0


def test_score_is_float_between_0_and_1():
    for profile in ["dyslexia", "adhd", "autism", "intellectual_disability"]:
        result = analyse_rhythm("Test", DYSLEXIA_BAD_L1, profile, 1)
        assert 0.0 <= result["score"] <= 1.0, (
            f"Score out of range for {profile}: {result['score']}"
        )


def test_violations_are_strings():
    result = analyse_rhythm("Test", DYSLEXIA_BAD_L1, "dyslexia", 1)
    assert all(isinstance(v, str) for v in result["violations"])


def test_result_always_contains_profile_rule():
    result = analyse_rhythm("Test", ID_GOOD_L1, "intellectual_disability", 1)
    assert "profile_rule" in result
    assert len(result["profile_rule"]) > 0


# ---------------------------------------------------------------------------
# Stage 4 integration — measure_readability with rhythm
# ---------------------------------------------------------------------------

def test_rhythm_score_attached_to_sections():
    lesson = make_lesson(DYSLEXIA_GOOD_L1)
    ctx = make_context(["dyslexia"], language_level=1)
    result = measure_readability(lesson, ctx)
    for section in result.sections:
        assert section.rhythm_score is not None
        assert 0.0 <= section.rhythm_score <= 1.0


def test_rhythm_attached_inside_readability_object():
    lesson = make_lesson(DYSLEXIA_GOOD_L1)
    ctx = make_context(["dyslexia"], language_level=1)
    result = measure_readability(lesson, ctx)
    for section in result.sections:
        assert section.readability is not None
        assert section.readability.rhythm is not None
        assert section.readability.rhythm.profile_rule != ""


def test_low_rhythm_score_adds_to_warnings():
    lesson = make_lesson(ID_BAD_L1, profile="intellectual_disability")
    ctx = make_context(["intellectual_disability"], language_level=1)
    result = measure_readability(lesson, ctx)
    rhythm_warnings = [
        w for w in result.stage_flags.readability_warnings
        if "words exceeds" in w
    ]
    assert len(rhythm_warnings) > 0


def test_good_rhythm_produces_no_rhythm_warnings():
    lesson = make_lesson(DYSLEXIA_GOOD_L1)
    ctx = make_context(["dyslexia"], language_level=1)
    result = measure_readability(lesson, ctx)
    rhythm_warnings = [
        w for w in result.stage_flags.readability_warnings
        if "words exceeds" in w or "alternation" in w.lower() or "varies" in w.lower()
    ]
    assert len(rhythm_warnings) == 0


@pytest.mark.parametrize("profile", [
    "dyslexia", "adhd", "autism", "intellectual_disability"
])
def test_rhythm_runs_for_all_profiles(profile):
    lesson = make_lesson(DYSLEXIA_GOOD_L1, profile=profile)
    ctx = make_context([profile], language_level=2)
    result = measure_readability(lesson, ctx)
    assert all(s.rhythm_score is not None for s in result.sections)


def test_rhythm_runs_for_comorbid_profile():
    lesson = make_lesson(DYSLEXIA_GOOD_L1)
    ctx = make_context(["dyslexia", "intellectual_disability"], language_level=1)
    result = measure_readability(lesson, ctx)
    assert all(s.rhythm_score is not None for s in result.sections)

