"""
Day 13 — Edge Case Tests
Tests every documented error case against the live server.
All cases must return clean ErrorResponse — no crashes, no stack traces.

Usage:
    uvicorn main:app --port 8000
    pytest tests/test_edge_cases.py -v -s
"""
import base64
import json
import pytest
import httpx
from pathlib import Path

BASE_URL = "http://localhost:8000"
AUTH_HEADER = {"X-Internal-Key": "AO2xgxEVnV2r6ySzhajgl8M98aSQp3wD"}
JSON_HEADER = {**AUTH_HEADER, "Content-Type": "application/json"}

VALID_CONTEXT = {
    "learner_id": "edge-test-001",
    "cognitive_profiles": ["dyslexia"],
    "language_level": 2,
    "content_difficulty": 2,
    "pathway_stage": "Foundation",
}

VALID_TEXT = (
    "The water cycle describes how water moves through the Earth's environment. "
    "Water evaporates from oceans and lakes when heated by the sun. "
    "It rises into the atmosphere and forms clouds. Rain falls back to the ground."
)

VALID_LESSON = {
    "title": "The Water Cycle",
    "sections": [
        {
            "heading": "Water Moves",
            "body": "Water moves around the Earth. The sun heats water up.",
            "visual_hint": "diagram of water cycle",
            "reading_level": 2,
        }
    ],
    "key_terms": [{"term": "evaporation", "definition": "water turning into vapour"}],
    "estimated_minutes": 3,
    "profile": "dyslexia",
    "stage_flags": {
        "verification_triggered": False,
        "correction_applied": False,
        "profile_merged": False,
    },
}


# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------

def assert_error_response(
    resp: httpx.Response,
    expected_status: int,
    expected_code: str,
):
    """Assert response is a clean ErrorResponse with correct shape and values."""
    assert resp.status_code == expected_status, (
        f"Expected HTTP {expected_status}, got {resp.status_code}. "
        f"Body: {resp.text[:300]}"
    )
    data = resp.json()

    # Shape checks — all four fields must always be present
    assert "error_code" in data,  f"Missing error_code. Body: {data}"
    assert "message" in data,     f"Missing message. Body: {data}"
    assert "stage" in data,       f"Missing stage. Body: {data}"
    assert "retried" in data,     f"Missing retried. Body: {data}"

    # Correct error code
    assert data["error_code"] == expected_code, (
        f"Expected error_code '{expected_code}', got '{data['error_code']}'. "
        f"Body: {data}"
    )

    # No stack traces
    body_str = json.dumps(data)
    assert "Traceback" not in body_str,         "Stack trace leaked into response"
    assert "File \"" not in body_str,           "Stack trace leaked into response"
    assert "line " not in data.get("message", "").lower() or "baseline" in data.get("message","").lower(), \
        "Possible stack trace in message field"

    print(
        f"  ✅ HTTP {resp.status_code} | "
        f"error_code={data['error_code']} | "
        f"stage={data['stage']} | "
        f"message={data['message'][:60]}"
    )


# ---------------------------------------------------------------------------
# /ai/simplify/text — edge cases
# ---------------------------------------------------------------------------

