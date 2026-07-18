"""
Profile-keyed learner error messages for the Elewa AI service.

When the AI service returns an error, Harrison currently receives only an
error_code and must translate it into a learner-appropriate message himself.
Victor maintains a separate profileErrorMessages.ts file on the frontend.
These two sources inevitably drift apart.

This module is the single source of truth for all learner-facing error
messages produced by the AI service. Each message is written for a specific
cognitive profile, following that profile's language rules:

  Dyslexia             — short sentences, active voice, max 12 words each.
  ADHD                 — punchy, direct, energy maintained.
  Autism               — literal, factual, no metaphor, states what happens next.
  Intellectual Disability — max 8 words per sentence, warm, simple vocabulary.

Messages are deliberately brief. A learner who has hit an error does not
need a long explanation — they need a clear, calm instruction.

Usage:
    from utils.learner_messages import get_learner_message

    message = get_learner_message(
        error_code="TIMEOUT",
        profiles=["dyslexia"],
    )
    # Returns: "The system is taking a moment. We will try again."

When profiles is None or empty (e.g. on auth errors), returns None.
When a profile has no specific message for an error code, falls back to
the generic message for that error code.
"""

import logging
from typing import Optional

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Message table
#
# Structure: error_code → profile → message
#
# Language rules enforced per profile:
#   dyslexia: max 12 words/sentence, active voice, no passive
#   adhd: punchy opener, max 2 sentences, energy preserved where appropriate
#   autism: literal only, no idioms, states exactly what will happen next
#   intellectual_disability: max 8 words/sentence, warm, "Remember:" not used
#                            in errors (reserved for lesson content)
#
# The "_generic" key is the fallback when a profile has no specific message.
# The "_default" profile is the fallback when no profile is provided.
# ---------------------------------------------------------------------------

_MESSAGES: dict[str, dict[str, str]] = {

    # ── TIMEOUT ──────────────────────────────────────────────────────────
    # The AI model did not respond in time.
    "TIMEOUT": {
        "dyslexia": (
            "The system is taking a moment. We will try again."
        ),
        "adhd": (
            "Hold on — we are fetching your content. Try again in a second."
        ),
        "autism": (
            "The system did not respond in time. "
            "This happens sometimes. Please press try again."
        ),
        "intellectual_disability": (
            "Please wait. We are coming back. Try again."
        ),
        "_generic": (
            "The system took too long to respond. Please try again."
        ),
    },

    # ── RATE_LIMIT ────────────────────────────────────────────────────────
    # Too many requests to the AI provider.
    "RATE_LIMIT": {
        "dyslexia": (
            "We are busy right now. Please wait a moment and try again."
        ),
        "adhd": (
            "Lots of people are using Elewa right now. Wait a few seconds and try again."
        ),
        "autism": (
            "The system is busy. Please wait five seconds. Then try again."
        ),
        "intellectual_disability": (
            "Elewa is busy now. Wait a little. Then try again."
        ),
        "_generic": (
            "The system is currently busy. Please wait a moment and try again."
        ),
    },

    # ── SCHEMA_INVALID ────────────────────────────────────────────────────
    # The AI returned malformed output after retries.
    "SCHEMA_INVALID": {
        "dyslexia": (
            "Something went wrong on our side. Please try again."
        ),
        "adhd": (
            "Something went wrong. Try again — it usually works the second time."
        ),
        "autism": (
            "There was an error processing your content. "
            "Please try again. The error is on our side, not yours."
        ),
        "intellectual_disability": (
            "Something went wrong. Please try again."
        ),
        "_generic": (
            "Something went wrong. Please try again."
        ),
    },

    # ── EMPTY_CONTENT ─────────────────────────────────────────────────────
    # raw_text was empty or whitespace only.
    "EMPTY_CONTENT": {
        "dyslexia": (
            "No text was sent. Please add some text and try again."
        ),
        "adhd": (
            "Looks like nothing was sent. Add your text and go again."
        ),
        "autism": (
            "The text field was empty. "
            "Please type or paste your text into the box. Then press submit."
        ),
        "intellectual_disability": (
            "No text was sent. Please add text. Then try again."
        ),
        "_generic": (
            "No text was received. Please add your content and try again."
        ),
    },

    # ── OVERSIZED ─────────────────────────────────────────────────────────
    # Content exceeded 5000 words.
    "OVERSIZED": {
        "dyslexia": (
            "That text is too long. Try sending a smaller section at a time."
        ),
        "adhd": (
            "That was a lot of text! Break it into smaller pieces and send one at a time."
        ),
        "autism": (
            "The text is too long for one request. "
            "The maximum is 5000 words. "
            "Please split the text into smaller parts and send them one at a time."
        ),
        "intellectual_disability": (
            "That text is too long. Send a smaller piece. Then try again."
        ),
        "_generic": (
            "The content is too long. Please split it into smaller sections and try again."
        ),
    },

    # ── NON_ENGLISH ───────────────────────────────────────────────────────
    # Content appears to be non-English or gibberish.
    "NON_ENGLISH": {
        "dyslexia": (
            "We could not read that text. Please send text written in English."
        ),
        "adhd": (
            "That text did not look like English. Send English text and try again."
        ),
        "autism": (
            "The text you sent is not in English. "
            "Elewa currently works with English text only. "
            "Please send your content in English."
        ),
        "intellectual_disability": (
            "We need English text. Please send English text."
        ),
        "_generic": (
            "The content does not appear to be in English. "
            "Please send your content in English."
        ),
    },

    # ── OCR_FAILED ────────────────────────────────────────────────────────
    # Tesseract could not extract text from the image.
    "OCR_FAILED": {
        "dyslexia": (
            "We could not read that image. Try uploading a clearer photo."
        ),
        "adhd": (
            "Could not read the image. Upload a clearer photo with good lighting."
        ),
        "autism": (
            "The image could not be read. "
            "This happens when the image is blurry or the text is too small. "
            "Please upload a clearer image where the text is easy to see."
        ),
        "intellectual_disability": (
            "We could not read the image. Please try a clearer photo."
        ),
        "_generic": (
            "We could not extract text from that image. "
            "Please upload a clearer image with readable text."
        ),
    },

    # ── UNAUTHORISED ─────────────────────────────────────────────────────
    # X-Internal-Key header missing or wrong.
    # This error is never shown to learners — it is a backend configuration issue.
    # learner_message is always None for this error code.
    "UNAUTHORISED": {
        "_generic": None,
    },
}

