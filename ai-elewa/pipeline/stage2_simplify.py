import json
import logging
from pydantic import ValidationError

import config
from ai_client import complete
from models.requests import LearnerContext
from models.responses import LessonJSON
from models.errors import AIServiceError, ErrorResponse, ERROR_SCHEMA_INVALID

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# JSON output schema injected into every simplify prompt
# ---------------------------------------------------------------------------

LESSON_JSON_SCHEMA = """
You must respond with ONLY a valid JSON object. No markdown fences, no extra
text before or after. The JSON must exactly match this schema:

{
  "title": "string — lesson title",
  "sections": [
    {
      "heading": "string — section heading",
      "body": "string — simplified body text",
      "visual_hint": "string or null — suggested visual",
      "reading_level": integer
    }
  ],
  "key_terms": [
    {
      "term": "string",
      "definition": "string"
    }
  ],
  "estimated_minutes": integer,
  "profile": "string — active profile name",
  "stage_flags": {
    "verification_triggered": false,
    "correction_applied": false,
    "profile_merged": false
  }
}

Rules:
- sections must contain at least 1 item
- key_terms may be an empty list if no terms apply
- estimated_minutes must be a positive integer
- profile must reflect the learner's cognitive profile(s)
- stage_flags must always be present with all three boolean fields set to false
  (they will be updated by later pipeline stages)
"""


async def simplify(
    system_prompt: str,
    raw_text: str,
    learner_context: LearnerContext,
) -> LessonJSON:
    """
    Stage 2 — calls the large AI model to simplify raw_text into LessonJSON.
    Validates the response with Pydantic.
    Schema failures are retried by retry.py automatically via ai_client.complete().
    """
    profiles = learner_context.cognitive_profiles
    profile_label = (
        profiles[0] if len(profiles) == 1
        else f"{profiles[0]}+{profiles[1]}"
    )
    profile_merged = len(profiles) == 2

    user_prompt = f"""{LESSON_JSON_SCHEMA}

Now simplify the following educational content for the learner described in
the system prompt. Return ONLY the JSON object.

CONTENT TO SIMPLIFY:
{raw_text}
"""

    raw_response = await complete(
        system_prompt=system_prompt,
        user_prompt=user_prompt,
        model=config.STAGE2_MODEL,
        temperature=config.TEMPERATURE_SIMPLIFY,
        stage="stage2_simplify",
        profile=profile_label,
    )

    # Strip markdown fences if model adds them despite instructions
    cleaned = raw_response.strip()
    if cleaned.startswith("```"):
        lines = cleaned.split("\n")
        # Remove first line (```json or ```) and last line (```)
        cleaned = "\n".join(lines[1:-1]).strip()

    # Parse JSON
    try:
        data = json.loads(cleaned)
    except json.JSONDecodeError as e:
        logger.error(f"Stage 2 JSON parse error: {e}\nRaw response: {raw_response[:300]}")
        raise AIServiceError(ErrorResponse(
            error_code=ERROR_SCHEMA_INVALID,
            message=f"Model returned invalid JSON: {str(e)}",
            stage="stage2_simplify",
            retried=False,
        ))

    # Validate with Pydantic
    try:
        lesson = LessonJSON(**data)
    except ValidationError as e:
        logger.error(f"Stage 2 Pydantic validation error: {e}")
        raise AIServiceError(ErrorResponse(
            error_code=ERROR_SCHEMA_INVALID,
            message=f"Model response did not match LessonJSON schema: {str(e)}",
            stage="stage2_simplify",
            retried=False,
        ))

    # Override profile and stage_flags with server-side values
    # (never trust what the model puts here)
    lesson.profile = profile_label
    lesson.stage_flags.profile_merged = profile_merged
    lesson.stage_flags.verification_triggered = False
    lesson.stage_flags.correction_applied = False

    return lesson