"""
Stage 3b — Targeted Readability Correction.

Runs only when Stage 4b readability measurement finds sections significantly
outside the profile target range (more than one FK grade level off).

For each flagged section, calls the fast model with a targeted rewrite
instruction. Accepts the rewrite only if it measurably improves the score.
Most lessons produce zero flagged sections — this stage exits immediately
with no AI calls in the common case.

New field: StageFlags.readability_correction_applied
"""

import asyncio
import logging
from typing import Optional

import config
from ai_client import complete
from models.requests import LearnerContext
from models.responses import LessonJSON, Section
from utils.readability import get_target, measure_section

logger = logging.getLogger(__name__)

CORRECTION_THRESHOLD_GRADES = 1.0


def _get_grade_targets(profile_label: str, language_level: int) -> tuple[float, float]:
    target = get_target(profile_label, language_level)
    max_grade = float(target.fk_grade_max)
    min_grade = max(0.0, max_grade - 2.0)
    return min_grade, max_grade


def _is_flagged(fk_grade: float, min_grade: float, max_grade: float) -> bool:
    too_hard   = fk_grade > (max_grade + CORRECTION_THRESHOLD_GRADES)
    too_simple = fk_grade < (min_grade - CORRECTION_THRESHOLD_GRADES)
    return too_hard or too_simple


def _build_rewrite_prompt(
    section: Section,
    current_grade: float,
    target_grade: float,
    profile_label: str,
) -> tuple[str, str]:
    direction = "simpler" if current_grade > target_grade else "slightly more detailed"

    system_prompt = f"""You are a content accessibility editor for learners with cognitive disabilities.
You will receive a short lesson section and must rewrite it to be {direction}.

PROFILE: {profile_label}
TARGET READING LEVEL: Grade {target_grade:.1f} (Flesch-Kincaid)
CURRENT READING LEVEL: Grade {current_grade:.1f}

RULES:
- Keep the meaning IDENTICAL. Do not add, remove, or change any facts.
- Adjust vocabulary complexity and sentence length only.
- Do not change the heading.
- Return ONLY the rewritten body text — no heading, no preamble, no explanation.
- Do not use markdown formatting, bullet points, or numbering unless they were in the original.
- Match the original tone and register."""

    user_prompt = f"""HEADING: {section.heading}

ORIGINAL BODY:
{section.body}

Rewrite the body to Grade {target_grade:.1f} level. Return ONLY the rewritten body text."""

    return system_prompt, user_prompt


async def _correct_section(
    section: Section,
    fk_grade: float,
    target_midpoint: float,
    profile_label: str,
    language_level: int,
) -> tuple[Section, bool, str]:
    system_prompt, user_prompt = _build_rewrite_prompt(
        section=section,
        current_grade=fk_grade,
        target_grade=target_midpoint,
        profile_label=profile_label,
    )

    try:
        rewritten_body = await complete(
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            model=config.STAGE3_MODEL,
            temperature=0.2,
            stage="stage3b_readability",
            profile=profile_label,
        )
        rewritten_body = rewritten_body.strip()

        if not rewritten_body:
            return (
                section,
                False,
                f"Section '{section.heading}': Stage 3b rewrite returned empty — original kept. "
                f"Original grade: {fk_grade:.1f}, target: {target_midpoint:.1f}.",
            )

        rewrite_scores = measure_section(rewritten_body)
        rewrite_grade  = rewrite_scores["flesch_kincaid_grade"]

        original_distance = abs(fk_grade      - target_midpoint)
        rewrite_distance  = abs(rewrite_grade - target_midpoint)

        if rewrite_distance < original_distance:
            updated_section = section.model_copy(
                update={
                    "body": rewritten_body,
                    "readability": section.readability.model_copy(
                        update={
                            "flesch_reading_ease":  rewrite_scores["flesch_reading_ease"],
                            "flesch_kincaid_grade": rewrite_grade,
                            "smog_grade":           rewrite_scores["smog_grade"],
                        }
                    ) if section.readability else None,
                }
            )
            log_message = (
                f"Section '{section.heading}': Stage 3b rewrite applied. "
                f"FK grade {fk_grade:.1f} → {rewrite_grade:.1f} "
                f"(target midpoint: {target_midpoint:.1f})."
            )
            logger.info(log_message)
            return updated_section, True, log_message

        else:
            log_message = (
                f"Section '{section.heading}': Stage 3b rewrite did not improve score — "
                f"original kept. Original grade: {fk_grade:.1f}, "
                f"rewrite grade: {rewrite_grade:.1f}, target: {target_midpoint:.1f}."
            )
            logger.info(log_message)
            return section, False, log_message

    except Exception as e:
        logger.error(
            f"Stage 3b: unexpected error correcting section '{section.heading}': {e}",
            exc_info=True,
        )
        return (
            section,
            False,
            f"Section '{section.heading}': Stage 3b correction failed — "
            f"original kept. Error: {type(e).__name__}.",
        )


async def apply_readability_corrections(
    lesson_json: LessonJSON,
    learner_context: LearnerContext,
) -> LessonJSON:
    """
    Scan sections for readability scores outside profile targets.
    Attempt a fast-model rewrite for each flagged section.
    Accept the rewrite only if it improves the score.
    No-op when no sections are flagged — returns lesson unchanged with zero AI calls.
    """
    profiles = learner_context.cognitive_profiles
    profile_label = (
        profiles[0] if len(profiles) == 1
        else f"{profiles[0]}+{profiles[1]}"
    )
    language_level = learner_context.language_level

    min_grade, max_grade = _get_grade_targets(profile_label, language_level)
    target_midpoint = (min_grade + max_grade) / 2.0

    flagged: list[tuple[int, Section, float]] = []

    for i, section in enumerate(lesson_json.sections):
        if section.readability is None:
            continue
        fk_grade = section.readability.flesch_kincaid_grade
        if _is_flagged(fk_grade, min_grade, max_grade):
            flagged.append((i, section, fk_grade))
            logger.info(
                f"Stage 3b: section '{section.heading}' flagged. "
                f"FK grade {fk_grade:.1f} vs target [{min_grade:.1f}, {max_grade:.1f}]."
            )

    if not flagged:
        return lesson_json

    logger.info(
        f"Stage 3b: {len(flagged)} section(s) flagged "
        f"(profile: {profile_label}, level: {language_level})."
    )

    tasks = [
        _correct_section(
            section=section,
            fk_grade=fk_grade,
            target_midpoint=target_midpoint,
            profile_label=profile_label,
            language_level=language_level,
        )
        for _, section, fk_grade in flagged
    ]

    results = await asyncio.gather(*tasks)

    updated_sections = list(lesson_json.sections)
    any_improved = False
    correction_log: list[str] = []

    for (original_index, _, _), (updated_section, was_improved, log_message) in zip(flagged, results):
        updated_sections[original_index] = updated_section
        if was_improved:
            any_improved = True
        correction_log.append(log_message)

    existing_warnings = list(lesson_json.stage_flags.readability_warnings or [])

    updated_stage_flags = lesson_json.stage_flags.model_copy(
        update={
            "readability_correction_applied": any_improved,
            "readability_warnings": existing_warnings + correction_log,
        }
    )

    return lesson_json.model_copy(
        update={
            "sections": updated_sections,
            "stage_flags": updated_stage_flags,
        }
    )