import logging
from models.requests import LearnerContext
from models.responses import (
    LessonJSON,
    KeyTerm,
    ReadabilityScore,
    ReadabilitySummary,
)
from utils.readability import (
    get_target,
    measure_section,
    validate_section,
    compute_lesson_summary,
)

from utils.rhythm import analyse_rhythm

from models.responses import (
    LessonJSON,
    KeyTerm,
    ReadabilityScore,
    ReadabilitySummary,
    RhythmScore,
)
from utils.visual_hints import standardise_hint

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Concept extraction
# ---------------------------------------------------------------------------

def extract_concepts(lesson_json: LessonJSON) -> LessonJSON:
    """
    Deduplicate and clean key_terms already present in the LessonJSON.

    Rules:
      - Deduplication is case-insensitive on the term field.
      - Terms with empty text or empty definitions are removed.
      - Whitespace is stripped from both fields.
      - The first occurrence of a duplicate term is kept.
    """
    seen_terms: set[str] = set()
    cleaned_terms: list[KeyTerm] = []

    for kt in lesson_json.key_terms:
        normalised = kt.term.strip().lower()

        if not normalised:
            logger.debug(f"Stage 4 — empty term skipped")
            continue

        if not kt.definition.strip():
            logger.debug(f"Stage 4 — term '{kt.term}' skipped: empty definition")
            continue

        if normalised in seen_terms:
            logger.debug(f"Stage 4 — duplicate term skipped: '{kt.term}'")
            continue

        seen_terms.add(normalised)
        cleaned_terms.append(KeyTerm(
            term=kt.term.strip(),
            definition=kt.definition.strip(),
        ))

    logger.info(f"Stage 4 — {len(cleaned_terms)} key term(s) extracted")
    lesson_json.key_terms = cleaned_terms
    return lesson_json

def standardise_visual_hints(
    lesson_json: LessonJSON,
    learner_context: LearnerContext,
) -> LessonJSON:
    """
    Standardise visual hints for all sections in the lesson.

    For each section:
      1. Classify the visual_hint string into a structured type.
      2. Validate the type against profile-specific rules.
      3. Rewrite or downgrade if the type violates profile rules.
      4. Attach the final hint type to section.visual_hint_type.
      5. Collect any rewrite warnings into stage_flags.readability_warnings.

    Profile rules enforced:
      - Intellectual Disability: photo or illustration only. Abstract hints
        are rewritten to concrete equivalents automatically.
      - Autism: no animation_suggestion. Downgraded to illustration.
      - Dyslexia L1: no diagram. Downgraded to illustration.
      - All others: all types permitted.

    Pure function — no API calls, no latency cost.
    """
    profiles = learner_context.cognitive_profiles
    profile_label = (
        profiles[0] if len(profiles) == 1
        else f"{profiles[0]}+{profiles[1]}"
    )
    language_level = learner_context.language_level
    hint_warnings: list[str] = []
    rewrites = 0
    downgrades = 0

    for section in lesson_json.sections:
        final_hint, hint_type, warning = standardise_hint(
            hint=section.visual_hint,
            heading=section.heading,
            profile=profile_label,
            language_level=language_level,
        )

        section.visual_hint = final_hint
        section.visual_hint_type = hint_type

        if warning:
            hint_warnings.append(warning)
            if "rewritten" in warning:
                rewrites += 1
            elif "downgraded" in warning:
                downgrades += 1

        logger.debug(
            f"Stage 4 — '{section.heading}': "
            f"visual_hint_type={hint_type or 'none'}"
            + (f" [rewritten]" if warning and "rewritten" in warning else "")
            + (f" [downgraded]" if warning and "downgraded" in warning else "")
        )

    # Append visual hint warnings to any existing readability warnings
    lesson_json.stage_flags.readability_warnings.extend(hint_warnings)

    if rewrites or downgrades:
        logger.info(
            f"Stage 4 — visual hint standardisation [{profile_label} L{language_level}]: "
            f"{rewrites} rewrite(s), {downgrades} downgrade(s) applied."
        )
    else:
        logger.info(
            f"Stage 4 — visual hint standardisation [{profile_label} L{language_level}]: "
            f"all hints within profile rules."
        )

    return lesson_json


# ---------------------------------------------------------------------------
# Readability measurement
# ---------------------------------------------------------------------------

