"""
Profile-specific adaptive directive rules for the Elekeza AI service.

The current adaptive system is profile-blind. It uses the same latency
threshold and correctness logic for every learner, producing outcomes
that are inappropriate — and in some cases genuinely harmful — for
specific cognitive profiles.

This module defines the rules that override or modify the default
directive logic per profile. These rules are:

  1. Injected into the adaptive response system prompt so the AI model
     applies them when generating the directive.
  2. Used to build a structured context block that describes the
     learner's current situation to the model in precise terms.
  3. Used post-response to validate that the returned directive is
     consistent with the profile rules (safety check).

Profile rules summary:

  Dyslexia
    A slow response often reflects decoding time, not conceptual
    difficulty. Latency is weighted at 50% of its normal influence.
    A slow correct answer should not trigger same — it should remain
    harder unless latency is very high. A slow wrong answer should
    trigger revisit, not easier.

  ADHD
    A fast wrong answer often indicates impulsivity rather than lack
    of knowledge. Fast wrong answers trigger revisit with a slow-down
    message, not easier. Latency below 2000ms on a wrong answer is
    treated as an impulsivity signal regardless of difficulty.

  Autism
    The directive easier signals failure and causes distress. It is
    never returned for autism profiles under any circumstances.
    revisit replaces easier in all cases. The learner message for
    revisit is phrased as "let us look at this again" rather than
    anything that implies they got it wrong.

  Intellectual Disability
    A single correct answer never triggers harder. The learner must
    demonstrate consistency before escalating. The system tracks
    this via consecutive_correct in the request context (if provided).
    Without that signal, a correct answer returns same, not harder.
    A wrong answer always returns revisit before easier — the learner
    gets a second chance before the difficulty drops.
"""

import logging
from dataclasses import dataclass
from typing import Optional, Literal

logger = logging.getLogger(__name__)

DirectiveType = Literal["easier", "same", "harder", "revisit"]

# Latency thresholds in milliseconds
LATENCY_SLOW_THRESHOLD_MS = 5000    # above this = slow response
LATENCY_FAST_THRESHOLD_MS = 2000    # below this = fast response
LATENCY_VERY_SLOW_MS = 8000         # above this = very slow (decoding time)

# Minimum consecutive correct answers before ID learner escalates to harder
ID_MIN_CONSECUTIVE_FOR_HARDER = 2


# ---------------------------------------------------------------------------
# Profile rule definitions
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class AdaptiveRule:
    """
    Defines how the adaptive directive is determined for a profile.

    Fields:
        easier_allowed:         if False, 'easier' is never returned.
                                revisit is used instead.
        latency_weight:         multiplier applied to latency influence.
                                1.0 = normal, 0.5 = half influence.
        fast_wrong_is_impulsive: if True, fast wrong answers trigger
                                  revisit rather than easier.
        requires_consecutive_correct: if > 0, 'harder' requires this many
                                       consecutive correct answers.
        revisit_message_framing: how revisit should be framed in the message.
                                  'neutral' | 'encouraging' | 'slow_down'
        rule_description:       human-readable summary for logging and prompts.
    """
    easier_allowed: bool
    latency_weight: float
    fast_wrong_is_impulsive: bool
    requires_consecutive_correct: int
    revisit_message_framing: str
    rule_description: str


ADAPTIVE_RULES: dict[str, AdaptiveRule] = {
    "dyslexia": AdaptiveRule(
        easier_allowed=True,
        latency_weight=0.5,
        fast_wrong_is_impulsive=False,
        requires_consecutive_correct=0,
        revisit_message_framing="encouraging",
        rule_description=(
            "Dyslexia: latency weighted at 50% — slow responses reflect "
            "decoding time, not conceptual difficulty. A slow correct answer "
            "stays at 'harder' unless latency exceeds 8000ms. A slow wrong "
            "answer triggers 'revisit', not 'easier'."
        ),
    ),
    "adhd": AdaptiveRule(
        easier_allowed=True,
        latency_weight=1.2,
        fast_wrong_is_impulsive=True,
        requires_consecutive_correct=0,
        revisit_message_framing="slow_down",
        rule_description=(
            "ADHD: fast wrong answers (under 2000ms) are treated as impulsivity "
            "signals, not knowledge gaps. Return 'revisit' with a slow-down "
            "message rather than 'easier'. Latency weighted at 1.2x."
        ),
    ),
    "autism": AdaptiveRule(
        easier_allowed=False,
        latency_weight=1.0,
        fast_wrong_is_impulsive=False,
        requires_consecutive_correct=0,
        revisit_message_framing="neutral",
        rule_description=(
            "Autism: 'easier' is never returned. It signals failure and causes "
            "distress. Use 'revisit' in all cases where 'easier' would normally "
            "apply. Frame revisit as 'let us look at this again' — never as "
            "an indication of wrong answer."
        ),
    ),
    "intellectual_disability": AdaptiveRule(
        easier_allowed=True,
        latency_weight=1.0,
        fast_wrong_is_impulsive=False,
        requires_consecutive_correct=ID_MIN_CONSECUTIVE_FOR_HARDER,
        revisit_message_framing="encouraging",
        rule_description=(
            "Intellectual Disability: 'harder' requires at least 2 consecutive "
            "correct answers. A single correct answer returns 'same'. "
            "A wrong answer returns 'revisit' before 'easier' — the learner "
            "gets a second chance before difficulty drops."
        ),
    ),
}

_FALLBACK_RULE = AdaptiveRule(
    easier_allowed=True,
    latency_weight=1.0,
    fast_wrong_is_impulsive=False,
    requires_consecutive_correct=0,
    revisit_message_framing="neutral",
    rule_description="Default rule — no profile-specific override.",
)


