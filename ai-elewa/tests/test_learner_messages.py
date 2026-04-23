"""
Unit tests for profile-keyed learner error messages — Improvement 4.

All tests are pure — no server, no API calls, no AI provider required.
Tests cover: message retrieval, profile priority, comorbid profiles,
system-only errors, unknown error codes, and language rule compliance.
"""

import pytest
from utils.learner_messages import (
    get_learner_message,
    get_all_messages_for_profile,
    _primary_profile,
    _MESSAGES,
    _SYSTEM_ONLY_ERRORS,
)
from models.errors import (
    ErrorResponse,
    AIServiceError,
    ERROR_TIMEOUT,
    ERROR_RATE_LIMIT,
    ERROR_SCHEMA_INVALID,
    ERROR_EMPTY_CONTENT,
    ERROR_OVERSIZED,
    ERROR_NON_ENGLISH,
    ERROR_OCR_FAILED,
    ERROR_UNAUTHORISED,
)

ALL_ERROR_CODES = [
    ERROR_TIMEOUT,
    ERROR_RATE_LIMIT,
    ERROR_SCHEMA_INVALID,
    ERROR_EMPTY_CONTENT,
    ERROR_OVERSIZED,
    ERROR_NON_ENGLISH,
    ERROR_OCR_FAILED,
    ERROR_UNAUTHORISED,
]

ALL_PROFILES = [
    "dyslexia",
    "adhd",
    "autism",
    "intellectual_disability",
]


# ---------------------------------------------------------------------------
# _primary_profile — profile priority resolution
# ---------------------------------------------------------------------------

class TestPrimaryProfile:

    def test_single_profile_returned_directly(self):
        assert _primary_profile(["dyslexia"]) == "dyslexia"
        assert _primary_profile(["adhd"]) == "adhd"
        assert _primary_profile(["autism"]) == "autism"
        assert _primary_profile(["intellectual_disability"]) == "intellectual_disability"

    def test_id_takes_priority_over_all_others(self):
        assert _primary_profile(["intellectual_disability", "dyslexia"]) == "intellectual_disability"
        assert _primary_profile(["adhd", "intellectual_disability"]) == "intellectual_disability"
        assert _primary_profile(["autism", "intellectual_disability"]) == "intellectual_disability"

    def test_autism_takes_priority_over_dyslexia_and_adhd(self):
        assert _primary_profile(["autism", "dyslexia"]) == "autism"
        assert _primary_profile(["adhd", "autism"]) == "autism"

    def test_dyslexia_takes_priority_over_adhd(self):
        assert _primary_profile(["adhd", "dyslexia"]) == "dyslexia"

    def test_empty_list_returns_default(self):
        assert _primary_profile([]) == "_default"

    def test_unknown_profile_returns_first(self):
        assert _primary_profile(["unknown_profile"]) == "unknown_profile"


# ---------------------------------------------------------------------------
# get_learner_message — core retrieval
# ---------------------------------------------------------------------------

