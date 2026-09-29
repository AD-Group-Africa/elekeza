"""
Endpoint-level tests for the deterministic adaptive directive — Release Gate 2.

Proves, with the LLM mocked (test-only — no mocks in production code):

  A. the returned directive equals compute_directive(...) for representative
     correct/incorrect x fast/slow cases
  B. the LLM cannot override the directive — conflicting, omitted, or
     garbage LLM directives never reach the response
  C. the learner_message still comes from the LLM and is returned unchanged
  D. the API contract (AdaptiveResponse shape) remains exactly the same

Uses FastAPI TestClient against the real app, so routing, request parsing,
and response serialization are exercised — no live server, no provider calls.
"""
import json
import os

import pytest
from fastapi.testclient import TestClient

import main
from utils.adaptive_rules import compute_directive, get_adaptive_rule

client = TestClient(main.app)

# security.py loads .env at import time (before this module can patch it), so
# the app's in-process secret comes from the operator environment. Use it for
# in-process authentication; never printed, never asserted on, never modified.
AUTH = {"X-Internal-Key": os.environ["INTERNAL_SECRET"]}
JSON_AUTH = {**AUTH, "Content-Type": "application/json"}

BASE_PAYLOAD = {
    "learner_context": {
        "learner_id": "gate2-test",
        "cognitive_profiles": ["dyslexia"],
        "language_level": 2,
        "content_difficulty": 2,
        "pathway_stage": "Foundation",
    },
    "question": "What happens to water when the sun heats it?",
    "selected_option": "It evaporates",
    "is_correct": True,
    "latency_ms": 2000,
}

VALID_LLM_JSON = json.dumps({"learner_message": "Great job! Water becomes vapour."})


def _mock_llm(monkeypatch, llm_body: str):
    """Replace the provider call with a canned response (test-only)."""

    async def fake_complete(**kwargs):
        return llm_body

    monkeypatch.setattr("endpoints.quiz.complete", fake_complete)


def _post(payload):
    return client.post("/ai/quiz/adaptive-response", headers=JSON_AUTH, json=payload)


# ---------------------------------------------------------------------------
# A. Deterministic directive — response equals compute_directive(...)
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("is_correct,latency_ms", [
    (True, 2000),    # correct + fast
    (True, 8000),    # correct + slow
    (False, 2000),   # wrong + fast
    (False, 8000),   # wrong + slow
])
def test_directive_equals_compute_directive(monkeypatch, is_correct, latency_ms):
    _mock_llm(monkeypatch, VALID_LLM_JSON)

    payload = {**BASE_PAYLOAD, "is_correct": is_correct, "latency_ms": latency_ms}
    resp = _post(payload)

    assert resp.status_code == 200, resp.text
    data = resp.json()

    rule = get_adaptive_rule("dyslexia")
    expected = compute_directive(is_correct=is_correct, latency_ms=latency_ms, rule=rule)
    assert data["directive"] == expected


# ---------------------------------------------------------------------------
# B. The LLM cannot override the directive
# ---------------------------------------------------------------------------

def test_llm_conflicting_directive_is_ignored(monkeypatch):
    """LLM says 'harder'; the deterministic computation says 'revisit'."""
    _mock_llm(monkeypatch, json.dumps({
        "learner_message": "Let us look at this again.",
        "directive": "harder",  # deliberately conflicting
    }))

    payload = {**BASE_PAYLOAD, "is_correct": False, "latency_ms": 3000}
    resp = _post(payload)

    assert resp.status_code == 200, resp.text
    data = resp.json()
    rule = get_adaptive_rule("dyslexia")
    assert data["directive"] == compute_directive(False, 3000, rule)
    assert data["directive"] == "revisit"
    assert data["directive"] != "harder"


def test_llm_omitted_directive_is_fine(monkeypatch):
    """With the prompt no longer asking for a directive, its absence must not fail."""
    _mock_llm(monkeypatch, json.dumps({"learner_message": "Well done!"}))

    resp = _post(BASE_PAYLOAD)
    assert resp.status_code == 200, resp.text
    data = resp.json()
    rule = get_adaptive_rule("dyslexia")
    assert data["directive"] == compute_directive(True, 2000, rule)


def test_llm_garbage_directive_field_is_ignored(monkeypatch):
    _mock_llm(monkeypatch, json.dumps({
        "learner_message": "Nice work!",
        "directive": None,
        "extra_junk": {"nested": True},
    }))

    resp = _post(BASE_PAYLOAD)
    assert resp.status_code == 200, resp.text
    data = resp.json()
    rule = get_adaptive_rule("dyslexia")
    assert data["directive"] == compute_directive(True, 2000, rule)


def test_llm_invalid_json_still_errors_but_directive_logic_unchanged(monkeypatch):
    """A broken LLM payload still surfaces the existing SCHEMA_INVALID error path."""
    _mock_llm(monkeypatch, "this is not json at all")

    resp = _post(BASE_PAYLOAD)
    assert resp.status_code == 422
    body = resp.json()
    assert body.get("error_code") == "SCHEMA_INVALID"
    assert "learner_message" in body.get("message", "").lower() or "json" in body.get("message", "").lower()


# ---------------------------------------------------------------------------
# C. Learner message still comes from the LLM, unchanged
# ---------------------------------------------------------------------------

def test_learner_message_passes_through_from_llm(monkeypatch):
    custom_message = "You remembered how the sun lifts water. Great thinking!"
    _mock_llm(monkeypatch, json.dumps({"learner_message": custom_message}))

    resp = _post(BASE_PAYLOAD)
    assert resp.status_code == 200
    data = resp.json()
    assert data["learner_message"] == custom_message


def test_empty_llm_message_is_rejected(monkeypatch):
    _mock_llm(monkeypatch, json.dumps({"learner_message": "   "}))

    resp = _post(BASE_PAYLOAD)
    assert resp.status_code == 422
    assert resp.json().get("error_code") == "SCHEMA_INVALID"


# ---------------------------------------------------------------------------
# D. API contract unchanged
# ---------------------------------------------------------------------------

def test_response_contract_unchanged(monkeypatch):
    _mock_llm(monkeypatch, VALID_LLM_JSON)

    resp = _post(BASE_PAYLOAD)
    assert resp.status_code == 200
    data = resp.json()
    assert set(data.keys()) == {"learner_message", "directive", "directive_reason"}
    assert data["directive"] in {"easier", "same", "harder", "revisit"}
    assert isinstance(data["learner_message"], str) and data["learner_message"]
    assert data["directive_reason"] is None or isinstance(data["directive_reason"], str)


def test_comorbid_contract_unchanged(monkeypatch):
    _mock_llm(monkeypatch, VALID_LLM_JSON)

    payload = {
        **BASE_PAYLOAD,
        "learner_context": {**BASE_PAYLOAD["learner_context"],
                            "cognitive_profiles": ["autism", "intellectual_disability"]},
    }
    resp = _post(payload)
    assert resp.status_code == 200
    data = resp.json()
    assert set(data.keys()) == {"learner_message", "directive", "directive_reason"}
    rule = get_adaptive_rule("autism+intellectual_disability")
    assert data["directive"] == compute_directive(True, 2000, rule)
    # autism family: easier is never returned
    assert data["directive"] != "easier"


def test_auth_still_required():
    resp = client.post("/ai/quiz/adaptive-response",
                       headers={"Content-Type": "application/json"}, json=BASE_PAYLOAD)
    assert resp.status_code == 401
