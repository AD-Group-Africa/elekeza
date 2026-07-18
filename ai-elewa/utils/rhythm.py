"""
Sentence rhythm analysis for the Elewa AI service.

Each cognitive profile has a distinct definition of good sentence rhythm.
This module measures rhythm per section and produces a score (0–1) and
a list of specific violations to include in readability_warnings.

All functions are pure — no API calls, no side effects, no latency cost.

Profile rhythm rules:
  Dyslexia           — every sentence must be within the maximum word limit.
                        No averaging. One violation fails that sentence.
  ADHD               — rhythm must alternate between short (4–8 words) and
                        longer (10–14 words). A wall of uniformly medium
                        sentences breaks engagement regardless of length.
  Autism             — consistent sentence length within a narrow band.
                        Unpredictable variation is cognitively disruptive.
  Intellectual Disability — every sentence must be within the hard limit.
                            Strictest rule. No exceptions.
"""

import re
import logging
from dataclasses import dataclass

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Sentence splitting
# ---------------------------------------------------------------------------

def split_sentences(text: str) -> list[str]:
    """
    Split body text into individual sentences.

    Handles:
    - Standard sentence-ending punctuation (. ! ?)
    - Common abbreviations that should not cause splits
    - Normalises whitespace before splitting
    """
    # Normalise whitespace
    text = re.sub(r"\s+", " ", text).strip()

    # Temporarily protect common abbreviations from splitting
    abbreviations = [
        r"Mr\.", r"Mrs\.", r"Dr\.", r"Prof\.", r"St\.",
        r"vs\.", r"etc\.", r"e\.g\.", r"i\.e\.", r"Fig\.",
    ]
    protected = text
    for abbr in abbreviations:
        protected = re.sub(abbr, abbr.replace(".", "<DOT>"), protected)

    # Split on sentence-ending punctuation followed by whitespace
    raw_sentences = re.split(r"(?<=[.!?])\s+", protected)

    # Restore abbreviation dots and clean up
    sentences = []
    for s in raw_sentences:
        restored = s.replace("<DOT>", ".")
        cleaned = restored.strip()
        if cleaned:
            sentences.append(cleaned)

    return sentences


def word_count(sentence: str) -> int:
    """Count words in a sentence, excluding punctuation-only tokens."""
    return len([w for w in sentence.split() if re.search(r"[a-zA-Z0-9]", w)])


# ---------------------------------------------------------------------------
# Profile rhythm rule definitions
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class RhythmRule:
    """
    Defines how sentence rhythm is evaluated for a profile and level.

    hard_max: no sentence may exceed this word count (None = no hard limit)
    hard_min: no sentence may fall below this word count (None = no minimum)
    short_range: (min, max) word count defining a "short" sentence
    long_range: (min, max) word count defining a "long" sentence
    alternation_required: if True, score penalises runs of same-length sentences
    consistency_band: max allowed word count variance between consecutive
                      sentences (None = not enforced)
    rule_description: human-readable description shown in RhythmScore.profile_rule
    """
    hard_max: int | None
    hard_min: int | None
    short_range: tuple[int, int] | None
    long_range: tuple[int, int] | None
    alternation_required: bool
    consistency_band: int | None
    rule_description: str


