"""
Unit tests for visual hint standardisation — Improvement 3.

All tests are pure — no server, no API calls, no AI provider required.
Tests cover: classification, validation, rewriting, downgrading,
comorbid profiles, and Stage 4 pipeline integration.
"""

import pytest
from utils.visual_hints import (
    classify_hint,
    validate_hint_type,
    rewrite_to_concrete,
    standardise_hint,
    VALID_TYPES,
    _CONCRETE_TYPES,
)
from models.requests import LearnerContext
from models.responses import LessonJSON, Section, KeyTerm, StageFlags
from pipeline.stage4_concepts import standardise_visual_hints


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

def make_context(
    profiles: list[str],
    language_level: int = 2,
) -> LearnerContext:
    return LearnerContext(
        learner_id="test-visual-001",
        cognitive_profiles=profiles,
        language_level=language_level,
        content_difficulty=2,
        pathway_stage="Foundation",
    )


def make_lesson(sections: list[Section] | None = None) -> LessonJSON:
    return LessonJSON(
        title="Test Lesson",
        sections=sections or [
            Section(
                heading="Test Section",
                body="Plants need sunlight. They use it to make food.",
                visual_hint="diagram of the water cycle",
                reading_level=2,
            )
        ],
        key_terms=[KeyTerm(term="test", definition="a test term")],
        estimated_minutes=3,
        profile="dyslexia",
        stage_flags=StageFlags(),
    )


def make_section(heading: str, visual_hint: str | None) -> Section:
    return Section(
        heading=heading,
        body="Plants need sunlight to grow and make food.",
        visual_hint=visual_hint,
        reading_level=2,
    )


# ---------------------------------------------------------------------------
# classify_hint
# ---------------------------------------------------------------------------

class TestClassifyHint:

    def test_photo_keywords(self):
        assert classify_hint("photo of a plant in sunlight") == "photo"
        assert classify_hint("photograph of a river") == "photo"
        assert classify_hint("picture of a child reading") == "photo"

    def test_diagram_keywords(self):
        assert classify_hint("diagram of the water cycle") == "diagram"
        assert classify_hint("molecular diagram of water") == "diagram"
        assert classify_hint("labelled diagram of the heart") == "diagram"
        assert classify_hint("scientific diagram of photosynthesis") == "diagram"

    def test_illustration_keywords(self):
        assert classify_hint("illustration of a plant growing") == "illustration"
        assert classify_hint("cartoon of a friendly robot") == "illustration"
        assert classify_hint("drawing of a water drop") == "illustration"

    def test_step_diagram_keywords(self):
        assert classify_hint("step diagram showing how water evaporates") == "step_diagram"
        assert classify_hint("numbered steps of the water cycle") == "step_diagram"
        assert classify_hint("flowchart of the process") == "step_diagram"
        assert classify_hint("sequence of events in order") == "step_diagram"

    def test_comparison_keywords(self):
        assert classify_hint("comparison of hot and cold water") == "comparison"
        assert classify_hint("before and after diagram") == "comparison"
        assert classify_hint("side by side view of the two states") == "comparison"

    def test_animation_suggestion_keywords(self):
        assert classify_hint("animation of water evaporating") == "animation_suggestion"
        assert classify_hint("animated diagram of the heart beating") == "animation_suggestion"
        assert classify_hint("interactive water cycle model") == "animation_suggestion"

    def test_step_diagram_takes_priority_over_diagram(self):
        # step_diagram pattern is more specific and listed first
        assert classify_hint("step diagram showing the process") == "step_diagram"
        assert classify_hint("numbered diagram of the stages") == "step_diagram"

    def test_animation_takes_priority_over_diagram(self):
        assert classify_hint("animated diagram of photosynthesis") == "animation_suggestion"

    def test_default_when_no_pattern_matches(self):
        assert classify_hint("something completely unrelated") == "illustration"

    def test_empty_string_returns_default(self):
        assert classify_hint("") == "illustration"

    def test_none_returns_default(self):
        assert classify_hint(None) == "illustration"

    def test_classification_is_case_insensitive(self):
        assert classify_hint("PHOTO OF A PLANT") == "photo"
        assert classify_hint("Diagram Of The Heart") == "diagram"
        assert classify_hint("ANIMATION of water") == "animation_suggestion"

    def test_result_is_always_a_valid_type(self):
        hints = [
            "photo of a river", "a complex molecular structure",
            "animated sequence", "numbered steps", "side by side",
            "random words", "", "123", "a picture of something",
        ]
        for hint in hints:
            result = classify_hint(hint)
            assert result in VALID_TYPES, f"'{result}' is not a valid type for hint: '{hint}'"


