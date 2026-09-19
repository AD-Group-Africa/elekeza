import pytest
from unittest.mock import AsyncMock, patch
from models.requests import LearnerContext
from models.responses import (
    LessonJSON, Section, KeyTerm, StageFlags,
    ReadabilityScore, RhythmScore, ReadabilitySummary,
)
from pipeline.stage3b_readability import (
    _is_flagged,
    _get_grade_targets,
    apply_readability_corrections,
    CORRECTION_THRESHOLD_GRADES,
)


def make_context(profiles: list[str], language_level: int = 1) -> LearnerContext:
    return LearnerContext(
        learner_id="test-001",
        cognitive_profiles=profiles,
        language_level=language_level,
        content_difficulty=1,
        pathway_stage="Foundation",
    )


def make_readability(fk_grade: float, flesch: float = 75.0) -> ReadabilityScore:
    return ReadabilityScore(
        flesch_reading_ease=flesch,
        flesch_kincaid_grade=fk_grade,
        smog_grade=fk_grade + 0.5,
        rhythm=RhythmScore(score=1.0, profile_rule="test rule", violations=[]),
    )


def make_section(
    heading: str = "Water Moves",
    body: str = "Water moves up. It falls down.",
    fk_grade: float = 3.0,
) -> Section:
    return Section(
        heading=heading,
        body=body,
        visual_hint="photo",
        reading_level=1,
        readability=make_readability(fk_grade),
        rhythm_score=1.0,
    )


def make_lesson(sections: list[Section] = None, profile: str = "dyslexia") -> LessonJSON:
    if sections is None:
        sections = [make_section()]
    return LessonJSON(
        title="Test Lesson",
        sections=sections,
        key_terms=[KeyTerm(term="water", definition="a liquid")],
        estimated_minutes=3,
        profile=profile,
        stage_flags=StageFlags(
            readability_warnings=["existing warning"]
        ),
        readability_summary=ReadabilitySummary(
            avg_flesch_reading_ease=75.0,
            avg_flesch_kincaid_grade=3.0,
            avg_smog_grade=3.5,
            within_target=True,
            target_flesch_min=60.0,
            target_flesch_max=80.0,
        ),
    )


# ---------------------------------------------------------------------------
# _is_flagged
# ---------------------------------------------------------------------------

def test_section_within_range_is_not_flagged():
    assert _is_flagged(fk_grade=2.0, min_grade=1.0, max_grade=3.0) is False


def test_section_slightly_over_is_not_flagged():
    assert _is_flagged(fk_grade=3.5, min_grade=1.0, max_grade=3.0) is False


def test_section_more_than_threshold_over_is_flagged():
    assert _is_flagged(fk_grade=4.5, min_grade=1.0, max_grade=3.0) is True


def test_section_exactly_at_threshold_is_not_flagged():
    assert _is_flagged(fk_grade=4.0, min_grade=1.0, max_grade=3.0) is False


def test_section_too_simple_is_flagged():
    assert _is_flagged(fk_grade=0.0, min_grade=2.0, max_grade=4.0) is True


def test_section_at_upper_boundary_is_not_flagged():
    assert _is_flagged(fk_grade=3.0, min_grade=1.0, max_grade=3.0) is False


# ---------------------------------------------------------------------------
# _get_grade_targets
# ---------------------------------------------------------------------------

def test_get_grade_targets_returns_tuple_of_floats():
    min_g, max_g = _get_grade_targets("dyslexia", 1)
    assert isinstance(min_g, float)
    assert isinstance(max_g, float)


def test_get_grade_targets_min_less_than_max():
    for profile in ["dyslexia", "adhd", "autism", "intellectual_disability"]:
        for level in [1, 2, 3]:
            min_g, max_g = _get_grade_targets(profile, level)
            assert min_g < max_g


def test_id_grade_target_strictest_at_level_1():
    id_min, id_max = _get_grade_targets("intellectual_disability", 1)
    dys_min, dys_max = _get_grade_targets("dyslexia", 1)
    assert id_max <= dys_max