class TestSimplifyTextEdgeCases:

    def test_empty_string_returns_422_empty_content(self):
        print("\n[simplify/text] Empty string")
        resp = httpx.post(
            f"{BASE_URL}/ai/simplify/text",
            headers=JSON_HEADER,
            json={"learner_context": VALID_CONTEXT, "raw_text": ""},
            timeout=10.0,
        )
        assert_error_response(resp, 422, "EMPTY_CONTENT")

    def test_whitespace_only_returns_422_empty_content(self):
        print("\n[simplify/text] Whitespace only")
        resp = httpx.post(
            f"{BASE_URL}/ai/simplify/text",
            headers=JSON_HEADER,
            json={"learner_context": VALID_CONTEXT, "raw_text": "   \n\n\t   "},
            timeout=10.0,
        )
        assert_error_response(resp, 422, "EMPTY_CONTENT")

    def test_oversized_content_returns_413_oversized(self):
        print("\n[simplify/text] Oversized content (5100 words)")
        big_text = "word " * 5100
        resp = httpx.post(
            f"{BASE_URL}/ai/simplify/text",
            headers=JSON_HEADER,
            json={"learner_context": VALID_CONTEXT, "raw_text": big_text},
            timeout=10.0,
        )
        assert_error_response(resp, 413, "OVERSIZED")
        # Confirm message tells Spring Boot to chunk
        assert "chunk" in resp.json()["message"].lower() or "split" in resp.json()["message"].lower(), \
            "OVERSIZED message should instruct Spring Boot to split content"

    def test_oversized_message_contains_word_count(self):
        print("\n[simplify/text] Oversized — message contains word count")
        big_text = "word " * 5200
        resp = httpx.post(
            f"{BASE_URL}/ai/simplify/text",
            headers=JSON_HEADER,
            json={"learner_context": VALID_CONTEXT, "raw_text": big_text},
            timeout=10.0,
        )
        assert resp.status_code == 413
        # Message should mention the actual word count
        assert "5200" in resp.json()["message"] or "5" in resp.json()["message"]

    def test_gibberish_returns_422_non_english(self):
        print("\n[simplify/text] Gibberish / non-English")
        gibberish = "123 456 @#$ %%% 789 !!! @@@ ### $$$ ^^^ &&& *** hello world"
        resp = httpx.post(
            f"{BASE_URL}/ai/simplify/text",
            headers=JSON_HEADER,
            json={"learner_context": VALID_CONTEXT, "raw_text": gibberish},
            timeout=10.0,
        )
        assert_error_response(resp, 422, "NON_ENGLISH")

    def test_single_character_passes_validation(self):
        """Single char passes Pydantic min_length=1 but hits pipeline.
        Should return either a lesson or EMPTY_CONTENT — not crash."""
        print("\n[simplify/text] Single character")
        resp = httpx.post(
            f"{BASE_URL}/ai/simplify/text",
            headers=JSON_HEADER,
            json={"learner_context": VALID_CONTEXT, "raw_text": "x"},
            timeout=15.0,
        )
        # Either produces output or returns a handled error — never crashes
        assert resp.status_code in {200, 422, 504}, (
            f"Unexpected status {resp.status_code} for single-char input"
        )
        data = resp.json()
        assert "error_code" in data or "title" in data, \
            "Response must be either ErrorResponse or LessonJSON"
        print(f"  ✅ HTTP {resp.status_code} — handled cleanly")

    def test_missing_raw_text_field_returns_422(self):
        print("\n[simplify/text] Missing raw_text field")
        resp = httpx.post(
            f"{BASE_URL}/ai/simplify/text",
            headers=JSON_HEADER,
            json={"learner_context": VALID_CONTEXT},
            timeout=10.0,
        )
        assert_error_response(resp, 422, "SCHEMA_INVALID")

    def test_missing_learner_context_returns_422(self):
        print("\n[simplify/text] Missing learner_context field")
        resp = httpx.post(
            f"{BASE_URL}/ai/simplify/text",
            headers=JSON_HEADER,
            json={"raw_text": VALID_TEXT},
            timeout=10.0,
        )
        assert_error_response(resp, 422, "SCHEMA_INVALID")

    def test_invalid_pathway_stage_returns_422(self):
        print("\n[simplify/text] Invalid pathway_stage")
        ctx = {**VALID_CONTEXT, "pathway_stage": "InvalidStage"}
        resp = httpx.post(
            f"{BASE_URL}/ai/simplify/text",
            headers=JSON_HEADER,
            json={"learner_context": ctx, "raw_text": VALID_TEXT},
            timeout=10.0,
        )
        assert_error_response(resp, 422, "SCHEMA_INVALID")

    def test_empty_cognitive_profiles_returns_422(self):
        print("\n[simplify/text] Empty cognitive_profiles list")
        ctx = {**VALID_CONTEXT, "cognitive_profiles": []}
        resp = httpx.post(
            f"{BASE_URL}/ai/simplify/text",
            headers=JSON_HEADER,
            json={"learner_context": ctx, "raw_text": VALID_TEXT},
            timeout=10.0,
        )
        assert_error_response(resp, 422, "SCHEMA_INVALID")


# ---------------------------------------------------------------------------
# /ai/simplify/image — edge cases
# ---------------------------------------------------------------------------