class TestGetLearnerMessage:

    # Basic retrieval for each profile
    @pytest.mark.parametrize("profile", ALL_PROFILES)
    @pytest.mark.parametrize("error_code", [
        ERROR_TIMEOUT, ERROR_RATE_LIMIT, ERROR_SCHEMA_INVALID,
        ERROR_EMPTY_CONTENT, ERROR_OVERSIZED, ERROR_NON_ENGLISH, ERROR_OCR_FAILED,
    ])
    def test_message_exists_for_all_profile_error_combinations(self, profile, error_code):
        message = get_learner_message(error_code, [profile])
        assert message is not None, (
            f"No message defined for error_code='{error_code}', profile='{profile}'"
        )
        assert isinstance(message, str)
        assert len(message) > 0

    # UNAUTHORISED always returns None
    def test_unauthorised_returns_none_for_all_profiles(self):
        for profile in ALL_PROFILES:
            result = get_learner_message(ERROR_UNAUTHORISED, [profile])
            assert result is None, (
                f"UNAUTHORISED should return None for profile '{profile}', got: {result}"
            )

    def test_unauthorised_returns_none_with_no_profiles(self):
        result = get_learner_message(ERROR_UNAUTHORISED, None)
        assert result is None

    def test_unauthorised_returns_none_with_empty_profiles(self):
        result = get_learner_message(ERROR_UNAUTHORISED, [])
        assert result is None

    # No profiles available
    def test_none_profiles_returns_generic_message(self):
        message = get_learner_message(ERROR_TIMEOUT, None)
        assert message is not None
        assert isinstance(message, str)

    def test_empty_profiles_returns_generic_message(self):
        message = get_learner_message(ERROR_EMPTY_CONTENT, [])
        assert message is not None
        assert isinstance(message, str)

    # Unknown error code
    def test_unknown_error_code_returns_none(self):
        result = get_learner_message("UNKNOWN_CODE", ["dyslexia"])
        assert result is None

    # Comorbid profiles
    def test_comorbid_id_dyslexia_uses_id_message(self):
        id_message = get_learner_message(ERROR_TIMEOUT, ["intellectual_disability"])
        comorbid_message = get_learner_message(ERROR_TIMEOUT, ["intellectual_disability", "dyslexia"])
        assert comorbid_message == id_message

    def test_comorbid_autism_adhd_uses_autism_message(self):
        autism_message = get_learner_message(ERROR_OVERSIZED, ["autism"])
        comorbid_message = get_learner_message(ERROR_OVERSIZED, ["autism", "adhd"])
        assert comorbid_message == autism_message

    def test_comorbid_dyslexia_adhd_uses_dyslexia_message(self):
        dyslexia_message = get_learner_message(ERROR_RATE_LIMIT, ["dyslexia"])
        comorbid_message = get_learner_message(ERROR_RATE_LIMIT, ["dyslexia", "adhd"])
        assert comorbid_message == dyslexia_message

    # Profile-specific messages differ from each other
    def test_id_and_adhd_timeout_messages_differ(self):
        id_msg = get_learner_message(ERROR_TIMEOUT, ["intellectual_disability"])
        adhd_msg = get_learner_message(ERROR_TIMEOUT, ["adhd"])
        assert id_msg != adhd_msg

    def test_id_and_adhd_oversized_messages_differ(self):
        id_msg = get_learner_message(ERROR_OVERSIZED, ["intellectual_disability"])
        adhd_msg = get_learner_message(ERROR_OVERSIZED, ["adhd"])
        assert id_msg != adhd_msg


# ---------------------------------------------------------------------------
# Language rule compliance
# ---------------------------------------------------------------------------

class TestLanguageCompliance:
    """
    Validate that messages follow the language rules for each profile.
    These are not exhaustive linguistic checks — they validate the most
    important structural rules that protect learner comprehension.
    """

    def _max_sentence_words(self, message: str) -> int:
        """Return the word count of the longest sentence in a message."""
        import re
        sentences = re.split(r"[.!?]+", message)
        sentences = [s.strip() for s in sentences if s.strip()]
        if not sentences:
            return 0
        return max(len(s.split()) for s in sentences)

    def test_id_messages_max_8_words_per_sentence(self):
        """ID profile: every sentence must be 8 words or fewer."""
        id_messages = get_all_messages_for_profile("intellectual_disability")
        for error_code, message in id_messages.items():
            if message is None:
                continue
            max_words = self._max_sentence_words(message)
            assert max_words <= 8, (
                f"ID message for '{error_code}' has a sentence with {max_words} words "
                f"(max 8): '{message}'"
            )

    def test_dyslexia_messages_max_12_words_per_sentence(self):
        """Dyslexia profile: every sentence must be 12 words or fewer."""
        dyslexia_messages = get_all_messages_for_profile("dyslexia")
        for error_code, message in dyslexia_messages.items():
            if message is None:
                continue
            max_words = self._max_sentence_words(message)
            assert max_words <= 12, (
                f"Dyslexia message for '{error_code}' has a sentence with {max_words} words "
                f"(max 12): '{message}'"
            )

    def test_autism_messages_contain_no_exclamation_marks(self):
        """Autism profile: no exclamation marks — calm and factual tone required."""
        autism_messages = get_all_messages_for_profile("autism")
        for error_code, message in autism_messages.items():
            if message is None:
                continue
            assert "!" not in message, (
                f"Autism message for '{error_code}' contains an exclamation mark: '{message}'"
            )

    def test_autism_messages_do_not_start_with_idiom(self):
        """Autism profile: no figurative openers."""
        autism_messages = get_all_messages_for_profile("autism")
        forbidden_openers = ["hold on", "looks like", "something went wrong on our side"]
        for error_code, message in autism_messages.items():
            if message is None:
                continue
            lower = message.lower()
            for opener in forbidden_openers:
                assert not lower.startswith(opener), (
                    f"Autism message for '{error_code}' starts with idiom '{opener}': '{message}'"
                )

    def test_all_messages_are_non_empty_strings(self):
        """Every defined message must be a non-empty string (or None for system-only)."""
        for error_code, profile_map in _MESSAGES.items():
            for profile_key, message in profile_map.items():
                if error_code in _SYSTEM_ONLY_ERRORS:
                    continue  # None is expected for system-only errors
                if message is not None:
                    assert isinstance(message, str), (
                        f"Message for [{error_code}][{profile_key}] is not a string: {type(message)}"
                    )
                    assert len(message.strip()) > 0, (
                        f"Message for [{error_code}][{profile_key}] is empty"
                    )

    def test_no_message_contains_technical_jargon(self):
        """Learner messages must not expose technical terms or HTTP status codes."""
        import re

        # HTTP status codes — match as whole words only to avoid
        # false positives on numbers like "5000 words"
        http_codes = ["500", "429", "504", "422", "413", "401"]

        # Technical terms — substring match is appropriate for these
        technical_terms = [
            "HTTP", "API", "endpoint", "JSON", "server error",
            "stack trace", "exception", "null", "undefined",
            "tesseract", "pydantic", "schema",
        ]

        for error_code, profile_map in _MESSAGES.items():
            for profile_key, message in profile_map.items():
                if message is None:
                    continue
                lower = message.lower()

                # Whole-word check for HTTP status codes
                for code in http_codes:
                    pattern = rf"\b{re.escape(code)}\b"
                    assert not re.search(pattern, lower), (
                        f"Message for [{error_code}][{profile_key}] contains "
                        f"HTTP status code '{code}': '{message}'"
                    )

                # Substring check for technical terms
                for term in technical_terms:
                    assert term.lower() not in lower, (
                        f"Message for [{error_code}][{profile_key}] contains "
                        f"technical term '{term}': '{message}'"
                    )


