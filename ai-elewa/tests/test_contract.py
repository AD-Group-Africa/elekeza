"""
Contract tests for the AI service wire schemas (no live AI calls).

Focused on the learner-context / quiz contract work:
- "none" CognitiveProfile acceptance (and the four SNE profiles unchanged)
- neutral profile prompt loading
- AI quiz response parsing
- adaptive-response request schema
"""
import json
from pathlib import Path
from typing import get_args

import pytest
from pydantic import ValidationError

from models.requests import (
    CognitiveProfile,
    LearnerContext,
    AdaptiveResponseRequest,
    SimplifyTextRequest,
)
from models.responses import QuizResponse, AdaptiveResponse
from pipeline.stage1_profile import build_system_prompt, PROFILE_FILES

SNE_PROFILES = ["dyslexia", "adhd", "autism", "intellectual_disability"]
ALL_PROFILES = ["none"] + SNE_PROFILES

FIXTURES = Path(__file__).parent.parent / "test_jsons"


def _context(profile: str = "none", learner_id: str = "1") -> LearnerContext:
    return LearnerContext(
        learner_id=learner_id,
        cognitive_profiles=[profile],
        language_level=2,
        content_difficulty=2,
        pathway_stage="Foundation",
    )


class TestCognitiveProfileContract:
    def test_cognitive_profile_literal_includes_none(self):
        assert "none" in get_args(CognitiveProfile)

    @pytest.mark.parametrize("profile", ALL_PROFILES)
    def test_each_profile_is_accepted_by_learner_context(self, profile):
        ctx = _context(profile)
        assert ctx.cognitive_profiles == [profile]
        assert ctx.learner_id == "1"

    def test_unknown_profile_is_rejected(self):
        with pytest.raises(ValidationError):
            _context("not_a_profile")

    def test_comorbid_pair_still_valid(self):
        ctx = LearnerContext(
            learner_id="1",
            cognitive_profiles=["dyslexia", "adhd"],
            language_level=2,
            content_difficulty=2,
            pathway_stage="Foundation",
        )
        assert ctx.cognitive_profiles == ["dyslexia", "adhd"]

    def test_request_fixture_still_validates(self):
        data = json.loads((FIXTURES / "test_request.json").read_text(encoding="utf-8"))
        req = SimplifyTextRequest(**data)
        assert req.learner_context.cognitive_profiles


class TestNeutralProfilePrompt:
    def test_none_profile_has_a_prompt_file(self):
        assert "none" in PROFILE_FILES
        path = Path(__file__).parent.parent / "prompts" / PROFILE_FILES["none"]
        assert path.exists(), f"missing neutral prompt file {path}"

    def test_neutral_prompt_loads_and_is_flagged_neutral(self):
        prompt = build_system_prompt(_context("none"))
        assert prompt.strip()
        # Neutral markers from prompts/none.txt — general clarity only.
        assert "no declared" in prompt
        assert "general clarity guidelines" in prompt
        # The neutral profile must flow through as the active profile.
        assert "Profile: none" in prompt

    @pytest.mark.parametrize("profile", SNE_PROFILES)
    def test_sne_profile_prompts_still_build(self, profile):
        prompt = build_system_prompt(_context(profile))
        assert prompt.strip()
        assert f"Profile: {profile}" in prompt


class TestQuizResponseParsing:
    def test_quiz_response_parses_new_format(self):
        data = {
            "questions": [
                {
                    "id": "q1",
                    "text": "What do plants need to make food?",
                    "options": [
                        {"id": "a", "text": "Sunlight and water"},
                        {"id": "b", "text": "Rocks"},
                        {"id": "c", "text": "Plastic"},
                        {"id": "d", "text": "Metal"},
                    ],
                    "correct_id": "a",
                    "explanation": "Plants need sunlight, water and carbon dioxide.",
                }
            ]
        }
        quiz = QuizResponse(**data)
        assert len(quiz.questions) == 1
        q = quiz.questions[0]
        assert q.id == "q1"
        assert [o.id for o in q.options] == ["a", "b", "c", "d"]
        assert q.correct_id == "a"
        assert q.explanation

    def test_quiz_response_rejects_question_missing_correct_id(self):
        with pytest.raises(ValidationError):
            QuizResponse(
                **{
                    "questions": [
                        {
                            "id": "q1",
                            "text": "Q?",
                            "options": [{"id": "a", "text": "A"}],
                            "explanation": "E",
                        }
                    ]
                }
            )

    def test_quiz_response_rejects_option_without_id(self):
        with pytest.raises(ValidationError):
            QuizResponse(
                **{
                    "questions": [
                        {
                            "id": "q1",
                            "text": "Q?",
                            "options": [{"text": "no id"}],
                            "correct_id": "a",
                            "explanation": "E",
                        }
                    ]
                }
            )


class TestAdaptiveResponseRequestSchema:
    def test_valid_request(self):
        req = AdaptiveResponseRequest(
            learner_context=_context(),
            question="What do plants use to make food?",
            selected_option="Sunlight",
            is_correct=True,
            latency_ms=2100,
        )
        assert req.is_correct is True
        assert req.latency_ms == 2100
        assert req.selected_option == "Sunlight"

    def test_adaptive_fixture_matches_schema(self):
        data = json.loads((FIXTURES / "test_adaptive_correct.json").read_text(encoding="utf-8"))
        req = AdaptiveResponseRequest(**data)
        assert req.is_correct is True
        assert req.latency_ms == 2100

    def test_negative_latency_rejected(self):
        with pytest.raises(ValidationError):
            AdaptiveResponseRequest(
                learner_context=_context(),
                question="Q?",
                selected_option="A",
                is_correct=False,
                latency_ms=-1,
            )

    def test_missing_fields_rejected(self):
        with pytest.raises(ValidationError):
            AdaptiveResponseRequest(learner_context=_context(), question="Q?")

    def test_response_model_parses_and_validates_directive(self):
        resp = AdaptiveResponse(learner_message="Great job!", directive="harder")
        assert resp.directive == "harder"
        with pytest.raises(ValidationError):
            AdaptiveResponse(learner_message="x", directive="nope")
