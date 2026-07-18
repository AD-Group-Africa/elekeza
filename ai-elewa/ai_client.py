import time
import logging
from typing import Optional
import config
from langfuse_client import trace_ai_call
from models.errors import AIServiceError, ErrorResponse, ERROR_TIMEOUT, ERROR_RATE_LIMIT, ERROR_SCHEMA_INVALID

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Module-level async clients — created once at startup, reused every request
# ---------------------------------------------------------------------------
_groq_client = None
_openai_client = None
_anthropic_client = None
_google_model_cache: dict = {}


def init_ai_clients():
    global _groq_client, _openai_client, _anthropic_client

    if config.AI_PROVIDER == "groq":
        from groq import AsyncGroq
        import httpx
        _groq_client = AsyncGroq(
            api_key=config.AI_API_KEY,
            timeout=httpx.Timeout(
                connect=5.0,    # fail fast on connection
                read=25.0,      # allow up to 25s for model response
                write=5.0,
                pool=5.0,
            )
        )
        logger.info("✅ Groq async client initialised")

    elif config.AI_PROVIDER == "openai":
        from openai import AsyncOpenAI
        _openai_client = AsyncOpenAI(
            api_key=config.AI_API_KEY,
            timeout=25.0,
        )
        logger.info("✅ OpenAI async client initialised")

    elif config.AI_PROVIDER == "anthropic":
        from anthropic import AsyncAnthropic
        _anthropic_client = AsyncAnthropic(
            api_key=config.AI_API_KEY,
            timeout=25.0,
        )
        logger.info("✅ Anthropic async client initialised")

    elif config.AI_PROVIDER == "google":
        import google.generativeai as genai
        genai.configure(api_key=config.AI_API_KEY)
        logger.info("✅ Google Generative AI configured")


# ---------------------------------------------------------------------------
# Internal provider call functions — each returns a plain str
# ---------------------------------------------------------------------------

async def _call_groq(system_prompt: str, user_prompt: str, model: str, temperature: float) -> tuple[str, int, int]:
    """Returns (response_text, input_tokens, output_tokens)"""
    response = await _groq_client.chat.completions.create(
        model=model,
        temperature=temperature,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user",   "content": user_prompt},
        ],
    )
    text = response.choices[0].message.content or ""
    input_tokens  = response.usage.prompt_tokens     if response.usage else 0
    output_tokens = response.usage.completion_tokens if response.usage else 0
    return text, input_tokens, output_tokens


async def _call_openai(system_prompt: str, user_prompt: str, model: str, temperature: float) -> tuple[str, int, int]:
    response = await _openai_client.chat.completions.create(
        model=model,
        temperature=temperature,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user",   "content": user_prompt},
        ],
    )
    text = response.choices[0].message.content or ""
    input_tokens  = response.usage.prompt_tokens     if response.usage else 0
    output_tokens = response.usage.completion_tokens if response.usage else 0
    return text, input_tokens, output_tokens


async def _call_anthropic(system_prompt: str, user_prompt: str, model: str, temperature: float) -> tuple[str, int, int]:
    response = await _anthropic_client.messages.create(
        model=model,
        max_tokens=4096,
        temperature=temperature,
        system=system_prompt,
        messages=[{"role": "user", "content": user_prompt}],
    )
    text = response.content[0].text if response.content else ""
    input_tokens  = response.usage.input_tokens  if response.usage else 0
    output_tokens = response.usage.output_tokens if response.usage else 0
    return text, input_tokens, output_tokens


async def _call_google(system_prompt: str, user_prompt: str, model: str, temperature: float) -> tuple[str, int, int]:
    import google.generativeai as genai
    if model not in _google_model_cache:
        _google_model_cache[model] = genai.GenerativeModel(
            model_name=model,
            system_instruction=system_prompt,
        )
    gmodel = _google_model_cache[model]
    response = await gmodel.generate_content_async(
        user_prompt,
        generation_config=genai.GenerationConfig(temperature=temperature),
    )
    text = response.text or ""
    # Google doesn't always expose token counts — default to 0
    input_tokens  = getattr(response.usage_metadata, "prompt_token_count",     0) or 0
    output_tokens = getattr(response.usage_metadata, "candidates_token_count", 0) or 0
    return text, input_tokens, output_tokens


