"""
Unit tests for adaptive response calibration per profile — Improvement 5.

All tests are pure — no server, no API calls, no AI provider required.
Tests cover: rule retrieval, latency adjustment, directive safety checks,
comorbid rules, and context block generation.
"""

import pytest
from utils.adaptive_rules import (
    get_adaptive_rule,
    adjusted_latency,
    is_slow,
    is_very_slow,
    is_fast_wrong,
    validate_directive,
    build_adaptive_context_block,
    ADAPTIVE_RULES,
    LATENCY_SLOW_THRESHOLD_MS,
    LATENCY_FAST_THRESHOLD_MS,
    LATENCY_VERY_SLOW_MS,
    ID_MIN_CONSECUTIVE_FOR_HARDER,
)

ALL_PROFILES = ["dyslexia", "adhd", "autism", "intellectual_disability"]


# ---------------------------------------------------------------------------
# get_adaptive_rule — rule retrieval
# ---------------------------------------------------------------------------

class TestGetAdaptiveRule:

    @pytest.mark.parametrize("profile", ALL_PROFILES)
    def test_rule_exists_for_all_profiles(self, profile):
        rule = get_adaptive_rule(profile)
        assert rule is not None
        assert rule.rule_description != ""

    def test_autism_does_not_allow_easier(self):
        rule = get_adaptive_rule("autism")
        assert rule.easier_allowed is False

    def test_dyslexia_latency_weight_is_half(self):
        rule = get_adaptive_rule("dyslexia")
        assert rule.latency_weight == 0.5

    def test_adhd_latency_weight_is_amplified(self):
        rule = get_adaptive_rule("adhd")
        assert rule.latency_weight > 1.0

    def test_adhd_fast_wrong_is_impulsive(self):
        rule = get_adaptive_rule("adhd")
        assert rule.fast_wrong_is_impulsive is True

    def test_dyslexia_fast_wrong_not_impulsive(self):
        rule = get_adaptive_rule("dyslexia")
        assert rule.fast_wrong_is_impulsive is False

    def test_id_requires_consecutive_correct(self):
        rule = get_adaptive_rule("intellectual_disability")
        assert rule.requires_consecutive_correct == ID_MIN_CONSECUTIVE_FOR_HARDER
        assert rule.requires_consecutive_correct >= 2

    def test_dyslexia_no_consecutive_requirement(self):
        rule = get_adaptive_rule("dyslexia")
        assert rule.requires_consecutive_correct == 0

    def test_autism_revisit_framing_is_neutral(self):
        rule = get_adaptive_rule("autism")
        assert rule.revisit_message_framing == "neutral"

    def test_adhd_revisit_framing_is_slow_down(self):
        rule = get_adaptive_rule("adhd")
        assert rule.revisit_message_framing == "slow_down"

    def test_unknown_profile_returns_fallback(self):
        rule = get_adaptive_rule("unknown_profile_xyz")
        assert rule is not None
        assert rule.easier_allowed is True  # fallback allows everything

    def test_comorbid_autism_id_disallows_easier(self):
        # autism disallows easier → comorbid also disallows it
        rule = get_adaptive_rule("autism+intellectual_disability")
        assert rule.easier_allowed is False

    def test_comorbid_autism_adhd_disallows_easier(self):
        rule = get_adaptive_rule("autism+adhd")
        assert rule.easier_allowed is False

    def test_comorbid_dyslexia_adhd_uses_lower_latency_weight(self):
        dyslexia = get_adaptive_rule("dyslexia")
        adhd = get_adaptive_rule("adhd")
        comorbid = get_adaptive_rule("dyslexia+adhd")
        assert comorbid.latency_weight == min(dyslexia.latency_weight, adhd.latency_weight)

    def test_comorbid_uses_highest_consecutive_requirement(self):
        id_rule = get_adaptive_rule("intellectual_disability")
        adhd_rule = get_adaptive_rule("adhd")
        comorbid = get_adaptive_rule("adhd+intellectual_disability")
        assert comorbid.requires_consecutive_correct == max(
            id_rule.requires_consecutive_correct,
            adhd_rule.requires_consecutive_correct,
        )

    def test_comorbid_order_does_not_matter(self):
        ab = get_adaptive_rule("autism+intellectual_disability")
        ba = get_adaptive_rule("intellectual_disability+autism")
        assert ab.easier_allowed == ba.easier_allowed
        assert ab.latency_weight == ba.latency_weight
        assert ab.requires_consecutive_correct == ba.requires_consecutive_correct