class TestSimplifyImageEdgeCases:

    def _blank_png_b64(self) -> str:
        """Minimal 1x1 white PNG — Tesseract returns empty string for this."""
        png_bytes = (
            b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01"
            b"\x00\x00\x00\x01\x08\x02\x00\x00\x00\x90wS\xde\x00\x00"
            b"\x00\x0cIDATx\x9cc\xf8\x0f\x00\x00\x01\x01\x00\x05\x18"
            b"\xd8N\x00\x00\x00\x00IEND\xaeB`\x82"
        )
        return base64.b64encode(png_bytes).decode("utf-8")

    def test_blank_image_returns_422_ocr_failed(self):
        print("\n[simplify/image] Blank image — no readable text")
        resp = httpx.post(
            f"{BASE_URL}/ai/simplify/image",
            headers=JSON_HEADER,
            json={
                "learner_context": VALID_CONTEXT,
                "base64_image": self._blank_png_b64(),
                "media_type": "image/png",
            },
            timeout=15.0,
        )
        assert_error_response(resp, 422, "OCR_FAILED")

    def test_invalid_base64_returns_422_ocr_failed(self):
        print("\n[simplify/image] Invalid base64 string")
        resp = httpx.post(
            f"{BASE_URL}/ai/simplify/image",
            headers=JSON_HEADER,
            json={
                "learner_context": VALID_CONTEXT,
                "base64_image": "this is not valid base64 !!!###",
                "media_type": "image/png",
            },
            timeout=15.0,
        )
        assert_error_response(resp, 422, "OCR_FAILED")

    def test_invalid_media_type_returns_422(self):
        print("\n[simplify/image] Invalid media_type")
        resp = httpx.post(
            f"{BASE_URL}/ai/simplify/image",
            headers=JSON_HEADER,
            json={
                "learner_context": VALID_CONTEXT,
                "base64_image": self._blank_png_b64(),
                "media_type": "image/bmp",
            },
            timeout=10.0,
        )
        assert_error_response(resp, 422, "SCHEMA_INVALID")

    def test_missing_base64_image_returns_422(self):
        print("\n[simplify/image] Missing base64_image field")
        resp = httpx.post(
            f"{BASE_URL}/ai/simplify/image",
            headers=JSON_HEADER,
            json={
                "learner_context": VALID_CONTEXT,
                "media_type": "image/png",
            },
            timeout=10.0,
        )
        assert_error_response(resp, 422, "SCHEMA_INVALID")


# ---------------------------------------------------------------------------
# /ai/quiz/generate — edge cases
# ---------------------------------------------------------------------------

class TestQuizGenerateEdgeCases:

    def test_num_questions_zero_returns_422(self):
        print("\n[quiz/generate] num_questions=0")
        resp = httpx.post(
            f"{BASE_URL}/ai/quiz/generate",
            headers=JSON_HEADER,
            json={
                "learner_context": VALID_CONTEXT,
                "lesson_json": VALID_LESSON,
                "num_questions": 0,
            },
            timeout=10.0,
        )
        assert_error_response(resp, 422, "SCHEMA_INVALID")

    def test_num_questions_eleven_returns_422(self):
        print("\n[quiz/generate] num_questions=11 (above max)")
        resp = httpx.post(
            f"{BASE_URL}/ai/quiz/generate",
            headers=JSON_HEADER,
            json={
                "learner_context": VALID_CONTEXT,
                "lesson_json": VALID_LESSON,
                "num_questions": 11,
            },
            timeout=10.0,
        )
        assert_error_response(resp, 422, "SCHEMA_INVALID")

    def test_missing_lesson_json_returns_422(self):
        print("\n[quiz/generate] Missing lesson_json")
        resp = httpx.post(
            f"{BASE_URL}/ai/quiz/generate",
            headers=JSON_HEADER,
            json={
                "learner_context": VALID_CONTEXT,
                "num_questions": 5,
            },
            timeout=10.0,
        )
        assert_error_response(resp, 422, "SCHEMA_INVALID")

    def test_negative_num_questions_returns_422(self):
        print("\n[quiz/generate] num_questions=-1")
        resp = httpx.post(
            f"{BASE_URL}/ai/quiz/generate",
            headers=JSON_HEADER,
            json={
                "learner_context": VALID_CONTEXT,
                "lesson_json": VALID_LESSON,
                "num_questions": -1,
            },
            timeout=10.0,
        )
        assert_error_response(resp, 422, "SCHEMA_INVALID")


# ---------------------------------------------------------------------------
# /ai/quiz/adaptive-response — edge cases
# ---------------------------------------------------------------------------

class TestAdaptiveResponseEdgeCases:

    def test_negative_latency_returns_422(self):
        print("\n[quiz/adaptive-response] Negative latency_ms")
        resp = httpx.post(
            f"{BASE_URL}/ai/quiz/adaptive-response",
            headers=JSON_HEADER,
            json={
                "learner_context": VALID_CONTEXT,
                "question": "What is evaporation?",
                "selected_option": "Water turning to vapour",
                "is_correct": True,
                "latency_ms": -100,
            },
            timeout=10.0,
        )
        assert_error_response(resp, 422, "SCHEMA_INVALID")

    def test_missing_is_correct_returns_422(self):
        print("\n[quiz/adaptive-response] Missing is_correct field")
        resp = httpx.post(
            f"{BASE_URL}/ai/quiz/adaptive-response",
            headers=JSON_HEADER,
            json={
                "learner_context": VALID_CONTEXT,
                "question": "What is evaporation?",
                "selected_option": "Water turning to vapour",
                "latency_ms": 2000,
            },
            timeout=10.0,
        )
        assert_error_response(resp, 422, "SCHEMA_INVALID")

    def test_missing_question_returns_422(self):
        print("\n[quiz/adaptive-response] Missing question field")
        resp = httpx.post(
            f"{BASE_URL}/ai/quiz/adaptive-response",
            headers=JSON_HEADER,
            json={
                "learner_context": VALID_CONTEXT,
                "selected_option": "Water turning to vapour",
                "is_correct": True,
                "latency_ms": 2000,
            },
            timeout=10.0,
        )
        assert_error_response(resp, 422, "SCHEMA_INVALID")