# Profiles whose messages should never be shown to learners
_SYSTEM_ONLY_ERRORS = {"UNAUTHORISED"}


# ---------------------------------------------------------------------------
# Profile resolution helpers
# ---------------------------------------------------------------------------

def _primary_profile(profiles: list[str]) -> str:
    """
    Determine the primary profile for message selection.

    For single profiles, returns that profile.
    For comorbid profiles, returns the profile whose messages are most
    restrictive in terms of language simplicity:
        intellectual_disability > autism > dyslexia > adhd

    This ensures comorbid learners always receive the simplest message.
    """
    if not profiles:
        return "_default"

    priority = ["intellectual_disability", "autism", "dyslexia", "adhd"]
    for p in priority:
        if p in profiles:
            return p

    return profiles[0]


# ---------------------------------------------------------------------------
# Public interface
# ---------------------------------------------------------------------------

def get_learner_message(
    error_code: str,
    profiles: Optional[list[str]],
) -> Optional[str]:
    """
    Return a profile-appropriate learner-facing error message.

    Args:
        error_code: one of the defined error code constants
                    (TIMEOUT, RATE_LIMIT, SCHEMA_INVALID, etc.)
        profiles:   list of cognitive profile strings from LearnerContext.
                    None or empty list when no learner context is available
                    (e.g. auth errors, malformed requests).

    Returns:
        A plain-language message string appropriate for the learner's profile,
        or None when:
          - the error should never be shown to learners (UNAUTHORISED)
          - no profiles are available and no generic message exists
    """
    # System-only errors never produce learner messages
    if error_code in _SYSTEM_ONLY_ERRORS:
        return None

    # No profiles available — no learner context to personalise for
    if not profiles:
        code_messages = _MESSAGES.get(error_code, {})
        return code_messages.get("_generic")

    profile = _primary_profile(profiles)
    code_messages = _MESSAGES.get(error_code, {})

    if not code_messages:
        logger.warning(
            f"No learner messages defined for error_code '{error_code}'. "
            f"Returning None."
        )
        return None

    # Profile-specific message takes priority over generic
    message = code_messages.get(profile) or code_messages.get("_generic")

    if message is None and error_code not in _SYSTEM_ONLY_ERRORS:
        logger.warning(
            f"No learner message found for error_code='{error_code}', "
            f"profile='{profile}'. Returning None."
        )

    return message


def get_all_messages_for_profile(profile: str) -> dict[str, Optional[str]]:
    """
    Return all error messages for a given profile.
    Used in tests and documentation generation.

    Args:
        profile: a single cognitive profile string

    Returns:
        dict mapping error_code → message string (or None)
    """
    result = {}
    for error_code, profile_map in _MESSAGES.items():
        message = profile_map.get(profile) or profile_map.get("_generic")
        result[error_code] = message
    return result