# ---------------------------------------------------------------------------
# adjusted_latency, is_slow, is_very_slow
# ---------------------------------------------------------------------------

class TestLatencyAdjustment:

    def test_dyslexia_halves_latency(self):
        rule = get_adaptive_rule("dyslexia")
        assert adjusted_latency(6000, rule) == 3000.0

    def test_adhd_amplifies_latency(self):
        rule = get_adaptive_rule("adhd")
        result = adjusted_latency(5000, rule)
        assert result > 5000

    def test_autism_does_not_change_latency(self):
        rule = get_adaptive_rule("autism")
        assert adjusted_latency(5000, rule) == 5000.0

    def test_dyslexia_slow_threshold_effectively_raised(self):
        rule = get_adaptive_rule("dyslexia")
        # 6000ms raw becomes 3000ms adjusted — below 5000ms threshold
        assert is_slow(6000, rule) is False

    def test_dyslexia_very_slow_still_triggers_at_high_latency(self):
        rule = get_adaptive_rule("dyslexia")
        # 16001ms * 0.5 = 8000.5ms — above 8000ms very slow threshold
        assert is_very_slow(16001, rule) is True

    def test_adhd_slow_threshold_effectively_lowered(self):
        rule = get_adaptive_rule("adhd")
        # 5000ms * 1.2 = 6000ms — above 5000ms threshold
        assert is_slow(5000, rule) is True

    def test_standard_slow_at_threshold(self):
        rule = get_adaptive_rule("autism")
        assert is_slow(LATENCY_SLOW_THRESHOLD_MS + 1, rule) is True
        assert is_slow(LATENCY_SLOW_THRESHOLD_MS - 1, rule) is False

    def test_very_slow_at_threshold(self):
        rule = get_adaptive_rule("autism")
        assert is_very_slow(LATENCY_VERY_SLOW_MS + 1, rule) is True
        assert is_very_slow(LATENCY_VERY_SLOW_MS - 1, rule) is False


# ---------------------------------------------------------------------------
# is_fast_wrong — impulsivity detection
# ---------------------------------------------------------------------------

class TestFastWrongDetection:

    def test_adhd_fast_wrong_is_impulsive(self):
        rule = get_adaptive_rule("adhd")
        assert is_fast_wrong(1500, is_correct=False, rule=rule) is True

    def test_adhd_slow_wrong_is_not_impulsive(self):
        rule = get_adaptive_rule("adhd")
        assert is_fast_wrong(6000, is_correct=False, rule=rule) is False

    def test_adhd_fast_correct_is_not_impulsive(self):
        rule = get_adaptive_rule("adhd")
        assert is_fast_wrong(1000, is_correct=True, rule=rule) is False

    def test_dyslexia_fast_wrong_is_not_impulsive(self):
        rule = get_adaptive_rule("dyslexia")
        assert is_fast_wrong(1000, is_correct=False, rule=rule) is False

    def test_autism_fast_wrong_is_not_impulsive(self):
        rule = get_adaptive_rule("autism")
        assert is_fast_wrong(500, is_correct=False, rule=rule) is False

    def test_id_fast_wrong_is_not_impulsive(self):
        rule = get_adaptive_rule("intellectual_disability")
        assert is_fast_wrong(1000, is_correct=False, rule=rule) is False

    def test_boundary_exactly_at_fast_threshold(self):
        rule = get_adaptive_rule("adhd")
        # Exactly at threshold — not below it, so not impulsive
        assert is_fast_wrong(LATENCY_FAST_THRESHOLD_MS, is_correct=False, rule=rule) is False
        # Just below — impulsive
        assert is_fast_wrong(LATENCY_FAST_THRESHOLD_MS - 1, is_correct=False, rule=rule) is True


# ---------------------------------------------------------------------------
# validate_directive — safety check
# ---------------------------------------------------------------------------