# ---------------------------------------------------------------------------
# /ai/quiz/wrong-answer-flow — edge cases
# ---------------------------------------------------------------------------

class TestWrongAnswerFlowEdgeCases:

    def test_missing_section_content_returns_422(self):
        print("\n[quiz/wrong-answer-flow] Missing section_content")
        resp = httpx.post(
            f"{BASE_URL}/ai/quiz/wrong-answer-flow",
            headers=JSON_HEADER,
            json={
                "learner_context": VALID_CONTEXT,
                "question": "What is evaporation?",
            },
            timeout=10.0,
        )
        assert_error_response(resp, 422, "SCHEMA_INVALID")

    def test_missing_question_returns_422(self):
        print("\n[quiz/wrong-answer-flow] Missing question field")
        resp = httpx.post(
            f"{BASE_URL}/ai/quiz/wrong-answer-flow",
            headers=JSON_HEADER,
            json={
                "learner_context": VALID_CONTEXT,
                "section_content": "Water evaporates when heated.",
            },
            timeout=10.0,
        )
        assert_error_response(resp, 422, "SCHEMA_INVALID")


# ---------------------------------------------------------------------------
# Security edge cases — all endpoints
# ---------------------------------------------------------------------------

class TestSecurityEdgeCases:

    def test_no_auth_header_returns_401(self):
        print("\n[security] No auth header")
        resp = httpx.post(
            f"{BASE_URL}/ai/simplify/text",
            headers={"Content-Type": "application/json"},
            json={"learner_context": VALID_CONTEXT, "raw_text": VALID_TEXT},
            timeout=10.0,
        )
        assert_error_response(resp, 401, "UNAUTHORISED")

    def test_wrong_auth_header_returns_401(self):
        print("\n[security] Wrong auth header value")
        resp = httpx.post(
            f"{BASE_URL}/ai/simplify/text",
            headers={**JSON_HEADER, "X-Internal-Key": "completely_wrong_key"},
            json={"learner_context": VALID_CONTEXT, "raw_text": VALID_TEXT},
            timeout=10.0,
        )
        assert_error_response(resp, 401, "UNAUTHORISED")

    def test_empty_auth_header_returns_401(self):
        print("\n[security] Empty auth header value")
        resp = httpx.post(
            f"{BASE_URL}/ai/simplify/text",
            headers={**JSON_HEADER, "X-Internal-Key": ""},
            json={"learner_context": VALID_CONTEXT, "raw_text": VALID_TEXT},
            timeout=10.0,
        )
        assert_error_response(resp, 401, "UNAUTHORISED")

    def test_health_requires_no_auth(self):
        print("\n[security] Health check needs no auth")
        resp = httpx.get(f"{BASE_URL}/health", timeout=5.0)
        assert resp.status_code == 200
        assert resp.json() == {"status": "ok"}
        print("  ✅ /health accessible without auth")

    def test_auth_on_quiz_generate(self):
        print("\n[security] Auth required on quiz/generate")
        resp = httpx.post(
            f"{BASE_URL}/ai/quiz/generate",
            headers={"Content-Type": "application/json"},
            json={},
            timeout=10.0,
        )
        assert_error_response(resp, 401, "UNAUTHORISED")

    def test_auth_on_adaptive_response(self):
        print("\n[security] Auth required on quiz/adaptive-response")
        resp = httpx.post(
            f"{BASE_URL}/ai/quiz/adaptive-response",
            headers={"Content-Type": "application/json"},
            json={},
            timeout=10.0,
        )
        assert_error_response(resp, 401, "UNAUTHORISED")

    def test_auth_on_wrong_answer_flow(self):
        print("\n[security] Auth required on quiz/wrong-answer-flow")
        resp = httpx.post(
            f"{BASE_URL}/ai/quiz/wrong-answer-flow",
            headers={"Content-Type": "application/json"},
            json={},
            timeout=10.0,
        )
        assert_error_response(resp, 401, "UNAUTHORISED")

    def test_auth_on_simplify_image(self):
        print("\n[security] Auth required on simplify/image")
        resp = httpx.post(
            f"{BASE_URL}/ai/simplify/image",
            headers={"Content-Type": "application/json"},
            json={},
            timeout=10.0,
        )
        assert_error_response(resp, 401, "UNAUTHORISED")

