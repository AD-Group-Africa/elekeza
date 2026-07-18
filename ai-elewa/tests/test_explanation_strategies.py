"""
Unit tests for wrong answer re-explanation strategies — Improvement 6.

All tests are pure — no server, no API calls, no AI provider required.
Tests cover: strategy retrieval, comorbid priority, system prompt building,
structure validation, and sentence length compliance.
"""

import pytest
from utils.explanation_strategies import (
    get_strategy,
    build_reexplanation_system_prompt,
    validate_explanation_structure,
    NUMBERED_STEPS_STRATEGY,
    ANSWER_FIRST_STRATEGY,
    CAUSE_EFFECT_STRATEGY,
    TELL_SHOW_REMIND_STRATEGY,
    STRATEGY_NUMBERED_STEPS,
    STRATEGY_ANSWER_FIRST,
    STRATEGY_CAUSE_EFFECT,
    STRATEGY_TELL_SHOW_REMIND,
    STRATEGY_PARAGRAPH,
    VALID_STRATEGIES,
    _PROFILE_STRATEGIES,
)

ALL_PROFILES = ["dyslexia", "adhd", "autism", "intellectual_disability"]

# ---------------------------------------------------------------------------
# Sample re-explanations — correctly structured per strategy
# ---------------------------------------------------------------------------

GOOD_NUMBERED_STEPS = (
    "1. Water gets warm from the sun.\n"
    "2. Warm water turns into vapour.\n"
    "3. Vapour rises and forms clouds."
)

GOOD_ANSWER_FIRST = (
    "The correct answer is evaporation because heat turns water into vapour. "
    "Heat gives water molecules enough energy to escape into the air. "
    "That is why puddles disappear on a sunny day."
)

GOOD_CAUSE_EFFECT = (
    "Water evaporates because heat gives water molecules enough energy to move. "
    "Moving molecules escape from the liquid into the air because they are faster. "
    "The escaped molecules form water vapour because they are now a gas."
)

GOOD_TELL_SHOW_REMIND = (
    "Water turns to air when hot. "
    "A puddle on a sunny day dries up. "
    "The water went into the air. "
    "Remember: heat turns water into air."
)

# Incorrectly structured examples
BAD_NUMBERED_STEPS_NO_NUMBERS = (
    "Water gets warm. It turns to vapour. Vapour rises."
)

BAD_ANSWER_FIRST_NO_MARKER = (
    "Evaporation is when water turns into vapour. "
    "This happens because of heat. "
    "Puddles dry up in the sun."
)

BAD_CAUSE_EFFECT_NO_BECAUSE = (
    "Water evaporates. It turns into vapour. The vapour rises. It forms clouds."
)

BAD_TELL_SHOW_REMIND_NO_REMEMBER = (
    "Water turns to air when hot. "
    "A puddle on a sunny day dries up. "
    "The water went into the air."
)


# ---------------------------------------------------------------------------
# get_strategy — strategy retrieval
# ---------------------------------------------------------------------------

class TestGetStrategy:

    def test_dyslexia_uses_numbered_steps(self):
        strategy = get_strategy("dyslexia")
        assert strategy.strategy_name == STRATEGY_NUMBERED_STEPS

    def test_adhd_uses_answer_first(self):
        strategy = get_strategy("adhd")
        assert strategy.strategy_name == STRATEGY_ANSWER_FIRST

    def test_autism_uses_cause_effect(self):
        strategy = get_strategy("autism")
        assert strategy.strategy_name == STRATEGY_CAUSE_EFFECT

    def test_id_uses_tell_show_remind(self):
        strategy = get_strategy("intellectual_disability")
        assert strategy.strategy_name == STRATEGY_TELL_SHOW_REMIND

    def test_unknown_profile_returns_paragraph_fallback(self):
        strategy = get_strategy("unknown_profile_xyz")
        assert strategy.strategy_name == STRATEGY_PARAGRAPH

    @pytest.mark.parametrize("profile", ALL_PROFILES)
    def test_strategy_name_is_valid(self, profile):
        strategy = get_strategy(profile)
        assert strategy.strategy_name in VALID_STRATEGIES

    @pytest.mark.parametrize("profile", ALL_PROFILES)
    def test_system_prompt_block_is_non_empty(self, profile):
        strategy = get_strategy(profile)
        assert len(strategy.system_prompt_block.strip()) > 0

    @pytest.mark.parametrize("profile", ALL_PROFILES)
    def test_max_sentence_words_is_positive(self, profile):
        strategy = get_strategy(profile)
        assert strategy.max_sentence_words > 0

    @pytest.mark.parametrize("profile", ALL_PROFILES)
    def test_max_total_sentences_is_positive(self, profile):
        strategy = get_strategy(profile)
        assert strategy.max_total_sentences > 0

    def test_id_has_strictest_sentence_limit(self):
        id_strategy = get_strategy("intellectual_disability")
        dyslexia_strategy = get_strategy("dyslexia")
        adhd_strategy = get_strategy("adhd")
        autism_strategy = get_strategy("autism")
        assert id_strategy.max_sentence_words <= dyslexia_strategy.max_sentence_words
        assert id_strategy.max_sentence_words <= adhd_strategy.max_sentence_words
        assert id_strategy.max_sentence_words <= autism_strategy.max_sentence_words

    # Comorbid profiles
    def test_comorbid_id_dyslexia_uses_id_strategy(self):
        strategy = get_strategy("intellectual_disability+dyslexia")
        assert strategy.strategy_name == STRATEGY_TELL_SHOW_REMIND

    def test_comorbid_autism_adhd_uses_autism_strategy(self):
        strategy = get_strategy("autism+adhd")
        assert strategy.strategy_name == STRATEGY_CAUSE_EFFECT

    def test_comorbid_dyslexia_adhd_uses_dyslexia_strategy(self):
        strategy = get_strategy("dyslexia+adhd")
        assert strategy.strategy_name == STRATEGY_NUMBERED_STEPS

    def test_comorbid_autism_id_uses_id_strategy(self):
        # ID has higher priority than autism in the comorbid order
        strategy = get_strategy("autism+intellectual_disability")
        assert strategy.strategy_name == STRATEGY_TELL_SHOW_REMIND

    def test_comorbid_order_does_not_matter(self):
        ab = get_strategy("dyslexia+adhd")
        ba = get_strategy("adhd+dyslexia")
        assert ab.strategy_name == ba.strategy_name

    def test_all_profiles_have_different_strategies(self):
        strategies = {get_strategy(p).strategy_name for p in ALL_PROFILES}
        assert len(strategies) == 4


