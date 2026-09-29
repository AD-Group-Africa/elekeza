import asyncio
import logging
import random
from typing import Callable, Optional

from models.errors import (
    AIServiceError,
    ErrorResponse,
    ERROR_RATE_LIMIT,
    ERROR_TIMEOUT,
    ERROR_SCHEMA_INVALID,
)
from langfuse_client import trace_ai_call

logger = logging.getLogger(__name__)

# Base delays in seconds between retries on rate limit. A bounded jitter of
# +/- 25% is applied at sleep time (RATE_LIMIT_JITTER_FRACTION) so multiple
# concurrent requests do not retry in lock-step against the provider.
RATE_LIMIT_DELAYS = [1, 2]
RATE_LIMIT_JITTER_FRACTION = 0.25

# Retry-After bounds: a provider hint is honored only when it is a usable
# positive number and not absurdly large — it may extend a single wait up to
# this cap but never adds retries or unbounded waiting.
RETRY_AFTER_MIN_SECONDS = 0.0
RETRY_AFTER_MAX_SECONDS = 30.0


async def with_retry(
    fn: Callable,
    stage: str,
    profile: str,
    model: str,
    provider: str,
    max_retries: int = 2,
) -> str:
    """
    Wraps any async AI callable with retry + backoff logic.

    Retry behaviour:
      - 429 Rate limit : wait 1s → retry, wait 2s → retry, then raise RATE_LIMIT
      - Timeout        : retry once immediately, then raise TIMEOUT
      - Schema invalid : retry once (caller appends correction note), then raise SCHEMA_INVALID

    Maximum 2 retries total regardless of cause.
    Every retry is logged to Langfuse with retried=True.
    """
    attempt = 0
    last_error: Optional[Exception] = None

    while attempt <= max_retries:
        try:
            return await fn(attempt=attempt)

        except AIServiceError as e:
            code = e.error_response.error_code
            last_error = e
            attempt += 1

            if attempt > max_retries:
                break

            retry_cause = code

            if code == ERROR_RATE_LIMIT:
                delay = RATE_LIMIT_DELAYS[min(attempt - 1, len(RATE_LIMIT_DELAYS) - 1)]

                # Honor a provider Retry-After hint when one was surfaced on
                # the error (ai_client parses it from the SDK exception). It
                # replaces the base delay for this wait — bounded, never a
                # new retry, and falls back to the base delay when absent,
                # non-numeric, or outside sane bounds.
                provider_hint = e.error_response.retry_after_seconds
                if provider_hint is not None and RETRY_AFTER_MIN_SECONDS <= provider_hint <= RETRY_AFTER_MAX_SECONDS:
                    delay = provider_hint
                    logger.warning(
                        f"⚠️  Rate limit hit on {stage} — honoring provider Retry-After: {delay}s "
                        f"before retry {attempt}"
                    )
                else:
                    # Bounded jitter: delay +/- 25%. Clamped at >= 0 so it can
                    # never go negative; bounded by construction (base delay
                    # x 1.25), so waits stay predictable.
                    jitter = 1.0 + random.uniform(-RATE_LIMIT_JITTER_FRACTION, RATE_LIMIT_JITTER_FRACTION)
                    delay = max(0.0, delay * jitter)
                    logger.warning(
                        f"⚠️  Rate limit hit on {stage} — waiting {delay:.2f}s before retry {attempt}"
                    )

                await asyncio.sleep(delay)

            elif code == ERROR_TIMEOUT:
                logger.warning(f"⚠️  Timeout on {stage} — retrying immediately (attempt {attempt})")

            elif code == ERROR_SCHEMA_INVALID:
                logger.warning(f"⚠️  Schema invalid on {stage} — retrying with correction note (attempt {attempt})")

            else:
                # Non-retryable error — raise immediately
                raise

            # Log the retry to Langfuse
            trace_ai_call(
                stage=stage,
                profile=profile,
                model=model,
                provider=provider,
                input_tokens=0,
                output_tokens=0,
                latency_ms=0,
                retried=True,
                retry_cause=retry_cause,
            )

        except asyncio.TimeoutError:
            last_error = AIServiceError(ErrorResponse(
                error_code=ERROR_TIMEOUT,
                message="AI model did not respond in time.",
                stage=stage,
                retried=attempt > 0,
            ))
            attempt += 1
            if attempt > max_retries:
                break
            logger.warning(f"⚠️  asyncio.TimeoutError on {stage} — retrying (attempt {attempt})")
            trace_ai_call(
                stage=stage, profile=profile, model=model, provider=provider,
                input_tokens=0, output_tokens=0, latency_ms=0,
                retried=True, retry_cause=ERROR_TIMEOUT,
            )

    # All retries exhausted — raise the last error seen
    if isinstance(last_error, AIServiceError):
        raise last_error
    raise AIServiceError(ErrorResponse(
        error_code=ERROR_TIMEOUT,
        message="Request failed after maximum retries.",
        stage=stage,
        retried=True,
    ))

