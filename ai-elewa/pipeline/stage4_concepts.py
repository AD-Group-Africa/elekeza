import logging
from typing import Optional

from models.requests import LearnerContext
from models.responses import LessonJSON, KeyTerm, ReadabilityScore, ReadabilitySummary, RhythmScore
from utils.readability import (
    get_target,
    measure_section,
    validate_section,
    compute_lesson_summary,
)
from utils.rhythm import analyse_rhythm
from utils.visual_hints import standardise_hint

logger = logging.getLogger(__name__)


def _profile_label(learner_context: LearnerContext) -> str:
    """Join the cognitive profiles into a single label, e.g. 'dyslexia+adhd'."""
    return "+".join(learner_context.cognitive_profiles)


def measure_readability(lesson_json: LessonJSON, learner_context: LearnerContext) -> LessonJSON:
    """
    Stage 4b — pure function, no API call.
    Measures readability (Flesch, Flesch-Kincaid, SMOG) and sentence rhythm
    for every section against the learner's profile × language level targets.
    Attaches per-section ReadabilityScore/rhythm and a lesson-level
    ReadabilitySummary. Warnings are appended to stage_flags.readability_warnings.
    """
    profile = _profile_label(learner_context)
    language_level = learner_context.language_level
    target = get_target(profile, language_level)

    sections_with_scores: list[tuple[str, dict]] = []

    for section in lesson_json.sections:
        # Readability scores
        scores = measure_section(section.body)
        sections_with_scores.append((section.heading, scores))

        # Sentence rhythm
        rhythm = analyse_rhythm(section.heading, section.body, profile, language_level)

        section.readability = ReadabilityScore(
            flesch_reading_ease=scores["flesch_reading_ease"],
            flesch_kincaid_grade=scores["flesch_kincaid_grade"],
            smog_grade=scores["smog_grade"],
            rhythm=RhythmScore(
                score=rhythm["score"],
                profile_rule=rhythm["profile_rule"],
                violations=rhythm["violations"],
            ),
        )
        section.rhythm_score = rhythm["score"]

        # Readability warnings from profile targets
        warnings = validate_section(section.heading, section.body, scores, target)
        lesson_json.stage_flags.readability_warnings.extend(warnings)

        # Rhythm violations surface as warnings too
        for violation in rhythm["violations"]:
            if violation not in lesson_json.stage_flags.readability_warnings:
                lesson_json.stage_flags.readability_warnings.append(violation)

    summary = compute_lesson_summary(sections_with_scores, target)
    lesson_json.readability_summary = ReadabilitySummary(**summary)

    logger.info(
        f"Stage 4b complete — {len(lesson_json.sections)} section(s) measured, "
        f"within_target={summary['within_target']}"
    )
    return lesson_json


def standardise_visual_hints(lesson_json: LessonJSON, learner_context: LearnerContext) -> LessonJSON:
    """
    Stage 4c — pure function, no API call.
    Classifies and standardises each section's visual_hint against the
    learner's profile rules: rewrites abstract hints to concrete ones for
    the intellectual_disability profile, downgrades animation suggestions
    for the autism profile, and downgrades diagrams for dyslexia at
    language_level 1. Warnings are appended to stage_flags.readability_warnings.
    """
    profile = _profile_label(learner_context)
    language_level = learner_context.language_level

    for section in lesson_json.sections:
        hint, hint_type, warning = standardise_hint(
            section.visual_hint,
            section.heading,
            profile,
            language_level,
        )
        section.visual_hint = hint
        section.visual_hint_type = hint_type
        if warning and warning not in lesson_json.stage_flags.readability_warnings:
            lesson_json.stage_flags.readability_warnings.append(warning)

    logger.info(f"Stage 4c complete — {len(lesson_json.sections)} section(s) hint-standardised")
    return lesson_json


def extract_concepts(lesson_json: LessonJSON) -> LessonJSON:
    """
    Stage 4 — pure function, no API call.
    Extracts and deduplicates key_terms already present in the LessonJSON.
    Ensures all KeyTerm objects are properly formatted.
    Returns the updated LessonJSON — key_terms attached, stage_flags unchanged.
    """
    seen_terms: set[str] = set()
    cleaned_terms: list[KeyTerm] = []

    for kt in lesson_json.key_terms:
        # Normalise term for deduplication
        normalised = kt.term.strip().lower()

        if normalised in seen_terms:
            logger.debug(f"Stage 4 — duplicate term skipped: '{kt.term}'")
            continue

        # Skip empty terms or definitions
        if not kt.term.strip() or not kt.definition.strip():
            logger.debug(f"Stage 4 — empty term/definition skipped: '{kt.term}'")
            continue

        seen_terms.add(normalised)
        cleaned_terms.append(KeyTerm(
            term=kt.term.strip(),
            definition=kt.definition.strip(),
        ))

    logger.info(f"Stage 4 complete — {len(cleaned_terms)} key term(s) extracted")
    lesson_json.key_terms = cleaned_terms
    return lesson_json

