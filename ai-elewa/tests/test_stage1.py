import pytest
from models.requests import LearnerContext
from pipeline.stage1_profile import build_system_prompt, _load_profile, PROFILE_FILES


# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------

def make_context(profiles, language_level=2, content_difficulty=2, pathway_stage="Foundation"):
    return LearnerContext(
        learner_id="test-001",
        cognitive_profiles=profiles,
        language_level=language_level,
        content_difficulty=content_difficulty,
        pathway_stage=pathway_stage,
    )


# ---------------------------------------------------------------------------
# Single profile tests — all 4 profiles
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("profile", ["dyslexia", "adhd", "autism", "intellectual_disability"])
def test_single_profile_returns_nonempty_string(profile):
    ctx = make_context([profile])
    result = build_system_prompt(ctx)
    assert isinstance(result, str)
    assert len(result) > 100
    print(f"✅ {profile}: {len(result)} chars")


@pytest.mark.parametrize("profile", ["dyslexia", "adhd", "autism", "intellectual_disability"])
def test_single_profile_contains_learner_context(profile):
    ctx = make_context([profile], language_level=3, pathway_stage="Intermediate")
    result = build_system_prompt(ctx)
    assert "Language Level: 3" in result
    assert "Intermediate" in result


@pytest.mark.parametrize("profile", ["dyslexia", "adhd", "autism", "intellectual_disability"])
def test_profile_file_nonempty(profile):
    content = _load_profile(profile)
    assert len(content) > 100, f"Profile file for {profile} is too short"


# ---------------------------------------------------------------------------
# Comorbid tests
# ---------------------------------------------------------------------------

def test_comorbid_dyslexia_adhd_contains_both_profiles():
    ctx = make_context(["dyslexia", "adhd"])
    result = build_system_prompt(ctx)
    assert "DYSLEXIA" in result.upper()
    assert "ADHD" in result.upper()
    assert "profile_merged" not in result  # stage_flags not in system prompt
    assert len(result) > 200


def test_comorbid_dyslexia_adhd_contains_priority_note():
    ctx = make_context(["dyslexia", "adhd"])
    result = build_system_prompt(ctx)
    # The merge note mentions ADHD taking priority for sentence rhythm
    assert "ADHD" in result
    assert "PRIORITY" in result.upper() or "priority" in result


def test_comorbid_autism_id_contains_both_profiles():
    ctx = make_context(["autism", "intellectual_disability"])
    result = build_system_prompt(ctx)
    assert "AUTISM" in result.upper()
    assert "INTELLECTUAL_DISABILITY" in result.upper() or "INTELLECTUAL DISABILITY" in result.upper()
    assert len(result) > 200


def test_comorbid_autism_id_contains_priority_note():
    ctx = make_context(["autism", "intellectual_disability"])
    result = build_system_prompt(ctx)
    assert "restrictive" in result.lower() or "PRIORITY" in result.upper()


def test_comorbid_profile_label_in_context_block():
    ctx = make_context(["dyslexia", "adhd"])
    result = build_system_prompt(ctx)
    assert "dyslexia+adhd" in result


def test_single_profile_not_labelled_as_comorbid():
    ctx = make_context(["dyslexia"])
    result = build_system_prompt(ctx)
    assert "Comorbid" not in result

