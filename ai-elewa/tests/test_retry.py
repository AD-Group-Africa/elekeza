import asyncio
import pytest
from unittest.mock import AsyncMock

from models.errors import AIServiceError, ErrorResponse, ERROR_RATE_LIMIT, ERROR_TIMEOUT, ERROR_SCHEMA_INVALID
from utils.retry import with_retry


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def make_error(code: str) -> AIServiceError:
    return AIServiceError(ErrorResponse(
        error_code=code,
        message=f"Test error: {code}",
        stage="test_stage",
        retried=False,
    ))


RETRY_KWARGS = dict(
    stage="test_stage",
    profile="dyslexia",
    model="test-model",
    provider="groq",
)


# ---------------------------------------------------------------------------
# Rate limit — retries twice then raises RATE_LIMIT
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_rate_limit_exhausts_retries():
    call_count = 0

    async def always_rate_limit(attempt=0):
        nonlocal call_count
        call_count += 1
        raise make_error(ERROR_RATE_LIMIT)

    with pytest.raises(AIServiceError) as exc_info:
        await with_retry(always_rate_limit, **RETRY_KWARGS, max_retries=2)

    assert exc_info.value.error_response.error_code == ERROR_RATE_LIMIT
    assert call_count == 3  # initial + 2 retries


# ---------------------------------------------------------------------------
# Timeout — retries once then raises TIMEOUT
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_timeout_exhausts_retries():
    call_count = 0

    async def always_timeout(attempt=0):
        nonlocal call_count
        call_count += 1
        raise make_error(ERROR_TIMEOUT)

    with pytest.raises(AIServiceError) as exc_info:
        await with_retry(always_timeout, **RETRY_KWARGS, max_retries=2)

    assert exc_info.value.error_response.error_code == ERROR_TIMEOUT
    assert call_count == 3


# ---------------------------------------------------------------------------
# Schema invalid — retries once then raises SCHEMA_INVALID
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_schema_invalid_exhausts_retries():
    call_count = 0

    async def always_schema_fail(attempt=0):
        nonlocal call_count
        call_count += 1
        raise make_error(ERROR_SCHEMA_INVALID)

    with pytest.raises(AIServiceError) as exc_info:
        await with_retry(always_schema_fail, **RETRY_KWARGS, max_retries=2)

    assert exc_info.value.error_response.error_code == ERROR_SCHEMA_INVALID
    assert call_count == 3


# ---------------------------------------------------------------------------
# Success on second attempt
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_succeeds_on_retry():
    call_count = 0

    async def fails_then_succeeds(attempt=0):
        nonlocal call_count
        call_count += 1
        if call_count == 1:
            raise make_error(ERROR_TIMEOUT)
        return "success"

    result = await with_retry(fails_then_succeeds, **RETRY_KWARGS, max_retries=2)
    assert result == "success"
    assert call_count == 2