class TestValidateDirective:

    def test_easier_overridden_for_autism(self):
        rule = get_adaptive_rule("autism")
        directive, reason = validate_directive("easier", "autism", rule)
        assert directive == "revisit"
        assert "overridden" in reason.lower()
        assert "autism" in reason.lower()

    def test_easier_allowed_for_dyslexia(self):
        rule = get_adaptive_rule("dyslexia")
        directive, reason = validate_directive("easier", "dyslexia", rule)
        assert directive == "easier"

    def test_easier_allowed_for_adhd(self):
        rule = get_adaptive_rule("adhd")
        directive, reason = validate_directive("easier", "adhd", rule)
        assert directive == "easier"

    def test_easier_allowed_for_id(self):
        rule = get_adaptive_rule("intellectual_disability")
        directive, reason = validate_directive("easier", "intellectual_disability", rule)
        assert directive == "easier"

    def test_harder_passes_for_all_profiles(self):
        for profile in ALL_PROFILES:
            rule = get_adaptive_rule(profile)
            directive, _ = validate_directive("harder", profile, rule)
            assert directive == "harder"

    def test_same_passes_for_all_profiles(self):
        for profile in ALL_PROFILES:
            rule = get_adaptive_rule(profile)
            directive, _ = validate_directive("same", profile, rule)
            assert directive == "same"

    def test_revisit_passes_for_all_profiles(self):
        for profile in ALL_PROFILES:
            rule = get_adaptive_rule(profile)
            directive, _ = validate_directive("revisit", profile, rule)
            assert directive == "revisit"

    def test_comorbid_autism_id_overrides_easier(self):
        rule = get_adaptive_rule("autism+intellectual_disability")
        directive, reason = validate_directive("easier", "autism+intellectual_disability", rule)
        assert directive == "revisit"

    def test_reason_is_always_a_string(self):
        for profile in ALL_PROFILES:
            for d in ["easier", "same", "harder", "revisit"]:
                rule = get_adaptive_rule(profile)
                _, reason = validate_directive(d, profile, rule)
                assert isinstance(reason, str)
                assert len(reason) > 0


# ---------------------------------------------------------------------------
# build_adaptive_context_block
# ---------------------------------------------------------------------------

class TestBuildAdaptiveContextBlock:

    def test_context_block_is_string(self):
        rule = get_adaptive_rule("dyslexia")
        block = build_adaptive_context_block("dyslexia", 2, True, 3000, rule)
        assert isinstance(block, str)
        assert len(block) > 0

    def test_context_block_contains_profile(self):
        rule = get_adaptive_rule("autism")
        block = build_adaptive_context_block("autism", 1, False, 4000, rule)
        assert "autism" in block.lower()

    def test_context_block_shows_easier_not_allowed_for_autism(self):
        rule = get_adaptive_rule("autism")
        block = build_adaptive_context_block("autism", 2, False, 5000, rule)
        assert "NO" in block or "not" in block.lower()
        assert "easier" in block.lower()

    def test_context_block_shows_impulsivity_signal_for_adhd_fast_wrong(self):
        rule = get_adaptive_rule("adhd")
        block = build_adaptive_context_block("adhd", 2, False, 1000, rule)
        assert "YES" in block or "impulsivity" in block.lower()

    def test_context_block_no_impulsivity_for_adhd_correct(self):
        rule = get_adaptive_rule("adhd")
        block = build_adaptive_context_block("adhd", 2, True, 1000, rule)
        assert "YES" not in block or "impulsiv" not in block.lower()

    def test_context_block_shows_adjusted_latency_for_dyslexia(self):
        rule = get_adaptive_rule("dyslexia")
        # 6000ms * 0.5 = 3000ms
        block = build_adaptive_context_block("dyslexia", 2, True, 6000, rule)
        assert "3000" in block

    def test_context_block_contains_rule_description(self):
        rule = get_adaptive_rule("intellectual_disability")
        block = build_adaptive_context_block("intellectual_disability", 1, True, 3000, rule)
        assert "Intellectual Disability" in block or "harder" in block.lower()

    def test_context_block_shows_consecutive_requirement_for_id(self):
        rule = get_adaptive_rule("intellectual_disability")
        block = build_adaptive_context_block("intellectual_disability", 1, True, 2000, rule)
        assert str(ID_MIN_CONSECUTIVE_FOR_HARDER) in block

    @pytest.mark.parametrize("profile", ALL_PROFILES)
    def test_context_block_generated_for_all_profiles(self, profile):
        rule = get_adaptive_rule(profile)
        block = build_adaptive_context_block(profile, 2, True, 3000, rule)
        assert isinstance(block, str)
        assert len(block) > 50
