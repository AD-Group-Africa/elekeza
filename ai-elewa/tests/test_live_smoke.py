"""
Live provider smoke set — small, credential-gated, fast.

Marker: `live` (requires a running uvicorn + a REAL AI_API_KEY).
Excluded from the default selection (`pytest.ini` addopts excludes
`live_full`); run explicitly with:

    uvicorn main:app --port 8000
    pytest -m live -v -s

Deliberately minimal: these tests exist to prove the provider path, auth
gate, and structured JSON contract on every endpoint family without the
54-call volume that makes the full matrix behave as a rate-limit stress
test (see tests/test_full_pipeline.py).
"""
import os

import httpx
import pytest

pytestmark = pytest.mark.live

# Key is read from the environment (never hardcoded) — the placeholder below
# only applies when the operator has not configured a real INTERNAL_SECRET.
INTERNAL_KEY = os.environ.get("INTERNAL_SECRET", "elekeza-test-internal-key-not-a-secret")

# Target is read from the environment so the suite follows the running AI
# service port (same convention as test_edge_cases.py — audit EL-F-AIport;
# this file was missed in that pass and hardcoded :8000).
BASE_URL = os.environ.get("AI_TEST_BASE_URL", "http://localhost:8000")
AUTH_HEADER = {"X-Internal-Key": INTERNAL_KEY}
JSON_HEADER = {**AUTH_HEADER, "Content-Type": "application/json"}


def make_learner_context(profiles, language_level=2, content_difficulty=2, pathway_stage="Foundation"):
    return {
        "learner_id": "test-live-smoke",
        "cognitive_profiles": profiles,
        "language_level": language_level,
        "content_difficulty": content_difficulty,
        "pathway_stage": pathway_stage,
    }


def test_health():
    resp = httpx.get(f"{BASE_URL}/health")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}


def test_simplify_text_live():
    """One real simplify/text call — proves the full provider pipeline + LessonJSON contract."""
    payload = {
        "learner_context": make_learner_context(["dyslexia"]),
        "raw_text": (
            "The water cycle describes how water moves through the Earth's environment. "
            "Water evaporates from oceans, lakes, and rivers when heated by the sun. "
            "It rises into the atmosphere as water vapour. As it cools, it condenses "
            "into clouds. When clouds hold enough water, precipitation occurs."
        ),
    }
    resp = httpx.post(
        f"{BASE_URL}/ai/simplify/text",
        headers=JSON_HEADER,
        json=payload,
        timeout=60.0,
    )
    assert resp.status_code == 200, f"Expected 200, got {resp.status_code} — body: {resp.text[:200]}"
    data = resp.json()
    assert data.get("title"), "LessonJSON must have a title"
    assert len(data.get("sections", [])) >= 1, "LessonJSON must have at least one section"
    assert data.get("profile") == "dyslexia"
    assert data.get("stage_flags", {}).get("verification_triggered") is False


def test_quiz_generate_live():
    """One real quiz/generate call — proves structured JSON generation end-to-end."""
    lesson_json = {
        "title": "The Water Cycle",
        "sections": [
            {
                "heading": "Water Moves",
                "body": "Water moves around the Earth. The sun heats water. Water goes up into the sky.",
                "visual_hint": "diagram of water cycle",
                "reading_level": 2,
            },
            {
                "heading": "Water Falls",
                "body": "Water in the sky forms clouds. When clouds get heavy, water falls as rain. Rain fills rivers and oceans.",
                "visual_hint": "photo of rain falling",
                "reading_level": 2,
            },
        ],
        "key_terms": [
            {"term": "evaporation", "definition": "water turning into vapour and rising"},
            {"term": "precipitation", "definition": "water falling from clouds as rain or snow"},
        ],
        "estimated_minutes": 5,
        "profile": "dyslexia",
        "stage_flags": {
            "verification_triggered": False,
            "correction_applied": False,
            "profile_merged": False,
        },
    }
    payload = {
        "learner_context": make_learner_context(["dyslexia"]),
        "lesson_json": lesson_json,
        "num_questions": 2,
    }
    resp = httpx.post(
        f"{BASE_URL}/ai/quiz/generate",
        headers=JSON_HEADER,
        json=payload,
        timeout=60.0,
    )
    assert resp.status_code == 200, f"Expected 200, got {resp.status_code} — body: {resp.text[:200]}"
    data = resp.json()
    assert len(data.get("questions", [])) == 2, "quiz must return exactly the requested number of questions"
    for q in data["questions"]:
        assert len(q["options"]) == 4
        assert q["correct_id"] in {opt["id"] for opt in q["options"]}
