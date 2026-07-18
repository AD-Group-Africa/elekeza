import os
import logging
from typing import Optional
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

# Module-level client — initialised once, reused everywhere
_langfuse = None


def init_langfuse():
    """
    Called once inside the lifespan context manager at startup.
    If Langfuse is unreachable, logs a warning and continues — never crashes the service.
    """
    global _langfuse
    try:
        from langfuse import Langfuse

        _langfuse = Langfuse(
            public_key=os.getenv("LANGFUSE_PUBLIC_KEY", ""),
            secret_key=os.getenv("LANGFUSE_SECRET_KEY", ""),
            host=os.getenv("LANGFUSE_HOST", "http://localhost:3000"),
        )
        # Verify connection with a lightweight auth check
        _langfuse.auth_check()
        logger.info("✅ Langfuse connected successfully")
    except Exception as e:
        logger.warning(f"⚠️  Langfuse unavailable — observability disabled. Reason: {e}")
        _langfuse = None


def trace_ai_call(
    stage: str,
    profile: str,
    model: str,
    provider: str,
    input_tokens: int,
    output_tokens: int,
    latency_ms: float,
    retried: bool = False,
    retry_cause: Optional[str] = None,
):
    """
    The ONLY function any other file calls for observability.
    Fire-and-forget — if Langfuse is down this is a no-op, never raises.
    """
    if _langfuse is None:
        return

    try:
        trace = _langfuse.trace(
            name=f"{stage}",
            metadata={
                "profile": profile,
                "model": model,
                "provider": provider,
                "input_tokens": input_tokens,
                "output_tokens": output_tokens,
                "latency_ms": latency_ms,
                "retried": retried,
                "retry_cause": retry_cause,
            }
        )
        _langfuse.flush()
    except Exception as e:
        logger.warning(f"⚠️  Langfuse trace failed silently: {e}")