# ---------------------------------------------------------------------------
# validate_hint_type
# ---------------------------------------------------------------------------

class TestValidateHintType:

    # ID profile rules
    def test_id_rejects_diagram(self):
        valid, reason = validate_hint_type("diagram", "intellectual_disability", 2)
        assert valid is False
        assert reason is not None
        assert "abstract" in reason.lower() or "concrete" in reason.lower()

    def test_id_rejects_animation_suggestion(self):
        valid, reason = validate_hint_type("animation_suggestion", "intellectual_disability", 1)
        assert valid is False

    def test_id_rejects_step_diagram(self):
        valid, reason = validate_hint_type("step_diagram", "intellectual_disability", 1)
        assert valid is False

    def test_id_rejects_comparison(self):
        valid, reason = validate_hint_type("comparison", "intellectual_disability", 2)
        assert valid is False

    def test_id_accepts_photo(self):
        valid, reason = validate_hint_type("photo", "intellectual_disability", 1)
        assert valid is True
        assert reason is None

    def test_id_accepts_illustration(self):
        valid, reason = validate_hint_type("illustration", "intellectual_disability", 2)
        assert valid is True
        assert reason is None

    # Autism profile rules
    def test_autism_rejects_animation_suggestion(self):
        valid, reason = validate_hint_type("animation_suggestion", "autism", 2)
        assert valid is False
        assert "disruptive" in reason.lower() or "motion" in reason.lower()

    def test_autism_accepts_diagram(self):
        valid, reason = validate_hint_type("diagram", "autism", 2)
        assert valid is True

    def test_autism_accepts_photo(self):
        valid, reason = validate_hint_type("photo", "autism", 1)
        assert valid is True

    def test_autism_accepts_step_diagram(self):
        valid, reason = validate_hint_type("step_diagram", "autism", 2)
        assert valid is True

    def test_autism_accepts_comparison(self):
        valid, reason = validate_hint_type("comparison", "autism", 3)
        assert valid is True

    # Dyslexia profile rules
    def test_dyslexia_l1_rejects_diagram(self):
        valid, reason = validate_hint_type("diagram", "dyslexia", 1)
        assert valid is False
        assert "abstract" in reason.lower() or "language_level 1" in reason

    def test_dyslexia_l2_accepts_diagram(self):
        valid, reason = validate_hint_type("diagram", "dyslexia", 2)
        assert valid is True

    def test_dyslexia_l3_accepts_diagram(self):
        valid, reason = validate_hint_type("diagram", "dyslexia", 3)
        assert valid is True

    def test_dyslexia_accepts_animation(self):
        valid, reason = validate_hint_type("animation_suggestion", "dyslexia", 2)
        assert valid is True

    # ADHD profile rules
    def test_adhd_accepts_all_types(self):
        for hint_type in VALID_TYPES:
            valid, reason = validate_hint_type(hint_type, "adhd", 1)
            assert valid is True, f"ADHD should accept '{hint_type}' but got: {reason}"

    # Comorbid profile rules
    def test_comorbid_dyslexia_adhd_accepts_animation(self):
        # dyslexia allows animation, adhd allows animation → comorbid allows it
        valid, _ = validate_hint_type("animation_suggestion", "dyslexia+adhd", 2)
        assert valid is True

    def test_comorbid_autism_id_rejects_animation(self):
        # Both autism and ID reject animation → comorbid rejects it
        valid, reason = validate_hint_type("animation_suggestion", "autism+intellectual_disability", 2)
        assert valid is False

    def test_comorbid_autism_id_rejects_diagram(self):
        # ID rejects diagram → comorbid rejects it
        valid, reason = validate_hint_type("diagram", "autism+intellectual_disability", 2)
        assert valid is False

    def test_comorbid_autism_id_accepts_photo(self):
        valid, _ = validate_hint_type("photo", "autism+intellectual_disability", 1)
        assert valid is True

    def test_reason_is_none_when_valid(self):
        valid, reason = validate_hint_type("photo", "dyslexia", 2)
        assert valid is True
        assert reason is None

    def test_reason_is_string_when_invalid(self):
        valid, reason = validate_hint_type("diagram", "intellectual_disability", 1)
        assert valid is False
        assert isinstance(reason, str)
        assert len(reason) > 0