def measure_readability(
    lesson_json: LessonJSON,
    learner_context: LearnerContext,
) -> LessonJSON:
    """
    Measure readability and sentence rhythm of every section in the lesson.

    For each section:
      1. Calculate Flesch Reading Ease, Flesch-Kincaid Grade, and SMOG Grade.
      2. Validate scores against the profile + language_level target.
      3. Analyse sentence rhythm against profile-specific rhythm rules.
      4. Attach all scores to the section.
      5. Collect warnings from both readability and rhythm checks.

    Then aggregate section scores into a lesson-level ReadabilitySummary.
    """
    profiles = learner_context.cognitive_profiles
    profile_label = (
        profiles[0] if len(profiles) == 1
        else f"{profiles[0]}+{profiles[1]}"
    )
    language_level = learner_context.language_level

    target = get_target(profile_label, language_level)
    all_warnings: list[str] = []
    sections_with_scores: list[tuple[str, dict]] = []

    for section in lesson_json.sections:

        # ── Readability scores ────────────────────────────────────────────
        scores = measure_section(section.body)

        readability_warnings = validate_section(
            heading=section.heading,
            body=section.body,
            scores=scores,
            target=target,
        )
        all_warnings.extend(readability_warnings)
        sections_with_scores.append((section.heading, scores))

        # ── Rhythm analysis ───────────────────────────────────────────────
        rhythm_result = analyse_rhythm(
            heading=section.heading,
            body=section.body,
            profile=profile_label,
            language_level=language_level,
        )

        rhythm_score_value = rhythm_result["score"]
        rhythm_violations = rhythm_result["violations"]

        # Sections with rhythm score below 0.6 are flagged in warnings
        if rhythm_score_value < 0.6:
            all_warnings.extend(rhythm_violations)
            logger.warning(
                f"Stage 4 — rhythm score {rhythm_score_value:.2f} below threshold "
                f"for '{section.heading}' [{profile_label} L{language_level}]"
            )
        elif rhythm_violations:
            # Score is acceptable but violations exist — log at debug level only
            logger.debug(
                f"Stage 4 — '{section.heading}': "
                f"rhythm score {rhythm_score_value:.2f} (minor violations not flagged)"
            )

        # ── Attach all scores to the section ─────────────────────────────
        section.readability = ReadabilityScore(
            flesch_reading_ease=scores["flesch_reading_ease"],
            flesch_kincaid_grade=scores["flesch_kincaid_grade"],
            smog_grade=scores["smog_grade"],
            rhythm=RhythmScore(
                score=rhythm_score_value,
                profile_rule=rhythm_result["profile_rule"],
                violations=rhythm_violations,
            ),
        )
        section.rhythm_score = rhythm_score_value

        # ── Debug summary per section ─────────────────────────────────────
        logger.debug(
            f"Stage 4 — '{section.heading}': "
            f"Flesch {scores['flesch_reading_ease']:.1f}, "
            f"FK grade {scores['flesch_kincaid_grade']:.1f}, "
            f"SMOG {scores['smog_grade']:.1f}, "
            f"rhythm {rhythm_score_value:.2f}"
        )

    # ── Stage flags and lesson summary ────────────────────────────────────
    lesson_json.stage_flags.readability_warnings = all_warnings

    summary_data = compute_lesson_summary(sections_with_scores, target)
    lesson_json.readability_summary = ReadabilitySummary(**summary_data)

    # ── Log overall result ────────────────────────────────────────────────
    summary = lesson_json.readability_summary
    status = "✅ within target" if summary.within_target else "⚠️  outside target"
    rhythm_scores = [
        s.readability.rhythm.score
        for s in lesson_json.sections
        if s.readability and s.readability.rhythm
    ]
    avg_rhythm = round(sum(rhythm_scores) / len(rhythm_scores), 2) if rhythm_scores else 0.0

    logger.info(
        f"Stage 4 — [{profile_label} L{language_level}] "
        f"Flesch {summary.avg_flesch_reading_ease:.1f} "
        f"(target {summary.target_flesch_min:.0f}–{summary.target_flesch_max:.0f}), "
        f"FK grade {summary.avg_flesch_kincaid_grade:.1f}, "
        f"SMOG {summary.avg_smog_grade:.1f}, "
        f"avg rhythm {avg_rhythm:.2f} — {status}"
    )

    if all_warnings:
        logger.warning(
            f"Stage 4 — {len(all_warnings)} total warning(s). "
            f"Check stage_flags.readability_warnings in the response."
        )

    return lesson_json