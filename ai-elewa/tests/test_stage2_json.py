"""
Stage 2 structured-output tests — Release Gate 3.

Prove (LLM mocked, test-only):

  1. the Stage 2 provider call carries the verified structured-output config
     (json_object response mode + bounded completion tokens)
  2. valid structured output still produces a full LessonJSON
  3. malformed JSON output remains safe (SCHEMA_INVALID, existing path)
  4. Pydantic schema validation remains the final authority
  5. the LessonJSON contract fields are unchanged

No live provider calls; no server required.
"""
import json

import pytest

import config
from models.requests import LearnerContext
from models.errors import AIServiceError, ERROR_SCHEMA_INVALID
from pipeline.stage2_simplify import simplify


def make_context(profiles=("dyslexia",)):
    return LearnerContext(
        learner_id="gate3-test",
        cognitive_profiles=list(profiles),
        language_level=2,
        content_difficulty=2,
        pathway_stage="Foundation",
    )


VALID_LESSON = {
    "title": "The Water Cycle",
    "sections": [
        {
            "heading": "Water Moves",
            "body": "The sun heats water. Water goes up into the sky.",
            "visual_hint": "diagram of water cycle",
            "reading_level": 2,
        }
    ],
    "key_terms": [{"term": "evaporation", "definition": "water turning into vapour"}],
    "estimated_minutes": 5,
    "profile": "dyslexia",
    "stage_flags": {
        "verification_triggered": False,
        "correction_applied": False,
        "profile_merged": False,
    },
}


@pytest.fixture
def captured_complete(monkeypatch):
    """Replace the Stage 2 provider call; capture kwargs; return canned text."""
    calls = {}

    async def fake_complete(**kwargs):
        calls.update(kwargs)
        return calls["_canned"]

    monkeypatch.setattr("pipeline.stage2_simplify.complete", fake_complete)
    return calls


# ---------------------------------------------------------------------------
# 1. The Stage 2 request carries the verified structured-output configuration
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_stage2_request_contains_structured_output_config(captured_complete):
    captured_complete["_canned"] = json.dumps(VALID_LESSON)

    await simplify(
        system_prompt="system prompt",
        raw_text="The water cycle text.",
        learner_context=make_context(),
    )

    extra = captured_complete.get("extra_params")
    assert extra is not None, "Stage 2 must pass extra structured-output params"
    assert extra.get("response_format") == {"type": "json_object"}
    bound = extra.get("max_completion_tokens")
    assert isinstance(bound, int) and 0 < bound <= 32768
    assert bound == config.STAGE2_MAX_COMPLETION_TOKENS


@pytest.mark.asyncio
async def test_stage2_config_bound_is_sane():
    """The bound must be a positive int large enough for a real LessonJSON."""
    assert isinstance(config.STAGE2_MAX_COMPLETION_TOKENS, int)
    assert 1024 <= config.STAGE2_MAX_COMPLETION_TOKENS <= 32768


@pytest.mark.asyncio
async def test_stage2_other_call_params_unchanged(captured_complete):
    """Model/temperature/stage/profile stay exactly as before this gate."""
    captured_complete["_canned"] = json.dumps(VALID_LESSON)

    await simplify(
        system_prompt="system prompt",
        raw_text="The water cycle text.",
        learner_context=make_context(),
    )

    assert captured_complete["model"] == config.STAGE2_MODEL
    assert captured_complete["temperature"] == config.TEMPERATURE_SIMPLIFY
    assert captured_complete["stage"] == "stage2_simplify"
    assert captured_complete["profile"] == "dyslexia"


# ---------------------------------------------------------------------------
# 2. Valid structured output still produces LessonJSON
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_valid_structured_output_produces_lessonjson(captured_complete):
    captured_complete["_canned"] = json.dumps(VALID_LESSON)

    lesson = await simplify(
        system_prompt="system prompt",
        raw_text="The water cycle text.",
        learner_context=make_context(),
    )

    assert lesson.title == "The Water Cycle"
    assert len(lesson.sections) == 1
    assert lesson.sections[0].heading == "Water Moves"
    assert lesson.sections[0].reading_level == 2
    assert lesson.key_terms[0].term == "evaporation"
    assert lesson.estimated_minutes == 5
    assert lesson.profile == "dyslexia"
    assert lesson.stage_flags.profile_merged is False
    assert lesson.stage_flags.verification_triggered is False


