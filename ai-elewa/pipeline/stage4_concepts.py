import logging
from models.responses import LessonJSON, KeyTerm, ReadabilityScore, ReadabilitySummary, RhythmScore
from models.requests import LearnerContext
from utils.readability import get_target, measure_section, validate_section, compute_lesson_summary
from utils.rhythm import analyse_rhythm
from utils.visual_hints import standardise_hint

logger = logging.getLogger(__name__)


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


def measure_readability(lesson_json: LessonJSON, context: LearnerContext) -> LessonJSON:
    """
    Measures the readability and rhythm of all sections of a lesson
    based on the learner context profile and language level, and
    attaches scores, summaries, and warnings.
    """
    profiles = context.cognitive_profiles if context.cognitive_profiles else []
    profile_str = "+".join(profiles) if profiles else "dyslexia"
    lang_level = context.language_level
    target = get_target(profile_str, lang_level)

    if not hasattr(lesson_json.stage_flags, 'readability_warnings') or lesson_json.stage_flags.readability_warnings is None:
        lesson_json.stage_flags.readability_warnings = []

    sections_with_scores = []

    for section in lesson_json.sections:
        # Compute readability scores for section body
        scores = measure_section(section.body)

        # Validate readability of section body
        warnings = validate_section(section.heading, section.body, scores, target)
        lesson_json.stage_flags.readability_warnings.extend(warnings)

        # Analyse sentence rhythm
        rhythm_res = analyse_rhythm(section.heading, section.body, profile_str, lang_level)
        rhythm_score_obj = RhythmScore(
            score=rhythm_res["score"],
            profile_rule=rhythm_res["profile_rule"],
            violations=rhythm_res["violations"]
        )

        # Attach rhythm score and warnings to section/lesson
        section.rhythm_score = rhythm_score_obj.score
        lesson_json.stage_flags.readability_warnings.extend(rhythm_res["violations"])

        # Construct ReadabilityScore object
        section.readability = ReadabilityScore(
            flesch_reading_ease=scores["flesch_reading_ease"],
            flesch_kincaid_grade=scores["flesch_kincaid_grade"],
            smog_grade=scores["smog_grade"],
            rhythm=rhythm_score_obj
        )

        sections_with_scores.append((section.heading, scores))

    # Compute and attach lesson-level summary
    summary_data = compute_lesson_summary(sections_with_scores, target)
    lesson_json.readability_summary = ReadabilitySummary(
        avg_flesch_reading_ease=summary_data["avg_flesch_reading_ease"],
        avg_flesch_kincaid_grade=summary_data["avg_flesch_kincaid_grade"],
        avg_smog_grade=summary_data["avg_smog_grade"],
        within_target=summary_data["within_target"],
        target_flesch_min=summary_data["target_flesch_min"],
        target_flesch_max=summary_data["target_flesch_max"]
    )

    return lesson_json


def standardise_visual_hints(lesson_json: LessonJSON, context: LearnerContext) -> LessonJSON:
    """
    Standardises all visual hints across sections for a given learner context,
    performing classification, validation, and profile-specific rewrites or downgrades.
    """
    profiles = context.cognitive_profiles if context.cognitive_profiles else []
    profile_str = "+".join(profiles) if profiles else "dyslexia"
    lang_level = context.language_level

    if not hasattr(lesson_json.stage_flags, 'readability_warnings') or lesson_json.stage_flags.readability_warnings is None:
        lesson_json.stage_flags.readability_warnings = []

    for section in lesson_json.sections:
        final_hint, hint_type, warning = standardise_hint(
            section.visual_hint,
            section.heading,
            profile_str,
            lang_level
        )

        section.visual_hint = final_hint
        section.visual_hint_type = hint_type

        if warning:
            lesson_json.stage_flags.readability_warnings.append(warning)

    return lesson_json