# Profile → language_level → RhythmRule
RHYTHM_RULES: dict[str, dict[int, RhythmRule]] = {
    "dyslexia": {
        # Dyslexia: every sentence must be within the hard maximum.
        # No averaging. The primary barrier is decoding — one long sentence
        # disrupts the reading flow for the entire section.
        1: RhythmRule(
            hard_max=10, hard_min=None,
            short_range=None, long_range=None,
            alternation_required=False,
            consistency_band=None,
            rule_description=(
                "Dyslexia L1: every sentence must be 10 words or fewer. "
                "No sentence averaging — each sentence is checked individually."
            ),
        ),
        2: RhythmRule(
            hard_max=12, hard_min=None,
            short_range=None, long_range=None,
            alternation_required=False,
            consistency_band=None,
            rule_description=(
                "Dyslexia L2: every sentence must be 12 words or fewer."
            ),
        ),
        3: RhythmRule(
            hard_max=14, hard_min=None,
            short_range=None, long_range=None,
            alternation_required=False,
            consistency_band=None,
            rule_description=(
                "Dyslexia L3: every sentence must be 14 words or fewer."
            ),
        ),
    },
    "adhd": {
        # ADHD: rhythm must alternate between short and long sentences.
        # A wall of uniformly medium sentences breaks engagement regardless
        # of average length. Variety is what sustains attention.
        1: RhythmRule(
            hard_max=14, hard_min=None,
            short_range=(3, 7), long_range=(9, 14),
            alternation_required=True,
            consistency_band=None,
            rule_description=(
                "ADHD L1: rhythm must alternate between short (3–7 words) "
                "and longer (9–14 words) sentences. "
                "No more than 2 consecutive sentences of the same length type."
            ),
        ),
        2: RhythmRule(
            hard_max=16, hard_min=None,
            short_range=(4, 8), long_range=(10, 16),
            alternation_required=True,
            consistency_band=None,
            rule_description=(
                "ADHD L2: rhythm must alternate between short (4–8 words) "
                "and longer (10–16 words) sentences."
            ),
        ),
        3: RhythmRule(
            hard_max=18, hard_min=None,
            short_range=(4, 9), long_range=(11, 18),
            alternation_required=True,
            consistency_band=None,
            rule_description=(
                "ADHD L3: rhythm must alternate between short (4–9 words) "
                "and longer (11–18 words) sentences."
            ),
        ),
    },
    "autism": {
        # Autism: consistent, predictable sentence length.
        # Unexpected variation is cognitively disruptive. A very short
        # sentence after a long one breaks the predictable pattern autistic
        # learners rely on to manage cognitive load.
        1: RhythmRule(
            hard_max=10, hard_min=4,
            short_range=None, long_range=None,
            alternation_required=False,
            consistency_band=4,  # consecutive sentences should not vary by >4 words
            rule_description=(
                "Autism L1: sentence length must be consistent (4–10 words). "
                "Consecutive sentences should not vary by more than 4 words."
            ),
        ),
        2: RhythmRule(
            hard_max=15, hard_min=4,
            short_range=None, long_range=None,
            alternation_required=False,
            consistency_band=5,
            rule_description=(
                "Autism L2: sentence length must be consistent (4–15 words). "
                "Consecutive sentences should not vary by more than 5 words."
            ),
        ),
        3: RhythmRule(
            hard_max=20, hard_min=4,
            short_range=None, long_range=None,
            alternation_required=False,
            consistency_band=6,
            rule_description=(
                "Autism L3: sentence length must be consistent (4–20 words). "
                "Consecutive sentences should not vary by more than 6 words."
            ),
        ),
    },
    "intellectual_disability": {
        # ID: strictest profile. Every sentence must be within the hard limit.
        # No exceptions. Average sentence length is meaningless here — one
        # long sentence is one too many.
        1: RhythmRule(
            hard_max=8, hard_min=None,
            short_range=None, long_range=None,
            alternation_required=False,
            consistency_band=None,
            rule_description=(
                "Intellectual Disability L1: every sentence must be "
                "8 words or fewer. No exceptions."
            ),
        ),
        2: RhythmRule(
            hard_max=10, hard_min=None,
            short_range=None, long_range=None,
            alternation_required=False,
            consistency_band=None,
            rule_description=(
                "Intellectual Disability L2: every sentence must be "
                "10 words or fewer."
            ),
        ),
        3: RhythmRule(
            hard_max=12, hard_min=None,
            short_range=None, long_range=None,
            alternation_required=False,
            consistency_band=None,
            rule_description=(
                "Intellectual Disability L3: every sentence must be "
                "12 words or fewer."
            ),
        ),
    },
}

_FALLBACK_RULE = RhythmRule(
    hard_max=25, hard_min=None,
    short_range=None, long_range=None,
    alternation_required=False,
    consistency_band=None,
    rule_description="Fallback rule — no profile match found.",
)