@pytest.mark.asyncio
async def test_fenced_json_still_parsed(captured_complete):
    """Legacy fence-wrapped output remains parseable (backward safe)."""
    captured_complete["_canned"] = "```json\n" + json.dumps(VALID_LESSON) + "\n```"

    lesson = await simplify(
        system_prompt="system prompt",
        raw_text="The water cycle text.",
        learner_context=make_context(),
    )
    assert lesson.title == "The Water Cycle"


# ---------------------------------------------------------------------------
# 3. Malformed output remains safe — existing error path
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_truncated_json_raises_schema_invalid(captured_complete):
    captured_complete["_canned"] = json.dumps(VALID_LESSON)[:120]  # cut mid-object

    with pytest.raises(AIServiceError) as exc_info:
        await simplify(
            system_prompt="system prompt",
            raw_text="The water cycle text.",
            learner_context=make_context(),
        )
    assert exc_info.value.error_response.error_code == ERROR_SCHEMA_INVALID
    assert exc_info.value.error_response.stage == "stage2_simplify"


@pytest.mark.asyncio
async def test_completely_invalid_json_raises_schema_invalid(captured_complete):
    captured_complete["_canned"] = "not json at all"

    with pytest.raises(AIServiceError) as exc_info:
        await simplify(
            system_prompt="system prompt",
            raw_text="The water cycle text.",
            learner_context=make_context(),
        )
    assert exc_info.value.error_response.error_code == ERROR_SCHEMA_INVALID


# ---------------------------------------------------------------------------
# 4. Pydantic validation remains the final authority
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_schema_violation_raises_even_in_json_mode(captured_complete):
    """Provider promised JSON, but content violates LessonJSON → must fail."""
    bad = {**VALID_LESSON}
    del bad["sections"]  # required by LessonJSON

    captured_complete["_canned"] = json.dumps(bad)

    with pytest.raises(AIServiceError) as exc_info:
        await simplify(
            system_prompt="system prompt",
            raw_text="The water cycle text.",
            learner_context=make_context(),
        )
    assert exc_info.value.error_response.error_code == ERROR_SCHEMA_INVALID
    assert "LessonJSON" in exc_info.value.error_response.message


@pytest.mark.asyncio
async def test_wrong_field_type_raises(captured_complete):
    bad = {**VALID_LESSON, "estimated_minutes": "five"}

    captured_complete["_canned"] = json.dumps(bad)

    with pytest.raises(AIServiceError) as exc_info:
        await simplify(
            system_prompt="system prompt",
            raw_text="The water cycle text.",
            learner_context=make_context(),
        )
    assert exc_info.value.error_response.error_code == ERROR_SCHEMA_INVALID


@pytest.mark.asyncio
async def test_server_overrides_model_supplied_stage_flags(captured_complete):
    """Server-side profile/stage_flags override survives the new config."""
    tampered = {
        **VALID_LESSON,
        "profile": "something_else",
        "stage_flags": {
            "verification_triggered": True,
            "correction_applied": True,
            "profile_merged": True,
        },
    }
    captured_complete["_canned"] = json.dumps(tampered)

    lesson = await simplify(
        system_prompt="system prompt",
        raw_text="The water cycle text.",
        learner_context=make_context(),
    )
    assert lesson.profile == "dyslexia"
    assert lesson.stage_flags.verification_triggered is False
    assert lesson.stage_flags.correction_applied is False
    assert lesson.stage_flags.profile_merged is False


# ---------------------------------------------------------------------------
# 5. Comorbid path unchanged
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_comorbid_profile_merge_flag_still_set(captured_complete):
    captured_complete["_canned"] = json.dumps(VALID_LESSON)

    lesson = await simplify(
        system_prompt="system prompt",
        raw_text="The water cycle text.",
        learner_context=make_context(("autism", "intellectual_disability")),
    )
    assert lesson.profile == "autism+intellectual_disability"
    assert lesson.stage_flags.profile_merged is True