# ---------------------------------------------------------------------------
# No flagged sections — common case
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_no_flagged_sections_returns_lesson_unchanged():
    lesson = make_lesson([make_section(fk_grade=3.0)])
    ctx = make_context(["dyslexia"], language_level=1)
    with patch("pipeline.stage3b_readability.complete") as mock_complete:
        result = await apply_readability_corrections(lesson, ctx)
    mock_complete.assert_not_called()
    assert result.sections[0].body == lesson.sections[0].body


@pytest.mark.asyncio
async def test_no_flagged_sections_correction_applied_is_false():
    lesson = make_lesson([make_section(fk_grade=3.0)])
    ctx = make_context(["dyslexia"], language_level=1)
    with patch("pipeline.stage3b_readability.complete"):
        result = await apply_readability_corrections(lesson, ctx)
    assert result.stage_flags.readability_correction_applied is False


@pytest.mark.asyncio
async def test_no_flagged_sections_existing_warnings_preserved():
    lesson = make_lesson([make_section(fk_grade=3.0)])
    ctx = make_context(["dyslexia"], language_level=1)
    with patch("pipeline.stage3b_readability.complete"):
        result = await apply_readability_corrections(lesson, ctx)
    assert "existing warning" in result.stage_flags.readability_warnings


# ---------------------------------------------------------------------------
# Flagged section — rewrite accepted
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_flagged_section_ai_is_called():
    section = make_section(
        body="The biochemical mechanism of photosynthesis is exceedingly complex.",
        fk_grade=12.0,
    )
    lesson = make_lesson([section], profile="intellectual_disability")
    ctx = make_context(["intellectual_disability"], language_level=1)
    with patch("pipeline.stage3b_readability.complete", new_callable=AsyncMock) as mock:
        mock.return_value = "Plants need sun. Sun helps plants grow."
        await apply_readability_corrections(lesson, ctx)
    mock.assert_called_once()


@pytest.mark.asyncio
async def test_rewrite_accepted_when_improved():
    section = make_section(
        body="The biochemical mechanism of photosynthesis is exceedingly complex.",
        fk_grade=12.0,
    )
    lesson = make_lesson([section], profile="intellectual_disability")
    ctx = make_context(["intellectual_disability"], language_level=1)
    simple_rewrite = "Plants need sun. Sun helps plants grow. Water helps too."
    with patch("pipeline.stage3b_readability.complete", new_callable=AsyncMock) as mock:
        mock.return_value = simple_rewrite
        result = await apply_readability_corrections(lesson, ctx)
    assert result.sections[0].body == simple_rewrite


@pytest.mark.asyncio
async def test_correction_applied_true_when_rewrite_accepted():
    section = make_section(
        body="The biochemical mechanism of photosynthesis is exceedingly complex.",
        fk_grade=12.0,
    )
    lesson = make_lesson([section], profile="intellectual_disability")
    ctx = make_context(["intellectual_disability"], language_level=1)
    with patch("pipeline.stage3b_readability.complete", new_callable=AsyncMock) as mock:
        mock.return_value = "Plants need sun. Sun helps plants grow. Water helps too."
        result = await apply_readability_corrections(lesson, ctx)
    assert result.stage_flags.readability_correction_applied is True


@pytest.mark.asyncio
async def test_rewrite_adds_log_to_warnings():
    section = make_section(
        body="The biochemical mechanism of photosynthesis is exceedingly complex.",
        fk_grade=12.0,
    )
    lesson = make_lesson([section], profile="intellectual_disability")
    ctx = make_context(["intellectual_disability"], language_level=1)
    with patch("pipeline.stage3b_readability.complete", new_callable=AsyncMock) as mock:
        mock.return_value = "Plants need sun. Sun helps plants grow. Water helps too."
        result = await apply_readability_corrections(lesson, ctx)
    stage3b_warnings = [w for w in result.stage_flags.readability_warnings if "Stage 3b" in w]
    assert len(stage3b_warnings) >= 1


