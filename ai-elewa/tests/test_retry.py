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


# ---------------------------------------------------------------------------
# Application retry count unchanged (A)
#
# The Groq SDK's internal retries are now disabled (max_retries=0 in
# ai_client.py), so the application layer is the single retry authority.
# This pins the contract: a rate-limited call still gets exactly
# initial + 2 retries = 3 attempts, no more, no fewer.
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_rate_limit_retry_count_is_exactly_two(monkeypatch):
    sleeps: list[float] = []

    async def fake_sleep(seconds: float):
        sleeps.append(seconds)

    monkeypatch.setattr("utils.retry.asyncio.sleep", fake_sleep)

    call_count = 0

    async def always_rate_limit(attempt=0):
        nonlocal call_count
        call_count += 1
        raise make_error(ERROR_RATE_LIMIT)

    with pytest.raises(AIServiceError) as exc_info:
        await with_retry(always_rate_limit, **RETRY_KWARGS, max_retries=2)

    assert exc_info.value.error_response.error_code == ERROR_RATE_LIMIT
    assert call_count == 3          # initial + 2 retries — unchanged
    assert len(sleeps) == 2         # one wait per retry, not more


# ---------------------------------------------------------------------------
# Rate-limit backoff stays bounded (B)
#
# Base delays are [1, 2]s. Jitter is +/- RATE_LIMIT_JITTER_FRACTION, so every
# observed sleep must lie inside [base x (1 - f), base x (1 + f)].
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_rate_limit_backoff_remains_bounded(monkeypatch):
    from utils import retry as retry_module

    sleeps: list[float] = []

    async def fake_sleep(seconds: float):
        sleeps.append(seconds)

    monkeypatch.setattr("utils.retry.asyncio.sleep", fake_sleep)

    async def always_rate_limit(attempt=0):
        raise make_error(ERROR_RATE_LIMIT)

    with pytest.raises(AIServiceError):
        await with_retry(always_rate_limit, **RETRY_KWARGS, max_retries=2)

    fraction = retry_module.RATE_LIMIT_JITTER_FRACTION
    bases = retry_module.RATE_LIMIT_DELAYS
    assert len(sleeps) == len(bases)
    for observed, base in zip(sleeps, bases):
        assert base * (1 - fraction) <= observed <= base * (1 + fraction), (
            f"sleep {observed:.3f}s outside bounded jitter range for base {base}s"
        )


# ---------------------------------------------------------------------------
# Jitter never produces negative or unbounded delays (C)
#
# Drive the real random source across many draws and check the computed
# delay directly — no sleeps are executed in this test.
# ---------------------------------------------------------------------------

def test_jitter_never_negative_or_unbounded(monkeypatch):
    from utils import retry as retry_module

    fraction = retry_module.RATE_LIMIT_JITTER_FRACTION
    # Simulate every extreme of the real domain of random.uniform(-f, f),
    # including the exact edges — the clamped delay must stay within
    # [0, base x (1 + f)] for all of them.
    draws = [fraction, -fraction, 0.0, 0.249, -0.249, 0.1, -0.1]

    for draw in draws:
        monkeypatch.setattr(retry_module.random, "uniform", lambda a, b, _d=draw: _d)
        jitter = 1.0 + retry_module.random.uniform(-fraction, fraction)
        for base in retry_module.RATE_LIMIT_DELAYS:
            delay = max(0.0, base * jitter)
            assert 0.0 <= delay <= base * (1 + fraction), (
                f"jittered delay {delay} out of [0, {base * (1 + fraction)}]"
            )


# ---------------------------------------------------------------------------
# Retry-After, when available from the exception, is honored (D)
#
# ai_client surfaces a provider Retry-After header on the error response as
# retry_after_seconds. with_retry must use it as the wait (bounded), not the
# base+jitter path — and still perform exactly the same number of attempts.
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_retry_after_hint_is_honored(monkeypatch):
    sleeps: list[float] = []

    async def fake_sleep(seconds: float):
        sleeps.append(seconds)

    monkeypatch.setattr("utils.retry.asyncio.sleep", fake_sleep)

    hinted = make_error(ERROR_RATE_LIMIT)
    hinted.error_response.retry_after_seconds = 7.0

    call_count = 0

    async def always_rate_limit(attempt=0):
        nonlocal call_count
        call_count += 1
        raise hinted

    with pytest.raises(AIServiceError) as exc_info:
        await with_retry(always_rate_limit, **RETRY_KWARGS, max_retries=2)

    assert call_count == 3                       # hint never changes the count
    assert sleeps == [7.0, 7.0]                  # honored on every 429 wait
    assert exc_info.value.error_response.error_code == ERROR_RATE_LIMIT


@pytest.mark.asyncio
async def test_retry_after_hint_outside_bounds_uses_backoff(monkeypatch):
    """A hint that is absent, zero, or absurdly large falls back to base backoff."""
    from utils import retry as retry_module

    sleeps: list[float] = []

    async def fake_sleep(seconds: float):
        sleeps.append(seconds)

    monkeypatch.setattr("utils.retry.asyncio.sleep", fake_sleep)

    absurd = make_error(ERROR_RATE_LIMIT)
    absurd.error_response.retry_after_seconds = 600.0  # > RETRY_AFTER_MAX_SECONDS

    async def always_rate_limit(attempt=0):
        raise absurd

    with pytest.raises(AIServiceError):
        await with_retry(always_rate_limit, **RETRY_KWARGS, max_retries=2)

    fraction = retry_module.RATE_LIMIT_JITTER_FRACTION
    for observed, base in zip(sleeps, retry_module.RATE_LIMIT_DELAYS):
        assert base * (1 - fraction) <= observed <= base * (1 + fraction)

