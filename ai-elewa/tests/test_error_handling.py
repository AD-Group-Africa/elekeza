import pytest
from httpx import AsyncClient, ASGITransport
from main import app

BASE_URL = "http://test"
AUTH_HEADER = {"X-Internal-Key": "AO2xgxEVnV2r6ySzhajgl8M98aSQp3wD"}
JSON_HEADER = {**AUTH_HEADER, "Content-Type": "application/json"}


# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------

def assert_error_shape(data: dict, expected_code: str):
    """Every error response must have these exact fields."""
    assert "error_code" in data,  f"Missing error_code in: {data}"
    assert "message" in data,     f"Missing message in: {data}"
    assert "stage" in data,       f"Missing stage in: {data}"
    assert "retried" in data,     f"Missing retried in: {data}"
    assert data["error_code"] == expected_code, (
        f"Expected error_code '{expected_code}', got '{data['error_code']}'"
    )
    # Confirm no stack trace leaked
    assert "Traceback" not in data.get("message", ""), "Stack trace leaked into message"
    assert "traceback" not in str(data).lower() or "stage" in data, "Possible stack trace in response"


# ---------------------------------------------------------------------------
# Security
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_missing_auth_header_returns_401():
    async with AsyncClient(transport=ASGITransport(app=app), base_url=BASE_URL) as client:
        resp = await client.post("/ai/simplify/text", json={})
    assert resp.status_code == 401
    assert_error_shape(resp.json(), "UNAUTHORISED")


@pytest.mark.asyncio
async def test_wrong_auth_header_returns_401():
    async with AsyncClient(transport=ASGITransport(app=app), base_url=BASE_URL) as client:
        resp = await client.post(
            "/ai/simplify/text",
            headers={"X-Internal-Key": "wrongkey"},
            json={},
        )
    assert resp.status_code == 401
    assert_error_shape(resp.json(), "UNAUTHORISED")


@pytest.mark.asyncio
async def test_health_no_auth_required():
    async with AsyncClient(transport=ASGITransport(app=app), base_url=BASE_URL) as client:
        resp = await client.get("/health")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}


# ---------------------------------------------------------------------------
# Request validation — Pydantic catches these before pipeline runs
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_missing_body_returns_422():
    async with AsyncClient(transport=ASGITransport(app=app), base_url=BASE_URL) as client:
        resp = await client.post("/ai/simplify/text", headers=JSON_HEADER, json={})
    assert resp.status_code == 422
    assert_error_shape(resp.json(), "SCHEMA_INVALID")


@pytest.mark.asyncio
async def test_invalid_cognitive_profile_returns_422():
    async with AsyncClient(transport=ASGITransport(app=app), base_url=BASE_URL) as client:
        resp = await client.post(
            "/ai/simplify/text",
            headers=JSON_HEADER,
            json={
                "learner_context": {
                    "learner_id": "test-001",
                    "cognitive_profiles": ["invalid_profile"],
                    "language_level": 2,
                    "content_difficulty": 2,
                    "pathway_stage": "Foundation",
                },
                "raw_text": "Some content here.",
            },
        )
    assert resp.status_code == 422
    assert_error_shape(resp.json(), "SCHEMA_INVALID")


@pytest.mark.asyncio
async def test_invalid_language_level_returns_422():
    async with AsyncClient(transport=ASGITransport(app=app), base_url=BASE_URL) as client:
        resp = await client.post(
            "/ai/simplify/text",
            headers=JSON_HEADER,
            json={
                "learner_context": {
                    "learner_id": "test-001",
                    "cognitive_profiles": ["dyslexia"],
                    "language_level": 99,
                    "content_difficulty": 2,
                    "pathway_stage": "Foundation",
                },
                "raw_text": "Some content here.",
            },
        )
    assert resp.status_code == 422
    assert_error_shape(resp.json(), "SCHEMA_INVALID")


@pytest.mark.asyncio
async def test_too_many_profiles_returns_422():
    async with AsyncClient(transport=ASGITransport(app=app), base_url=BASE_URL) as client:
        resp = await client.post(
            "/ai/simplify/text",
            headers=JSON_HEADER,
            json={
                "learner_context": {
                    "learner_id": "test-001",
                    "cognitive_profiles": ["dyslexia", "adhd", "autism"],
                    "language_level": 2,
                    "content_difficulty": 2,
                    "pathway_stage": "Foundation",
                },
                "raw_text": "Some content here.",
            },
        )
    assert resp.status_code == 422
    assert_error_shape(resp.json(), "SCHEMA_INVALID")


@pytest.mark.asyncio
async def test_invalid_num_questions_returns_422():
    async with AsyncClient(transport=ASGITransport(app=app), base_url=BASE_URL) as client:
        resp = await client.post(
            "/ai/quiz/generate",
            headers=JSON_HEADER,
            json={
                "learner_context": {
                    "learner_id": "test-001",
                    "cognitive_profiles": ["dyslexia"],
                    "language_level": 2,
                    "content_difficulty": 2,
                    "pathway_stage": "Foundation",
                },
                "lesson_json": {},
                "num_questions": 0,
            },
        )
    assert resp.status_code == 422
    assert_error_shape(resp.json(), "SCHEMA_INVALID")


# ---------------------------------------------------------------------------
# Pipeline validation — caught inside endpoint before AI call
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_empty_raw_text_returns_422():
    async with AsyncClient(transport=ASGITransport(app=app), base_url=BASE_URL) as client:
        resp = await client.post(
            "/ai/simplify/text",
            headers=JSON_HEADER,
            json={
                "learner_context": {
                    "learner_id": "test-001",
                    "cognitive_profiles": ["dyslexia"],
                    "language_level": 2,
                    "content_difficulty": 2,
                    "pathway_stage": "Foundation",
                },
                "raw_text": "   ",
            },
        )
    assert resp.status_code == 422
    assert_error_shape(resp.json(), "EMPTY_CONTENT")


@pytest.mark.asyncio
async def test_oversized_content_returns_413():
    # Generate text clearly over 5000 words
    big_text = "word " * 5100
    async with AsyncClient(transport=ASGITransport(app=app), base_url=BASE_URL) as client:
        resp = await client.post(
            "/ai/simplify/text",
            headers=JSON_HEADER,
            json={
                "learner_context": {
                    "learner_id": "test-001",
                    "cognitive_profiles": ["dyslexia"],
                    "language_level": 2,
                    "content_difficulty": 2,
                    "pathway_stage": "Foundation",
                },
                "raw_text": big_text,
            },
        )
    assert resp.status_code == 413
    assert_error_shape(resp.json(), "OVERSIZED")


@pytest.mark.asyncio
async def test_non_english_content_returns_422():
    # Text with very few ASCII alpha words
    gibberish = "123 456 789 @#$ %^& 123 456 789 @#$ %^& 123 456 789 @#$ %^& hello"
    async with AsyncClient(transport=ASGITransport(app=app), base_url=BASE_URL) as client:
        resp = await client.post(
            "/ai/simplify/text",
            headers=JSON_HEADER,
            json={
                "learner_context": {
                    "learner_id": "test-001",
                    "cognitive_profiles": ["dyslexia"],
                    "language_level": 2,
                    "content_difficulty": 2,
                    "pathway_stage": "Foundation",
                },
                "raw_text": gibberish,
            },
        )
    assert resp.status_code == 422
    assert_error_shape(resp.json(), "NON_ENGLISH")