# ---------------------------------------------------------------------------
# Flagged section — rewrite rejected
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_rewrite_rejected_when_not_improved():
    original_body = "The biochemical mechanism is complex and multifaceted throughout."
    section = make_section(body=original_body, fk_grade=11.8)
    lesson = make_lesson([section], profile="intellectual_disability")
    ctx = make_context(["intellectual_disability"], language_level=1)
    no_improvement = "The intricate biochemical process remains complex and multifaceted still."
    with patch("pipeline.stage3b_readability.complete", new_callable=AsyncMock) as mock_complete, \
         patch("pipeline.stage3b_readability.measure_section", return_value={
             "flesch_reading_ease": 10.0,
             "flesch_kincaid_grade": 11.8,
             "smog_grade": 12.1,
         }):
        mock_complete.return_value = no_improvement
        result = await apply_readability_corrections(lesson, ctx)
    assert result.sections[0].body == original_body


@pytest.mark.asyncio
async def test_correction_applied_false_when_rewrite_rejected():
    original_body = "The biochemical mechanism is complex and multifaceted throughout."
    section = make_section(body=original_body, fk_grade=11.8)
    lesson = make_lesson([section], profile="intellectual_disability")
    ctx = make_context(["intellectual_disability"], language_level=1)
    no_improvement = "The intricate biochemical process remains complex and multifaceted still."
    with patch("pipeline.stage3b_readability.complete", new_callable=AsyncMock) as mock_complete, \
         patch("pipeline.stage3b_readability.measure_section", return_value={
             "flesch_reading_ease": 10.0,
             "flesch_kincaid_grade": 11.8,
             "smog_grade": 12.1,
         }):
        mock_complete.return_value = no_improvement
        result = await apply_readability_corrections(lesson, ctx)
    assert result.stage_flags.readability_correction_applied is False

@pytest.mark.asyncio
async def test_rejected_rewrite_still_logged():
    original_body = "The biochemical mechanism is complex and multifaceted throughout."
    section = make_section(body=original_body, fk_grade=12.0)
    lesson = make_lesson([section], profile="intellectual_disability")
    ctx = make_context(["intellectual_disability"], language_level=1)
    no_improvement = "The intricate biochemical process remains complex and multifaceted still."
    with patch("pipeline.stage3b_readability.complete", new_callable=AsyncMock) as mock_complete, \
         patch("pipeline.stage3b_readability.measure_section", return_value={
             "flesch_reading_ease": 10.0,
             "flesch_kincaid_grade": 11.8,
             "smog_grade": 12.1,
         }):
        mock_complete.return_value = no_improvement
        result = await apply_readability_corrections(lesson, ctx)
    stage3b_warnings = [w for w in result.stage_flags.readability_warnings if "Stage 3b" in w]
    assert len(stage3b_warnings) >= 1

# ---------------------------------------------------------------------------
# Edge cases
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_empty_rewrite_keeps_original():
    section = make_section(
        body="The biochemical mechanism of photosynthesis is exceedingly complex.",
        fk_grade=12.0,
    )
    lesson = make_lesson([section], profile="intellectual_disability")
    ctx = make_context(["intellectual_disability"], language_level=1)
    with patch("pipeline.stage3b_readability.complete", new_callable=AsyncMock) as mock:
        mock.return_value = ""
        result = await apply_readability_corrections(lesson, ctx)
    assert result.sections[0].body == section.body
    assert result.stage_flags.readability_correction_applied is False


@pytest.mark.asyncio
async def test_whitespace_rewrite_keeps_original():
    section = make_section(
        body="The biochemical mechanism of photosynthesis is exceedingly complex.",
        fk_grade=12.0,
    )
    lesson = make_lesson([section], profile="intellectual_disability")
    ctx = make_context(["intellectual_disability"], language_level=1)
    with patch("pipeline.stage3b_readability.complete", new_callable=AsyncMock) as mock:
        mock.return_value = "   \n\n  "
        result = await apply_readability_corrections(lesson, ctx)
    assert result.sections[0].body == section.body