# ---------------------------------------------------------------------------
# rewrite_to_concrete
# ---------------------------------------------------------------------------

class TestRewriteToConcrete:

    def test_molecular_diagram_rewritten(self):
        result = rewrite_to_concrete("molecular diagram of water")
        assert "photo" in result.lower() or "illustration" in result.lower()
        assert "molecular" not in result.lower()

    def test_photosynthesis_diagram_rewritten(self):
        result = rewrite_to_concrete("photosynthesis diagram showing chloroplasts")
        assert "plant" in result.lower() or "sunlight" in result.lower()

    def test_water_cycle_diagram_rewritten(self):
        result = rewrite_to_concrete("water cycle diagram")
        assert "rain" in result.lower() or "river" in result.lower() or "water" in result.lower()

    def test_schematic_rewritten(self):
        result = rewrite_to_concrete("schematic of the heart")
        assert "photo" in result.lower()

    def test_flowchart_rewritten(self):
        result = rewrite_to_concrete("flowchart of the digestive process")
        assert "illustration" in result.lower() or "steps" in result.lower()

    def test_generic_diagram_rewritten(self):
        result = rewrite_to_concrete("diagram of something")
        assert "photo" in result.lower()

    def test_unmatched_hint_gets_generic_fallback(self):
        result = rewrite_to_concrete("something entirely unrelated xyz123")
        assert "photo" in result.lower() or "real" in result.lower()

    def test_result_is_always_a_string(self):
        inputs = [
            "molecular diagram", "schematic", "flowchart",
            "abstract concept", "xyz", "", "graph of data",
        ]
        for hint in inputs:
            result = rewrite_to_concrete(hint)
            assert isinstance(result, str)
            assert len(result) > 0


# ---------------------------------------------------------------------------
# standardise_hint — full pipeline
# ---------------------------------------------------------------------------