# ---------------------------------------------------------------------------
# build_reexplanation_system_prompt
# ---------------------------------------------------------------------------

class TestBuildReexplanationSystemPrompt:

    @pytest.mark.parametrize("profile", ALL_PROFILES)
    def test_prompt_is_non_empty_string(self, profile):
        prompt = build_reexplanation_system_prompt(profile)
        assert isinstance(prompt, str)
        assert len(prompt.strip()) > 100

    def test_dyslexia_prompt_contains_numbered_steps_instruction(self):
        prompt = build_reexplanation_system_prompt("dyslexia")
        assert "numbered" in prompt.lower() or "1." in prompt

    def test_adhd_prompt_contains_answer_first_instruction(self):
        prompt = build_reexplanation_system_prompt("adhd")
        assert "correct answer" in prompt.lower()
        assert "first" in prompt.lower() or "immediately" in prompt.lower()

    def test_autism_prompt_contains_cause_effect_instruction(self):
        prompt = build_reexplanation_system_prompt("autism")
        assert "cause" in prompt.lower() or "because" in prompt.lower()
        assert "analogy" in prompt.lower() or "analogies" in prompt.lower()

    def test_id_prompt_contains_tell_show_remind_instruction(self):
        prompt = build_reexplanation_system_prompt("intellectual_disability")
        assert "remember" in prompt.lower()
        assert "tell" in prompt.lower() or "show" in prompt.lower()

    def test_all_prompts_contain_base_instruction(self):
        for profile in ALL_PROFILES:
            prompt = build_reexplanation_system_prompt(profile)
            assert "re-explanation" in prompt.lower() or "re-explain" in prompt.lower()

    def test_comorbid_prompt_uses_primary_strategy(self):
        # dyslexia+adhd should use dyslexia strategy
        comorbid_prompt = build_reexplanation_system_prompt("dyslexia+adhd")
        dyslexia_prompt = build_reexplanation_system_prompt("dyslexia")
        # Both should contain the numbered steps instruction
        assert "numbered" in comorbid_prompt.lower() or "1." in comorbid_prompt


# ---------------------------------------------------------------------------
# validate_explanation_structure
# ---------------------------------------------------------------------------