@pytest.mark.asyncio
async def test_section_without_readability_is_skipped():
    section = Section(
        heading="No Scores",
        body="Some body text here.",
        visual_hint=None,
        reading_level=1,
        readability=None,
        rhythm_score=None,
    )
    lesson = make_lesson([section])
    ctx = make_context(["intellectual_disability"], language_level=1)
    with patch("pipeline.stage3b_readability.complete") as mock:
        result = await apply_readability_corrections(lesson, ctx)
    mock.assert_not_called()
    assert result.sections[0].body == section.body


@pytest.mark.asyncio
async def test_multiple_flagged_sections_all_attempted():
    sections = [
        make_section(heading="S1", body="The biochemical mechanism is exceedingly complex.", fk_grade=12.0),
        make_section(heading="S2", body="The intricate process involves elaborate biochemical pathways.", fk_grade=11.5),
    ]
    lesson = make_lesson(sections, profile="intellectual_disability")
    ctx = make_context(["intellectual_disability"], language_level=1)
    with patch("pipeline.stage3b_readability.complete", new_callable=AsyncMock) as mock:
        mock.return_value = "Plants need sun. Sun helps plants grow. Water helps too."
        result = await apply_readability_corrections(lesson, ctx)
    assert mock.call_count == 2


@pytest.mark.asyncio
async def test_only_flagged_sections_corrected():
    sections = [
        make_section(heading="Good", body="Plants need sun.", fk_grade=2.0),
        make_section(heading="Hard", body="The intricate biochemical process is complex.", fk_grade=12.0),
    ]
    lesson = make_lesson(sections, profile="intellectual_disability")
    ctx = make_context(["intellectual_disability"], language_level=1)
    with patch("pipeline.stage3b_readability.complete", new_callable=AsyncMock) as mock:
        mock.return_value = "Plants need sun. Sun helps plants grow."
        result = await apply_readability_corrections(lesson, ctx)
    assert result.sections[0].body == "Plants need sun."
    assert result.sections[1].body == "Plants need sun. Sun helps plants grow."
    mock.assert_called_once()


@pytest.mark.asyncio
async def test_existing_warnings_preserved_after_correction():
    section = make_section(
        body="The biochemical mechanism of photosynthesis is exceedingly complex.",
        fk_grade=12.0,
    )
    lesson = make_lesson([section], profile="intellectual_disability")
    original_count = len(lesson.stage_flags.readability_warnings)
    ctx = make_context(["intellectual_disability"], language_level=1)
    with patch("pipeline.stage3b_readability.complete", new_callable=AsyncMock) as mock:
        mock.return_value = "Plants need sun. Sun helps plants grow."
        result = await apply_readability_corrections(lesson, ctx)
    assert len(result.stage_flags.readability_warnings) > original_count


@pytest.mark.asyncio
async def test_comorbid_profile_runs_without_error():
    section = make_section(
        body="The biochemical mechanism of photosynthesis is exceedingly complex.",
        fk_grade=7.0,
    )
    lesson = make_lesson([section])
    ctx = make_context(["dyslexia", "intellectual_disability"], language_level=1)
    with patch("pipeline.stage3b_readability.complete", new_callable=AsyncMock) as mock:
        mock.return_value = "Plants need sun. Sun helps plants grow."
        result = await apply_readability_corrections(lesson, ctx)
    assert result is not None
    assert isinstance(result.stage_flags.readability_correction_applied, bool)


# ---------------------------------------------------------------------------
# StageFlags field
# ---------------------------------------------------------------------------

def test_stage_flags_has_field():
    flags = StageFlags()
    assert hasattr(flags, "readability_correction_applied")


def test_stage_flags_defaults_to_false():
    flags = StageFlags()
    assert flags.readability_correction_applied is False


def test_stage_flags_can_be_set_true():
    flags = StageFlags(readability_correction_applied=True)
    assert flags.readability_correction_applied is True