class TestStandardiseHint:

    # Returns correct type for valid hints
    def test_photo_hint_returns_photo_type(self):
        hint, hint_type, warning = standardise_hint(
            "photo of a plant in sunlight", "Test", "dyslexia", 2
        )
        assert hint_type == "photo"
        assert warning is None

    def test_diagram_hint_returns_diagram_type_for_adhd(self):
        hint, hint_type, warning = standardise_hint(
            "diagram of the water cycle", "Test", "adhd", 2
        )
        assert hint_type == "diagram"
        assert warning is None

    # ID profile rewrites
    def test_id_rewrites_diagram_hint(self):
        original = "molecular diagram of water"
        hint, hint_type, warning = standardise_hint(
            original, "Test Section", "intellectual_disability", 1
        )
        assert hint != original
        assert hint_type in _CONCRETE_TYPES
        assert warning is not None
        assert "rewritten" in warning.lower()

    def test_id_rewrites_animation_hint(self):
        hint, hint_type, warning = standardise_hint(
            "animation of the water cycle", "Test", "intellectual_disability", 1
        )
        assert hint_type in _CONCRETE_TYPES
        assert warning is not None

    def test_id_keeps_photo_hint_unchanged(self):
        original = "photo of rain falling into a puddle"
        hint, hint_type, warning = standardise_hint(
            original, "Test", "intellectual_disability", 2
        )
        assert hint == original
        assert hint_type == "photo"
        assert warning is None

    def test_id_keeps_illustration_hint_unchanged(self):
        original = "illustration of a plant growing"
        hint, hint_type, warning = standardise_hint(
            original, "Test", "intellectual_disability", 1
        )
        assert hint == original
        assert hint_type == "illustration"
        assert warning is None

    # Autism profile downgrades
    def test_autism_downgrades_animation_to_illustration(self):
        hint, hint_type, warning = standardise_hint(
            "animation of the heart beating", "Test", "autism", 2
        )
        assert hint_type == "illustration"
        assert warning is not None
        assert "downgraded" in warning.lower()

    def test_autism_keeps_hint_text_when_downgrading(self):
        original = "animation of the heart beating"
        hint, hint_type, warning = standardise_hint(
            original, "Test", "autism", 2
        )
        assert hint == original  # text unchanged, only type changed
        assert hint_type == "illustration"

    def test_autism_accepts_diagram_unchanged(self):
        original = "diagram of the digestive system"
        hint, hint_type, warning = standardise_hint(
            original, "Test", "autism", 2
        )
        assert hint == original
        assert hint_type == "diagram"
        assert warning is None

    # Dyslexia L1 downgrades
    def test_dyslexia_l1_downgrades_diagram(self):
        hint, hint_type, warning = standardise_hint(
            "diagram of the water cycle", "Test", "dyslexia", 1
        )
        assert hint_type == "illustration"
        assert warning is not None
        assert "downgraded" in warning.lower()

    def test_dyslexia_l2_keeps_diagram(self):
        original = "diagram of the water cycle"
        hint, hint_type, warning = standardise_hint(
            original, "Test", "dyslexia", 2
        )
        assert hint == original
        assert hint_type == "diagram"
        assert warning is None

    # None/empty hint handling
    def test_none_hint_returns_none_type(self):
        hint, hint_type, warning = standardise_hint(None, "Test", "dyslexia", 2)
        assert hint is None
        assert hint_type is None
        assert warning is None

    def test_empty_string_hint_returns_none_type(self):
        hint, hint_type, warning = standardise_hint("", "Test", "dyslexia", 2)
        assert hint is None
        assert hint_type is None
        assert warning is None

    # Comorbid profiles
    def test_comorbid_autism_id_rewrites_diagram(self):
        hint, hint_type, warning = standardise_hint(
            "diagram of photosynthesis", "Test",
            "autism+intellectual_disability", 1
        )
        assert hint_type in _CONCRETE_TYPES
        assert warning is not None

    def test_comorbid_dyslexia_adhd_accepts_animation(self):
        hint, hint_type, warning = standardise_hint(
            "animation of the water cycle", "Test",
            "dyslexia+adhd", 2
        )
        assert hint_type == "animation_suggestion"
        assert warning is None

    # Warning format
    def test_warning_contains_section_heading(self):
        _, _, warning = standardise_hint(
            "molecular diagram", "My Section", "intellectual_disability", 1
        )
        assert "My Section" in warning

    def test_warning_contains_original_hint_preview(self):
        _, _, warning = standardise_hint(
            "molecular diagram of water", "Test", "intellectual_disability", 1
        )
        assert "molecular diagram" in warning.lower()


# ---------------------------------------------------------------------------
# standardise_visual_hints — Stage 4 integration
# ---------------------------------------------------------------------------

