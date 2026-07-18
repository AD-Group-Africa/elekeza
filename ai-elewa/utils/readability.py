"""
Readability measurement utilities for the Elewa AI service.

Calculates per-section readability scores using three formulas:
  - Flesch Reading Ease (0–100, higher is easier)
  - Flesch-Kincaid Grade Level (US school grade equivalent)
  - SMOG Grade (accurate for polysyllabic-heavy content)

All functions are pure — no API calls, no side effects, no latency cost.

Profile-specific target ranges define what "appropriate" means for each
cognitive profile at each language level. These ranges are used to generate
readability_warnings when output falls outside acceptable bounds.
"""

import logging
import re
from dataclasses import dataclass
from typing import Optional

import textstat

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Target ranges per profile × language level
#
# Each entry defines the acceptable Flesch Reading Ease range and the
# maximum Flesch-Kincaid grade for that combination.
#
# Notes on profile-specific interpretation:
#   - Dyslexia:  linguistic complexity matters most — sentence length and
#                word form. Flesch is a reliable proxy.
#   - ADHD:      section length and rhythm matter more than raw Flesch score.
#                Flesch targets are wider; rhythm is checked separately.
#   - Autism:    figurative language is the primary concern, not complexity.
#                Flesch targets are moderate; idiom checks are separate.
#   - ID:        both vocabulary and sentence structure matter. Flesch is
#                the most direct proxy for this profile.
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class ReadabilityTarget:
    flesch_min: float          # minimum acceptable Flesch Reading Ease
    flesch_max: float          # maximum acceptable Flesch Reading Ease
    fk_grade_max: float        # maximum acceptable Flesch-Kincaid grade
    smog_grade_max: float      # maximum acceptable SMOG grade
    max_words_per_sentence: int  # hard limit per sentence (not average)
    max_sentences_per_section: int  # hard limit on section length


# Profile → language_level → ReadabilityTarget
READABILITY_TARGETS: dict[str, dict[int, ReadabilityTarget]] = {
    "dyslexia": {
        1: ReadabilityTarget(
            flesch_min=70, flesch_max=85,
            fk_grade_max=5.0, smog_grade_max=5.5,
            max_words_per_sentence=10,
            max_sentences_per_section=8,
        ),
        2: ReadabilityTarget(
            flesch_min=60, flesch_max=75,
            fk_grade_max=6.5, smog_grade_max=7.0,
            max_words_per_sentence=12,
            max_sentences_per_section=10,
        ),
        3: ReadabilityTarget(
            flesch_min=50, flesch_max=65,
            fk_grade_max=8.0, smog_grade_max=8.5,
            max_words_per_sentence=14,
            max_sentences_per_section=12,
        ),
    },
    "adhd": {
        # ADHD: section length and rhythm matter more than Flesch score.
        # Flesch targets are intentionally wider. Sentence rhythm is
        # checked separately in Improvement 2.
        1: ReadabilityTarget(
            flesch_min=65, flesch_max=90,
            fk_grade_max=6.0, smog_grade_max=6.5,
            max_words_per_sentence=14,
            max_sentences_per_section=3,
        ),
        2: ReadabilityTarget(
            flesch_min=55, flesch_max=85,
            fk_grade_max=7.5, smog_grade_max=8.0,
            max_words_per_sentence=16,
            max_sentences_per_section=5,
        ),
        3: ReadabilityTarget(
            flesch_min=45, flesch_max=80,
            fk_grade_max=9.0, smog_grade_max=9.5,
            max_words_per_sentence=18,
            max_sentences_per_section=7,
        ),
    },
    "autism": {
        # Autism: figurative language is the primary concern.
        # Flesch targets are moderate — complexity is acceptable if
        # language is literal and transitions are explicit.
        1: ReadabilityTarget(
            flesch_min=65, flesch_max=85,
            fk_grade_max=5.5, smog_grade_max=6.0,
            max_words_per_sentence=10,
            max_sentences_per_section=9,
        ),
        2: ReadabilityTarget(
            flesch_min=55, flesch_max=78,
            fk_grade_max=7.0, smog_grade_max=7.5,
            max_words_per_sentence=15,
            max_sentences_per_section=12,
        ),
        3: ReadabilityTarget(
            flesch_min=45, flesch_max=70,
            fk_grade_max=8.5, smog_grade_max=9.0,
            max_words_per_sentence=20,
            max_sentences_per_section=15,
        ),
    },
    "intellectual_disability": {
        # ID: strictest profile. Both axes — vocabulary and sentence
        # structure — must be within range. Flesch is the most direct proxy.
        1: ReadabilityTarget(
            flesch_min=80, flesch_max=100,
            fk_grade_max=4.0, smog_grade_max=4.5,
            max_words_per_sentence=8,
            max_sentences_per_section=4,
        ),
        2: ReadabilityTarget(
            flesch_min=70, flesch_max=90,
            fk_grade_max=5.0, smog_grade_max=5.5,
            max_words_per_sentence=10,
            max_sentences_per_section=6,
        ),
        3: ReadabilityTarget(
            flesch_min=60, flesch_max=80,
            fk_grade_max=6.0, smog_grade_max=6.5,
            max_words_per_sentence=12,
            max_sentences_per_section=8,
        ),
    },
}