def get_rhythm_rule(profile: str, language_level: int) -> RhythmRule:
    """
    Return the rhythm rule for a profile + language level combination.
    For comorbid profiles, uses the stricter of the two profiles' rules.
    """
    if "+" in profile:
        parts = [p.strip() for p in profile.split("+")]
        rules = [
            RHYTHM_RULES.get(p, {}).get(language_level, _FALLBACK_RULE)
            for p in parts
        ]
        # Stricter = lower hard_max, higher hard_min
        strict_max = min(
            (r.hard_max for r in rules if r.hard_max is not None),
            default=25,
        )
        strict_min = max(
            (r.hard_min for r in rules if r.hard_min is not None),
            default=None,  # type: ignore[arg-type]
        )
        # Alternation required if either profile requires it
        alternation = any(r.alternation_required for r in rules)
        # Consistency band: use the tighter (smaller) value
        bands = [r.consistency_band for r in rules if r.consistency_band is not None]
        band = min(bands) if bands else None

        return RhythmRule(
            hard_max=strict_max,
            hard_min=strict_min if strict_min != 0 else None,
            short_range=next((r.short_range for r in rules if r.short_range), None),
            long_range=next((r.long_range for r in rules if r.long_range), None),
            alternation_required=alternation,
            consistency_band=band,
            rule_description=(
                f"Comorbid {profile}: strictest rules from each profile applied."
            ),
        )

    return RHYTHM_RULES.get(profile, {}).get(language_level, _FALLBACK_RULE)


# ---------------------------------------------------------------------------
# Rhythm scoring
# ---------------------------------------------------------------------------

def _classify_sentence(wc: int, rule: RhythmRule) -> str:
    """Classify a sentence as 'short', 'medium', or 'long' per the rule."""
    if rule.short_range and rule.short_range[0] <= wc <= rule.short_range[1]:
        return "short"
    if rule.long_range and rule.long_range[0] <= wc <= rule.long_range[1]:
        return "long"
    return "medium"


def _score_dyslexia_id(
    sentences: list[str],
    counts: list[int],
    rule: RhythmRule,
    heading: str,
) -> tuple[float, list[str]]:
    """
    Scoring logic for Dyslexia and ID profiles.
    Every sentence must be within the hard maximum.
    Score = proportion of sentences that pass.
    """
    violations = []
    passing = 0

    for i, (sentence, wc) in enumerate(zip(sentences, counts)):
        if rule.hard_max and wc > rule.hard_max:
            preview = sentence[:70] + ("..." if len(sentence) > 70 else "")
            violations.append(
                f"Section '{heading}', sentence {i + 1} ({wc} words exceeds "
                f"{rule.hard_max}-word limit): '{preview}'"
            )
        else:
            passing += 1

    score = passing / len(sentences) if sentences else 1.0
    return round(score, 3), violations


def _score_adhd(
    sentences: list[str],
    counts: list[int],
    rule: RhythmRule,
    heading: str,
) -> tuple[float, list[str]]:
    """
    Scoring logic for ADHD profile.
    Rhythm must alternate between short and long sentence types.
    Penalises runs of more than 2 consecutive same-type sentences.
    Also enforces the hard_max limit.
    """
    violations = []
    penalties = 0
    total_checks = 0

    # Check hard maximum
    for i, (sentence, wc) in enumerate(zip(sentences, counts)):
        if rule.hard_max and wc > rule.hard_max:
            preview = sentence[:70] + ("..." if len(sentence) > 70 else "")
            violations.append(
                f"Section '{heading}', sentence {i + 1} ({wc} words exceeds "
                f"{rule.hard_max}-word limit): '{preview}'"
            )
            penalties += 1
        total_checks += 1

    # Check alternation — penalise runs of 3+ same-type sentences
    if rule.alternation_required and len(counts) >= 3:
        classifications = [_classify_sentence(wc, rule) for wc in counts]
        run_length = 1
        for i in range(1, len(classifications)):
            if classifications[i] == classifications[i - 1] and classifications[i] != "medium":
                run_length += 1
                if run_length >= 3:
                    violations.append(
                        f"Section '{heading}': {run_length} consecutive "
                        f"'{classifications[i]}' sentences at position {i + 1}. "
                        f"ADHD profile requires alternation between short and longer sentences."
                    )
                    penalties += 1
                    total_checks += 1
            else:
                run_length = 1

    score = max(0.0, 1.0 - (penalties / max(total_checks, 1)))
    return round(score, 3), violations