class TestStandardiseVisualHintsStage4:

    def test_hint_type_attached_to_all_sections(self):
        lesson = make_lesson([
            make_section("Section 1", "photo of a plant"),
            make_section("Section 2", "diagram of the water cycle"),
        ])
        ctx = make_context(["adhd"])
        result = standardise_visual_hints(lesson, ctx)
        for section in result.sections:
            assert section.visual_hint_type is not None

    def test_correct_types_assigned(self):
        lesson = make_lesson([
            make_section("S1", "photo of a river"),
            make_section("S2", "diagram of the water cycle"),
            make_section("S3", "animation of rain falling"),
        ])
        ctx = make_context(["adhd"])
        result = standardise_visual_hints(lesson, ctx)
        assert result.sections[0].visual_hint_type == "photo"
        assert result.sections[1].visual_hint_type == "diagram"
        assert result.sections[2].visual_hint_type == "animation_suggestion"

    def test_id_profile_rewrites_abstract_hints(self):
        lesson = make_lesson([
            make_section("S1", "molecular diagram of water"),
            make_section("S2", "photo of rain falling"),
        ])
        ctx = make_context(["intellectual_disability"], language_level=1)
        result = standardise_visual_hints(lesson, ctx)
        assert result.sections[0].visual_hint_type in _CONCRETE_TYPES
        assert result.sections[1].visual_hint_type == "photo"

    def test_id_profile_adds_warnings_for_rewrites(self):
        lesson = make_lesson([
            make_section("Complex Section", "molecular diagram of photosynthesis"),
        ])
        ctx = make_context(["intellectual_disability"], language_level=1)
        result = standardise_visual_hints(lesson, ctx)
        rewrite_warnings = [
            w for w in result.stage_flags.readability_warnings
            if "rewritten" in w.lower()
        ]
        assert len(rewrite_warnings) > 0

    def test_autism_downgrades_animation_in_all_sections(self):
        lesson = make_lesson([
            make_section("S1", "animation of the heart beating"),
            make_section("S2", "animated diagram of photosynthesis"),
        ])
        ctx = make_context(["autism"])
        result = standardise_visual_hints(lesson, ctx)
        for section in result.sections:
            assert section.visual_hint_type != "animation_suggestion"

    def test_autism_adds_warnings_for_downgrades(self):
        lesson = make_lesson([
            make_section("My Section", "animation of rain falling"),
        ])
        ctx = make_context(["autism"])
        result = standardise_visual_hints(lesson, ctx)
        downgrade_warnings = [
            w for w in result.stage_flags.readability_warnings
            if "downgraded" in w.lower()
        ]
        assert len(downgrade_warnings) > 0

    def test_none_hint_sections_handled_gracefully(self):
        lesson = make_lesson([
            make_section("S1", None),
            make_section("S2", "photo of a river"),
        ])
        ctx = make_context(["dyslexia"])
        result = standardise_visual_hints(lesson, ctx)
        assert result.sections[0].visual_hint_type is None
        assert result.sections[1].visual_hint_type == "photo"

    def test_no_warnings_when_all_hints_valid(self):
        lesson = make_lesson([
            make_section("S1", "photo of a plant in sunlight"),
            make_section("S2", "illustration of a water drop"),
        ])
        ctx = make_context(["intellectual_disability"], language_level=1)
        result = standardise_visual_hints(lesson, ctx)
        hint_warnings = [
            w for w in result.stage_flags.readability_warnings
            if "rewritten" in w.lower() or "downgraded" in w.lower()
        ]
        assert len(hint_warnings) == 0

    def test_warnings_appended_to_existing_stage_flags(self):
        """Visual hint warnings must not overwrite existing readability warnings."""
        lesson = make_lesson([
            make_section("S1", "molecular diagram of water"),
        ])
        ctx = make_context(["intellectual_disability"], language_level=1)
        # Pre-populate an existing warning
        lesson.stage_flags.readability_warnings = ["Pre-existing readability warning."]
        result = standardise_visual_hints(lesson, ctx)
        assert "Pre-existing readability warning." in result.stage_flags.readability_warnings
        assert len(result.stage_flags.readability_warnings) > 1

    @pytest.mark.parametrize("profile", [
        "dyslexia", "adhd", "autism", "intellectual_disability"
    ])
    def test_runs_for_all_single_profiles(self, profile):
        lesson = make_lesson([make_section("Test", "diagram of the water cycle")])
        ctx = make_context([profile], language_level=2)
        result = standardise_visual_hints(lesson, ctx)
        for section in result.sections:
            assert section.visual_hint_type in VALID_TYPES or section.visual_hint_type is None

    def test_runs_for_comorbid_profile(self):
        lesson = make_lesson([make_section("Test", "diagram of the heart")])
        ctx = make_context(["autism", "intellectual_disability"], language_level=1)
        result = standardise_visual_hints(lesson, ctx)
        assert result.sections[0].visual_hint_type in _CONCRETE_TYPES

