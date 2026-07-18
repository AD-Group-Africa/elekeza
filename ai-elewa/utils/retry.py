import asyncio
import logging
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

# Delay in seconds between retries on rate limit
RATE_LIMIT_DELAYS = [1, 2]


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
                logger.warning(f"⚠️  Rate limit hit on {stage} — waiting {delay}s before retry {attempt}")
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