# ---------------------------------------------------------------------------
# get_all_messages_for_profile
# ---------------------------------------------------------------------------

class TestGetAllMessagesForProfile:

    def test_returns_dict_for_all_profiles(self):
        for profile in ALL_PROFILES:
            result = get_all_messages_for_profile(profile)
            assert isinstance(result, dict)
            assert len(result) > 0

    def test_all_error_codes_present(self):
        for profile in ALL_PROFILES:
            result = get_all_messages_for_profile(profile)
            for code in ALL_ERROR_CODES:
                assert code in result, (
                    f"Error code '{code}' missing from messages for profile '{profile}'"
                )

    def test_unauthorised_returns_none_for_all_profiles(self):
        for profile in ALL_PROFILES:
            result = get_all_messages_for_profile(profile)
            assert result[ERROR_UNAUTHORISED] is None


# ---------------------------------------------------------------------------
# ErrorResponse model — learner_message field
# ---------------------------------------------------------------------------

class TestErrorResponseModel:

    def test_learner_message_defaults_to_none(self):
        error = ErrorResponse(
            error_code=ERROR_TIMEOUT,
            message="Technical message for Harrison.",
        )
        assert error.learner_message is None

    def test_learner_message_can_be_set(self):
        error = ErrorResponse(
            error_code=ERROR_TIMEOUT,
            message="Technical message.",
            learner_message="The system is taking a moment. We will try again.",
        )
        assert error.learner_message == "The system is taking a moment. We will try again."

    def test_model_dump_includes_learner_message(self):
        error = ErrorResponse(
            error_code=ERROR_TIMEOUT,
            message="Technical message.",
            learner_message="Please wait.",
        )
        dumped = error.model_dump()
        assert "learner_message" in dumped
        assert dumped["learner_message"] == "Please wait."

    def test_model_dump_learner_message_none_when_not_set(self):
        error = ErrorResponse(
            error_code=ERROR_UNAUTHORISED,
            message="Unauthorised.",
        )
        dumped = error.model_dump()
        assert "learner_message" in dumped
        assert dumped["learner_message"] is None

    def test_all_error_response_fields_present_in_dump(self):
        error = ErrorResponse(
            error_code=ERROR_TIMEOUT,
            message="Technical message.",
            stage="stage2_simplify",
            retried=True,
            learner_message="The system is taking a moment.",
        )
        dumped = error.model_dump()
        assert "error_code" in dumped
        assert "message" in dumped
        assert "stage" in dumped
        assert "retried" in dumped
        assert "learner_message" in dumped