class TestValidateExplanationStructure:

    # Numbered steps (Dyslexia)
    def test_good_numbered_steps_passes(self):
        passes, issues = validate_explanation_structure(
            GOOD_NUMBERED_STEPS, NUMBERED_STEPS_STRATEGY
        )
        assert passes is True
        assert len(issues) == 0

    def test_numbered_steps_without_numbers_fails(self):
        passes, issues = validate_explanation_structure(
            BAD_NUMBERED_STEPS_NO_NUMBERS, NUMBERED_STEPS_STRATEGY
        )
        assert passes is False
        assert any("1." in issue or "marker" in issue.lower() for issue in issues)

    def test_numbered_steps_too_many_sentences_fails(self):
        too_many = (
            "1. Water gets warm.\n"
            "2. It turns to vapour.\n"
            "3. Vapour rises.\n"
            "4. It forms clouds.\n"
            "5. Clouds produce rain."
        )
        passes, issues = validate_explanation_structure(
            too_many, NUMBERED_STEPS_STRATEGY
        )
        assert passes is False
        assert any("sentences" in issue.lower() for issue in issues)

    def test_numbered_steps_long_sentence_fails(self):
        long_sentence = (
            "1. Water evaporates because the sun heats it and gives it energy to escape into the atmosphere above.\n"
            "2. It rises as vapour.\n"
            "3. Vapour cools and forms clouds."
        )
        passes, issues = validate_explanation_structure(
            long_sentence, NUMBERED_STEPS_STRATEGY
        )
        assert passes is False
        assert any("words" in issue.lower() for issue in issues)

    # Answer first (ADHD)
    def test_good_answer_first_passes(self):
        passes, issues = validate_explanation_structure(
            GOOD_ANSWER_FIRST, ANSWER_FIRST_STRATEGY
        )
        assert passes is True
        assert len(issues) == 0

    def test_answer_first_without_marker_fails(self):
        passes, issues = validate_explanation_structure(
            BAD_ANSWER_FIRST_NO_MARKER, ANSWER_FIRST_STRATEGY
        )
        assert passes is False
        assert any("correct answer" in issue.lower() or "marker" in issue.lower() for issue in issues)

    # Cause and effect (Autism)
    def test_good_cause_effect_passes(self):
        passes, issues = validate_explanation_structure(
            GOOD_CAUSE_EFFECT, CAUSE_EFFECT_STRATEGY
        )
        assert passes is True
        assert len(issues) == 0

    def test_cause_effect_without_because_fails(self):
        passes, issues = validate_explanation_structure(
            BAD_CAUSE_EFFECT_NO_BECAUSE, CAUSE_EFFECT_STRATEGY
        )
        assert passes is False
        assert any("because" in issue.lower() or "marker" in issue.lower() for issue in issues)

    # Tell-Show-Remind (ID)
    def test_good_tell_show_remind_passes(self):
        passes, issues = validate_explanation_structure(
            GOOD_TELL_SHOW_REMIND, TELL_SHOW_REMIND_STRATEGY
        )
        assert passes is True
        assert len(issues) == 0

    def test_tell_show_remind_without_remember_fails(self):
        passes, issues = validate_explanation_structure(
            BAD_TELL_SHOW_REMIND_NO_REMEMBER, TELL_SHOW_REMIND_STRATEGY
        )
        assert passes is False
        assert any("remember" in issue.lower() or "marker" in issue.lower() for issue in issues)

    def test_id_long_sentence_fails(self):
        long_id = (
            "Water turns into vapour because the sun heats it and gives it energy. "
            "A puddle on a sunny day dries up and disappears. "
            "Remember: heat turns water into air."
        )
        passes, issues = validate_explanation_structure(
            long_id, TELL_SHOW_REMIND_STRATEGY
        )
        assert passes is False
        assert any("words" in issue.lower() for issue in issues)

    # General
    def test_empty_text_fails(self):
        passes, issues = validate_explanation_structure("", NUMBERED_STEPS_STRATEGY)
        assert passes is False
        assert len(issues) > 0

    def test_whitespace_only_fails(self):
        passes, issues = validate_explanation_structure("   \n\n  ", NUMBERED_STEPS_STRATEGY)
        assert passes is False

    def test_issues_are_always_strings(self):
        _, issues = validate_explanation_structure(
            BAD_NUMBERED_STEPS_NO_NUMBERS, NUMBERED_STEPS_STRATEGY
        )
        assert all(isinstance(i, str) for i in issues)

    def test_passes_returns_bool(self):
        passes, _ = validate_explanation_structure(
            GOOD_NUMBERED_STEPS, NUMBERED_STEPS_STRATEGY
        )
        assert isinstance(passes, bool)


# ---------------------------------------------------------------------------
# Strategy constants integrity
# ---------------------------------------------------------------------------

class TestStrategyConstants:

    def test_all_strategy_names_are_in_valid_strategies(self):
        for profile in ALL_PROFILES:
            strategy = get_strategy(profile)
            assert strategy.strategy_name in VALID_STRATEGIES

    def test_each_profile_has_unique_structure_markers(self):
        markers = {
            get_strategy(p).strategy_name: frozenset(get_strategy(p).structure_markers)
            for p in ALL_PROFILES
        }
        # Numbered steps and answer_first have different markers
        assert markers[STRATEGY_NUMBERED_STEPS] != markers[STRATEGY_ANSWER_FIRST]

    def test_id_strategy_has_remember_marker(self):
        assert "Remember:" in TELL_SHOW_REMIND_STRATEGY.structure_markers

    def test_answer_first_strategy_has_correct_answer_marker(self):
        assert "The correct answer is" in ANSWER_FIRST_STRATEGY.structure_markers

    def test_numbered_steps_has_all_three_number_markers(self):
        assert "1." in NUMBERED_STEPS_STRATEGY.structure_markers
        assert "2." in NUMBERED_STEPS_STRATEGY.structure_markers
        assert "3." in NUMBERED_STEPS_STRATEGY.structure_markers

    def test_cause_effect_has_because_marker(self):
        assert "because" in CAUSE_EFFECT_STRATEGY.structure_markers