# ---------------------------------------------------------------------------
# Provider dispatch table — avoids if/elif chain in complete()
# ---------------------------------------------------------------------------

_DISPATCH = {
    "groq":      _call_groq,
    "openai":    _call_openai,
    "anthropic": _call_anthropic,
    "google":    _call_google,
}


# ---------------------------------------------------------------------------
# Public interface — the only function the pipeline ever calls
# ---------------------------------------------------------------------------

async def complete(
    system_prompt: str,
    user_prompt: str,
    model: str,
    temperature: float,
    stage: str,
    profile: str,
) -> str:
    """
    Makes one AI completion call, normalised across all providers.
    Handles retries internally via with_retry().
    Logs every successful call to Langfuse.
    Returns a plain str — pipeline never sees SDK objects.
    """
    from utils.retry import with_retry

    call_fn = _DISPATCH.get(config.AI_PROVIDER)
    if call_fn is None:
        raise AIServiceError(ErrorResponse(
            error_code="SCHEMA_INVALID",
            message=f"Unknown provider: {config.AI_PROVIDER}",
            stage=stage,
        ))

    async def _attempt(attempt: int = 0) -> str:
        start = time.monotonic()
        try:
            # On schema retry, append a correction note to the user prompt
            prompt = user_prompt
            if attempt > 0:
                prompt += (
                    "\n\n[CORRECTION NOTE: Your previous response did not match "
                    "the required JSON schema. Return ONLY valid JSON, no markdown "
                    "fences, no extra text, exactly matching the schema specified.]"
                )

            text, input_tokens, output_tokens = await call_fn(
                system_prompt, prompt, model, temperature
            )

            latency_ms = (time.monotonic() - start) * 1000

            if not text.strip():
                raise AIServiceError(ErrorResponse(
                    error_code=ERROR_SCHEMA_INVALID,
                    message="Model returned an empty response.",
                    stage=stage,
                    retried=attempt > 0,
                ))

            # Log successful call to Langfuse
            trace_ai_call(
                stage=stage,
                profile=profile,
                model=model,
                provider=config.AI_PROVIDER,
                input_tokens=input_tokens,
                output_tokens=output_tokens,
                latency_ms=latency_ms,
                retried=attempt > 0,
                retry_cause=None,
            )

            return text

        except AIServiceError:
            raise  # already structured — let retry.py handle it

        except Exception as e:
            latency_ms = (time.monotonic() - start) * 1000
            error_str = str(e).lower()

            # Map provider SDK errors to our error codes
            if "429" in error_str or "rate limit" in error_str or "rate_limit" in error_str:
                raise AIServiceError(ErrorResponse(
                    error_code=ERROR_RATE_LIMIT,
                    message="AI provider rate limit reached.",
                    stage=stage,
                    retried=attempt > 0,
                ))
            if "timeout" in error_str or "timed out" in error_str:
                raise AIServiceError(ErrorResponse(
                    error_code=ERROR_TIMEOUT,
                    message="AI model did not respond in time.",
                    stage=stage,
                    retried=attempt > 0,
                ))

            # Unexpected error — wrap it
            logger.error(f"Unexpected AI client error on {stage}: {e}")
            raise AIServiceError(ErrorResponse(
                error_code=ERROR_SCHEMA_INVALID,
                message=f"Unexpected error from AI provider: {str(e)}",
                stage=stage,
                retried=attempt > 0,
            ))

    return await with_retry(
        _attempt,
        stage=stage,
        profile=profile,
        model=model,
        provider=config.AI_PROVIDER,
    )
