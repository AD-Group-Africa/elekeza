import json
import logging
from pydantic import ValidationError

import config
from ai_client import complete
from models.requests import LearnerContext
from models.responses import LessonJSON, Section
from models.errors import AIServiceError, ErrorResponse, ERROR_SCHEMA_INVALID

logger = logging.getLogger(__name__)

WORD_THRESHOLD = 500  # Stage 3 only fires above this

VERIFY_PROMPT = """
You are a content verification assistant. You will be given:
1. The original source text
2. A simplified lesson JSON created from that text

Your job is to check for meaning distortions — places where the simplified
version changes the actual meaning of the original, introduces factual errors,
or omits a critical concept that would cause misunderstanding.

You are NOT checking for style, reading level, or formatting.
You are ONLY checking for meaning accuracy.

Respond with ONLY a valid JSON object in this exact shape:

{
  "issues_found": true or false,
  "issues": [
    {
      "section_heading": "the heading of the section with the problem",
      "problem": "one sentence describing the meaning distortion",
      "correction": "the corrected body text for that section"
    }
  ]
}

If no issues are found, return:
{
  "issues_found": false,
  "issues": []
}

No markdown fences. No extra text. Only the JSON object.
"""


async def verify(
    lesson_json: LessonJSON,
    raw_text: str,
    learner_context: LearnerContext,
) -> LessonJSON:
    """
    Stage 3 — verification pass.
    Only fires when raw_text exceeds 500 words.
    Checks simplified lesson for meaning distortions against the original.
    Applies targeted corrections if issues found.
    Returns updated LessonJSON with stage_flags set correctly.
    """
    word_count = len(raw_text.split())

    # Gate — only fire above threshold
    if word_count <= WORD_THRESHOLD:
        logger.info(f"Stage 3 skipped — {word_count} words (threshold: {WORD_THRESHOLD})")
        return lesson_json

    # Mark verification as triggered
    lesson_json.stage_flags.verification_triggered = True

    profiles = learner_context.cognitive_profiles
    profile_label = (
        profiles[0] if len(profiles) == 1
        else f"{profiles[0]}+{profiles[1]}"
    )

    # Serialise current lesson for the verification prompt
    lesson_dict = lesson_json.model_dump()
    # Remove stage_flags from what we send — model doesn't need to see them
    lesson_dict.pop("stage_flags", None)

    user_prompt = f"""ORIGINAL SOURCE TEXT:
{raw_text}

SIMPLIFIED LESSON JSON:
{json.dumps(lesson_dict, indent=2)}

Check the simplified lesson for meaning distortions against the original.
Return your findings as the JSON object described in the system prompt.
"""

    raw_response = await complete(
        system_prompt=VERIFY_PROMPT,
        user_prompt=user_prompt,
        model=config.STAGE3_MODEL,
        temperature=config.TEMPERATURE_SIMPLIFY,
        stage="stage3_verify",
        profile=profile_label,
    )

    # Strip markdown fences if present
    cleaned = raw_response.strip()
    if cleaned.startswith("```"):
        lines = cleaned.split("\n")
        cleaned = "\n".join(lines[1:-1]).strip()

    # Parse verification response
    try:
        result = json.loads(cleaned)
    except json.JSONDecodeError as e:
        # Verification failure is non-fatal — log and return lesson unchanged
        logger.warning(f"Stage 3 JSON parse failed: {e} — returning lesson unchanged")
        return lesson_json

    if not result.get("issues_found", False):
        logger.info("Stage 3 complete — no meaning distortions found")
        return lesson_json

    # Apply corrections
    issues = result.get("issues", [])
    if not issues:
        return lesson_json

    corrections_applied = 0
    for issue in issues:
        heading = issue.get("section_heading", "")
        correction = issue.get("correction", "")
        problem = issue.get("problem", "")

        if not heading or not correction:
            continue

        # Find matching section by heading (case-insensitive partial match)
        for section in lesson_json.sections:
            if heading.lower() in section.heading.lower() or section.heading.lower() in heading.lower():
                logger.info(f"Stage 3 correction applied to '{section.heading}': {problem}")
                section.body = correction
                corrections_applied += 1
                break

    if corrections_applied > 0:
        lesson_json.stage_flags.correction_applied = True
        logger.info(f"Stage 3 complete — {corrections_applied} correction(s) applied")
    else:
        logger.info("Stage 3 complete — issues flagged but no sections matched for correction")

    return lesson_json

