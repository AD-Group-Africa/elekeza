"""
POST /ai/adaptive
Connects adaptive_rules.py to the live quiz flow.
Receives learner state after each answer, returns directive + message.
"""
import json
import time
import structlog
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from typing import Optional
from ai_elewa.utils.adaptive_rules import (
    get_adaptive_rule,
    adjusted_latency,
    is_slow,
    is_fast_impulsive,
    build_adaptive_context_block,
    validate_directive,
)
from ai_elewa.core.security import verify_internal_key
from ai_elewa.core.config import settings
from ai_elewa.core.ai_client import get_client

logger = structlog.get_logger()
router = APIRouter()


class AdaptiveRequest(BaseModel):
    profile: str = Field(..., description="SNE profile: dyslexia, adhd, autism, intellectual_disability, dyscalculia, or combo like adhd+autism")
    language_level: int = Field(default=2, ge=1, le=5)
    is_correct: bool
    latency_ms: int = Field(..., ge=0, le=300_000, description="Time taken to answer in ms")
    consecutive_correct: int = Field(default=0, ge=0)
    consecutive_wrong: int = Field(default=0, ge=0)
    current_difficulty: int = Field(default=2, ge=1, le=5)
    lesson_id: Optional[str] = None


class AdaptiveResponse(BaseModel):
    directive: str  # "easier" | "same" | "harder" | "revisit"
    message: str
    adjusted_difficulty: int
    reasoning: str
    profile_applied: str
    latency_ms: int  # total processing time


@router.post("/adaptive", response_model=AdaptiveResponse)
async def adaptive_decision(
    request: AdaptiveRequest,
    _: str = Depends(verify_internal_key),
):
    """
    Determine the next difficulty directive based on the learner's SNE profile
    and current answer state. Called by the backend after every quiz answer.
    """
    start = time.perf_counter()
    profile_key = request.profile.lower().replace(" ", "_").replace("-", "_")

    try:
        # 1. Get the clinical rules for this profile
        rule = get_adaptive_rule(profile_key)
    except ValueError as e:
        logger.warning("Unknown profile requested, using default", profile=profile_key, error=str(e))
        rule = get_adaptive_rule("default")

    # 2. Apply profile-specific latency analysis
    adj_latency = adjusted_latency(request.latency_ms, rule)
    slow = is_slow(request.latency_ms, rule)
    impulsive = is_fast_impulsive(request.latency_ms, rule) if hasattr(rule, "fast_is_impulsive") and rule.fast_is_impulsive else False

    # 3. Build the AI context block
    context = build_adaptive_context_block(
        profile=profile_key,
        language_level=request.language_level,
        is_correct=request.is_correct,
        latency_ms=request.latency_ms,
        rule=rule,
        consecutive_correct=request.consecutive_correct,
        consecutive_wrong=request.consecutive_wrong,
    )

    # 4. Call the lightweight model for directive decision
    try:
        client = get_client()
        system_prompt = _adaptive_system_prompt()
        response = await client.chat.completions.create(
            model=settings.ADAPTIVE_MODEL or settings.MODEL_NAME,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": context},
            ],
            temperature=0.1,
            max_tokens=200,
            response_format={"type": "json_object"},
        )
        raw = response.choices[0].message.content
        result = json.loads(raw)
    except Exception as e:
        logger.error("AI adaptive call failed, using rule-based fallback", error=str(e))
        result = _rule_based_fallback(
            request.is_correct,
            request.consecutive_correct,
            request.consecutive_wrong,
            rule,
            request.current_difficulty,
        )

    # 5. Validate the directive against profile rules
    directive = result.get("directive", "same")
    validated_directive, validation_msg = validate_directive(directive, profile_key, rule)

    if validated_directive != directive:
        logger.info("Directive overridden by profile rules",
                    original=directive, final=validated_directive, reason=validation_msg)
        result["directive"] = validated_directive
        result["reasoning"] = f"{result.get('reasoning', '')} | Override: {validation_msg}"

    # 6. Calculate adjusted difficulty
    adjusted = request.current_difficulty
    if validated_directive == "harder":
        adjusted = min(5, request.current_difficulty + 1)
    elif validated_directive == "easier":
        adjusted = max(1, request.current_difficulty - 1)
    # "same" and "revisit" keep current difficulty

    elapsed = int((time.perf_counter() - start) * 1000)
    logger.info("Adaptive decision complete",
                profile=profile_key, directive=validated_directive,
                adjusted_difficulty=adjusted, latency_ms=elapsed)

    return AdaptiveResponse(
        directive=validated_directive,
        message=result.get("message", _default_message(validated_directive, profile_key)),
        adjusted_difficulty=adjusted,
        reasoning=result.get("reasoning", "Rule-based fallback"),
        profile_applied=profile_key,
        latency_ms=elapsed,
    )


def _adaptive_system_prompt() -> str:
    return """You are an adaptive learning assistant for learners with special educational needs (SNE).

Your task: determine the next difficulty directive based on the learner's current state.

Directives:
- "harder": learner is doing well, increase difficulty
- "same": maintain current level
- "easier": learner is struggling, reduce difficulty
- "revisit": re-present this concept differently (do not change difficulty)

Rules (from the profile context you receive):
- Some profiles NEVER allow "easier" (autism) — use "revisit" instead
- Some profiles require multiple consecutive correct before "harder" (intellectual_disability: 2)
- Some profiles have latency modifiers (dyslexia: 0.5x weight on reading time)
- Fast wrong answers for ADHD mean impulsivity, not lack of understanding — use "revisit" not "easier"

Message tone:
- Neutral for revisit: "Let us look at this again."
- Encouraging for harder: "Great work — let us try something more challenging."
- Supportive for easier: "Let us take a step back and build confidence."

Return ONLY a JSON object:
{"directive": "same", "message": "short message (max 20 words)", "reasoning": "brief explanation"}"""


def _default_message(directive: str, profile: str) -> str:
    messages = {
        "harder": "Great work — let us try something more challenging.",
        "same": "Keep going — you are doing well.",
        "easier": "Let us take a step back and build your confidence.",
        "revisit": "Let us look at this from a different angle.",
    }
    return messages.get(directive, "Good effort — let us continue.")


def _rule_based_fallback(
    is_correct: bool,
    consecutive_correct: int,
    consecutive_wrong: int,
    rule,
    current_difficulty: int,
) -> dict:
    """Deterministic fallback when the AI model is unavailable."""
    if is_correct:
        if rule.requires_consecutive_correct and consecutive_correct >= rule.requires_consecutive_correct:
            return {"directive": "harder", "message": "Excellent — time for a bigger challenge.", "reasoning": "Met consecutive correct threshold"}
        elif rule.requires_consecutive_correct:
            return {"directive": "same", "message": "Good — one more like that.", "reasoning": "Building toward consecutive correct threshold"}
        else:
            return {"directive": "harder", "message": "Well done — moving up.", "reasoning": "Correct answer, no threshold required"}
    else:
        if consecutive_wrong >= 2:
            if not rule.easier_allowed:
                return {"directive": "revisit", "message": "Let us try this concept a different way.", "reasoning": "Easier not allowed for profile, consecutive wrongs"}
            return {"directive": "easier", "message": "No worries — let us take a step back.", "reasoning": "Multiple consecutive wrong answers"}
        return {"directive": "same", "message": "Almost — try again with the next question.", "reasoning": "Single wrong answer, maintain difficulty"}