def get_adaptive_rule(profile: str) -> AdaptiveRule:
    """
    Return the adaptive rule for a profile.
    For comorbid profiles, applies the most protective rule across both profiles.
    """
    if "+" in profile:
        parts = [p.strip() for p in profile.split("+")]
        rules = [ADAPTIVE_RULES.get(p, _FALLBACK_RULE) for p in parts]
        # Most protective = easier_allowed is False if any profile forbids it
        easier_allowed = all(r.easier_allowed for r in rules)
        # Lowest latency weight (most conservative)
        latency_weight = min(r.latency_weight for r in rules)
        # Impulsive check if any profile requires it
        fast_wrong_is_impulsive = any(r.fast_wrong_is_impulsive for r in rules)
        # Highest consecutive correct requirement
        requires_consecutive = max(r.requires_consecutive_correct for r in rules)
        # Most protective framing: neutral > encouraging > slow_down
        framing_priority = {"neutral": 0, "encouraging": 1, "slow_down": 2}
        revisit_framing = min(
            (r.revisit_message_framing for r in rules),
            key=lambda f: framing_priority.get(f, 99),
        )
        return AdaptiveRule(
            easier_allowed=easier_allowed,
            latency_weight=latency_weight,
            fast_wrong_is_impulsive=fast_wrong_is_impulsive,
            requires_consecutive_correct=requires_consecutive,
            revisit_message_framing=revisit_framing,
            rule_description=(
                f"Comorbid {profile}: most protective rules from each profile applied."
            ),
        )

    return ADAPTIVE_RULES.get(profile, _FALLBACK_RULE)


# ---------------------------------------------------------------------------
# Adjusted latency computation
# ---------------------------------------------------------------------------

def adjusted_latency(latency_ms: int, rule: AdaptiveRule) -> float:
    """
    Apply the profile's latency weight to the raw latency value.

    For dyslexia (weight 0.5), a 6000ms response is treated as 3000ms —
    within the normal range, not triggering a difficulty drop.
    For ADHD (weight 1.2), latency is slightly amplified to make slowness
    more visible to the directive logic.
    """
    return latency_ms * rule.latency_weight


def is_slow(latency_ms: int, rule: AdaptiveRule) -> bool:
    """Return True if the adjusted latency exceeds the slow threshold."""
    return adjusted_latency(latency_ms, rule) > LATENCY_SLOW_THRESHOLD_MS


def is_very_slow(latency_ms: int, rule: AdaptiveRule) -> bool:
    """Return True if the adjusted latency exceeds the very slow threshold."""
    return adjusted_latency(latency_ms, rule) > LATENCY_VERY_SLOW_MS


def is_fast_wrong(latency_ms: int, is_correct: bool, rule: AdaptiveRule) -> bool:
    """
    Return True if this looks like an impulsive wrong answer.
    Only relevant when rule.fast_wrong_is_impulsive is True.
    """
    return (
        rule.fast_wrong_is_impulsive
        and not is_correct
        and latency_ms < LATENCY_FAST_THRESHOLD_MS
    )


# ---------------------------------------------------------------------------
# Directive safety check
# ---------------------------------------------------------------------------

def validate_directive(
    directive: str,
    profile: str,
    rule: AdaptiveRule,
) -> tuple[str, str]:
    """
    Validate a directive against the profile rule.
    If the directive violates the rule, returns a corrected directive
    with a reason explaining the override.

    Returns:
        (validated_directive, reason_string)
    """
    if directive == "easier" and not rule.easier_allowed:
        corrected = "revisit"
        reason = (
            f"Directive overridden: 'easier' → 'revisit' for {profile} profile. "
            f"Rule: {rule.rule_description}"
        )
        logger.warning(
            f"Adaptive safety check: 'easier' directive blocked for {profile} profile. "
            f"Returning 'revisit' instead."
        )
        return corrected, reason

    return directive, f"Directive '{directive}' is within profile rules for {profile}."


# ---------------------------------------------------------------------------
# System prompt builder
# ---------------------------------------------------------------------------

def build_adaptive_context_block(
    profile: str,
    language_level: int,
    is_correct: bool,
    latency_ms: int,
    rule: AdaptiveRule,
) -> str:
    """
    Build a structured context block to inject into the adaptive response
    system prompt. This gives the model precise, pre-computed signals
    rather than asking it to interpret raw latency values itself.

    Returns a formatted string block for inclusion in the system prompt.
    """
    adj_latency = adjusted_latency(latency_ms, rule)
    slow = is_slow(latency_ms, rule)
    very_slow = is_very_slow(latency_ms, rule)
    impulsive = is_fast_wrong(latency_ms, is_correct, rule)

    outcome = "CORRECT" if is_correct else "INCORRECT"
    speed = "very slow" if very_slow else ("slow" if slow else "normal")
    if latency_ms < LATENCY_FAST_THRESHOLD_MS:
        speed = "fast"

    context = f"""--- PROFILE-SPECIFIC ADAPTIVE CONTEXT ---
Profile: {profile}
Language level: {language_level}
Answer outcome: {outcome}
Raw response time: {latency_ms}ms
Adjusted response time: {adj_latency:.0f}ms (latency weight: {rule.latency_weight})
Speed classification: {speed}
Impulsivity signal: {"YES — fast wrong answer, treat as impulsivity not knowledge gap" if impulsive else "no"}
Easier directive allowed: {"NO — use revisit instead" if not rule.easier_allowed else "yes"}
Consecutive correct required for harder: {rule.requires_consecutive_correct if rule.requires_consecutive_correct > 0 else "none — single correct answer is sufficient"}
Revisit message framing: {rule.revisit_message_framing}

Profile rule summary:
{rule.rule_description}
--- END PROFILE CONTEXT ---"""

    return context