# Fallback target when profile or level is not found in the table above.
# Deliberately lenient — should never be used in normal operation.
_FALLBACK_TARGET = ReadabilityTarget(
    flesch_min=40, flesch_max=100,
    fk_grade_max=12.0, smog_grade_max=12.0,
    max_words_per_sentence=25,
    max_sentences_per_section=20,
)


def get_target(profile: str, language_level: int) -> ReadabilityTarget:
    """
    Return the readability target for a profile + language level combination.
    Handles comorbid profile labels (e.g. 'dyslexia+adhd') by using the
    stricter of the two profiles' targets.
    """
    # Comorbid profiles are stored as 'profile_a+profile_b'
    if "+" in profile:
        parts = [p.strip() for p in profile.split("+")]
        targets = [
            READABILITY_TARGETS.get(p, {}).get(language_level, _FALLBACK_TARGET)
            for p in parts
        ]
        # Use the stricter target: higher flesch_min, lower fk_grade_max
        return ReadabilityTarget(
            flesch_min=max(t.flesch_min for t in targets),
            flesch_max=min(t.flesch_max for t in targets),
            fk_grade_max=min(t.fk_grade_max for t in targets),
            smog_grade_max=min(t.smog_grade_max for t in targets),
            max_words_per_sentence=min(t.max_words_per_sentence for t in targets),
            max_sentences_per_section=min(t.max_sentences_per_section for t in targets),
        )

    return READABILITY_TARGETS.get(profile, {}).get(language_level, _FALLBACK_TARGET)


# ---------------------------------------------------------------------------
# Per-section measurement
# ---------------------------------------------------------------------------

def _split_sentences(text: str) -> list[str]:
    """
    Split body text into individual sentences.
    Handles common abbreviations to reduce false splits.
    """
    # Normalise whitespace first
    text = re.sub(r"\s+", " ", text).strip()
    sentences = re.split(r"(?<=[.!?])\s+", text)
    return [s.strip() for s in sentences if s.strip()]


def measure_section(body: str) -> dict:
    """
    Calculate readability scores for a single section body.
    Returns a dict matching the ReadabilityScore schema.

    textstat requires a minimum amount of text to produce reliable scores.
    Sections with fewer than 30 words receive a warning rather than a score.
    """
    word_count = len(body.split())

    if word_count < 30:
        # Too short for reliable measurement — return conservative estimates
        logger.debug(f"Section too short for reliable readability ({word_count} words) — using estimates")
        return {
            "flesch_reading_ease": 80.0,
            "flesch_kincaid_grade": 4.0,
            "smog_grade": 4.0,
        }

    flesch = round(textstat.flesch_reading_ease(body), 1)
    fk_grade = round(textstat.flesch_kincaid_grade(body), 1)

    # SMOG requires at least 30 sentences for full accuracy.
    # For shorter sections, polysyllable_count gives a reasonable approximation.
    try:
        smog = round(textstat.smog_index(body), 1)
        if smog == 0.0:
            # textstat returns 0.0 when sentence count is too low for SMOG
            # Fall back to a syllable-based estimate
            smog = round(textstat.coleman_liau_index(body), 1)
    except Exception:
        smog = round(textstat.coleman_liau_index(body), 1)

    return {
        "flesch_reading_ease": flesch,
        "flesch_kincaid_grade": fk_grade,
        "smog_grade": smog,
    }


