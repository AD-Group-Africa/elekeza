import logging
from models.responses import LessonJSON, KeyTerm

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