def _score_autism(
    sentences: list[str],
    counts: list[int],
    rule: RhythmRule,
    heading: str,
) -> tuple[float, list[str]]:
    """
    Scoring logic for Autism profile.
    Sentence lengths must be consistent — no unexpected jumps.
    Penalises consecutive sentences that vary by more than the consistency_band.
    Also enforces hard_max and hard_min.
    """
    violations = []
    penalties = 0
    total_checks = len(sentences)

    for i, (sentence, wc) in enumerate(zip(sentences, counts)):
        # Hard maximum
        if rule.hard_max and wc > rule.hard_max:
            preview = sentence[:70] + ("..." if len(sentence) > 70 else "")
            violations.append(
                f"Section '{heading}', sentence {i + 1} ({wc} words exceeds "
                f"{rule.hard_max}-word maximum): '{preview}'"
            )
            penalties += 1

        # Hard minimum
        if rule.hard_min and wc < rule.hard_min:
            preview = sentence[:70] + ("..." if len(sentence) > 70 else "")
            violations.append(
                f"Section '{heading}', sentence {i + 1} ({wc} words is below "
                f"{rule.hard_min}-word minimum): '{preview}'"
            )
            penalties += 1

        # Consistency band — check against previous sentence
        if i > 0 and rule.consistency_band is not None:
            variance = abs(wc - counts[i - 1])
            if variance > rule.consistency_band:
                violations.append(
                    f"Section '{heading}', sentence {i + 1}: length varies by "
                    f"{variance} words from previous sentence (maximum allowed: "
                    f"{rule.consistency_band}). Autism profile requires consistent "
                    f"sentence length for predictability."
                )
                penalties += 1
                total_checks += 1

    score = max(0.0, 1.0 - (penalties / max(total_checks, 1)))
    return round(score, 3), violations


# ---------------------------------------------------------------------------
# Public interface
# ---------------------------------------------------------------------------

def analyse_rhythm(
    heading: str,
    body: str,
    profile: str,
    language_level: int,
) -> dict:
    """
    Analyse the sentence rhythm of a section body for a given profile and level.

    Returns a dict matching the RhythmScore schema:
        score:        float 0.0–1.0 (higher is better)
        profile_rule: str describing which rule was applied
        violations:   list of specific violation descriptions

    This function is the single entry point for rhythm analysis.
    All profile-specific logic is delegated to the internal scoring functions.
    """
    rule = get_rhythm_rule(profile, language_level)
    sentences = split_sentences(body)

    if len(sentences) < 2:
        # Single-sentence sections cannot be rhythm-checked meaningfully
        return {
            "score": 1.0,
            "profile_rule": rule.rule_description,
            "violations": [],
        }

    counts = [word_count(s) for s in sentences]

    # Route to profile-specific scorer
    # Comorbid profiles use the stricter rule but the same scoring approach
    base_profile = profile.split("+")[0].strip() if "+" in profile else profile

    if base_profile in ("dyslexia", "intellectual_disability"):
        score, violations = _score_dyslexia_id(sentences, counts, rule, heading)
    elif base_profile == "adhd":
        score, violations = _score_adhd(sentences, counts, rule, heading)
    elif base_profile == "autism":
        score, violations = _score_autism(sentences, counts, rule, heading)
    else:
        # Unknown profile — use the hard_max check only
        score, violations = _score_dyslexia_id(sentences, counts, rule, heading)

    return {
        "score": score,
        "profile_rule": rule.rule_description,
        "violations": violations,
    }