# ---------------------------------------------------------------------------
# Per-section validation against profile targets
# ---------------------------------------------------------------------------

def validate_section(
    heading: str,
    body: str,
    scores: dict,
    target: ReadabilityTarget,
) -> list[str]:
    """
    Compare a section's readability scores against the profile target.
    Returns a list of warning strings. Empty list means the section passes.
    """
    warnings = []
    sentences = _split_sentences(body)
    sentence_count = len(sentences)

    # Flesch Reading Ease — below minimum means too complex
    if scores["flesch_reading_ease"] < target.flesch_min:
        warnings.append(
            f"Section '{heading}': Flesch score {scores['flesch_reading_ease']:.1f} "
            f"is below target minimum {target.flesch_min:.0f} — content may be too complex."
        )

    # Flesch-Kincaid Grade — above maximum means too advanced
    if scores["flesch_kincaid_grade"] > target.fk_grade_max:
        warnings.append(
            f"Section '{heading}': Flesch-Kincaid grade {scores['flesch_kincaid_grade']:.1f} "
            f"exceeds target maximum grade {target.fk_grade_max:.1f}."
        )

    # SMOG Grade — above maximum means polysyllabic word density is too high
    if scores["smog_grade"] > target.smog_grade_max:
        warnings.append(
            f"Section '{heading}': SMOG grade {scores['smog_grade']:.1f} "
            f"exceeds target maximum grade {target.smog_grade_max:.1f} — "
            f"too many multi-syllable words."
        )

    # Section length — too many sentences for the profile
    if sentence_count > target.max_sentences_per_section:
        warnings.append(
            f"Section '{heading}': {sentence_count} sentences exceeds the "
            f"{target.max_sentences_per_section}-sentence limit for this profile and level."
        )

    # Per-sentence word count — check every sentence individually, not the average
    for i, sentence in enumerate(sentences):
        word_count = len(sentence.split())
        if word_count > target.max_words_per_sentence:
            warnings.append(
                f"Section '{heading}', sentence {i + 1}: {word_count} words exceeds "
                f"the {target.max_words_per_sentence}-word limit. "
                f"Sentence: '{sentence[:60]}{'...' if len(sentence) > 60 else ''}'"
            )

    return warnings


# ---------------------------------------------------------------------------
# Lesson-level summary
# ---------------------------------------------------------------------------

def compute_lesson_summary(
    sections_with_scores: list[tuple[str, dict]],
    target: ReadabilityTarget,
) -> dict:
    """
    Aggregate per-section scores into a lesson-level summary.

    Args:
        sections_with_scores: list of (heading, score_dict) tuples
        target: the readability target for this profile and level

    Returns a dict matching the ReadabilitySummary schema.
    """
    if not sections_with_scores:
        return {
            "avg_flesch_reading_ease": 0.0,
            "avg_flesch_kincaid_grade": 0.0,
            "avg_smog_grade": 0.0,
            "within_target": False,
            "target_flesch_min": target.flesch_min,
            "target_flesch_max": target.flesch_max,
        }

    scores = [s for _, s in sections_with_scores]
    avg_flesch = round(sum(s["flesch_reading_ease"] for s in scores) / len(scores), 1)
    avg_fk = round(sum(s["flesch_kincaid_grade"] for s in scores) / len(scores), 1)
    avg_smog = round(sum(s["smog_grade"] for s in scores) / len(scores), 1)

    within_target = (
        target.flesch_min <= avg_flesch <= target.flesch_max
        and avg_fk <= target.fk_grade_max
        and avg_smog <= target.smog_grade_max
    )

    return {
        "avg_flesch_reading_ease": avg_flesch,
        "avg_flesch_kincaid_grade": avg_fk,
        "avg_smog_grade": avg_smog,
        "within_target": within_target,
        "target_flesch_min": target.flesch_min,
        "target_flesch_max": target.flesch_max,
    }

