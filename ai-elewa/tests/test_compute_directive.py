"""
Deterministic unit tests for compute_directive() — Release Gate 1.

Source of truth: the existing adaptive rule machinery in
utils/adaptive_rules.py (rule fields + is_slow/is_very_slow/is_fast_wrong)
and each rule's rule_description. No server, no LLM, no I/O — fully
deterministic.

Equivalence matrix = 4 profiles × (correct/incorrect × fast/slow), where the
expected directive is derived from the existing machinery and rule
descriptions. Boundary latencies use threshold+/-1 so the tests pin the exact
semantics of is_slow/is_very_slow/is_fast_wrong.
"""
import pytest

from utils.adaptive_rules import (
    compute_directive,
    get_adaptive_rule,
    is_fast_wrong,
    is_slow,
    is_very_slow,
    LATENCY_SLOW_THRESHOLD_MS,
    LATENCY_FAST_THRESHOLD_MS,
    LATENCY_VERY_SLOW_MS,
    ID_MIN_CONSECUTIVE_FOR_HARDER,
)

ALL_PROFILES = ["dyslexia", "adhd", "autism", "intellectual_disability"]


# ---------------------------------------------------------------------------
# Equivalence matrix — 4 profiles × 4 outcome/latency combos
# (expected values derived from existing machinery + rule descriptions)
# ---------------------------------------------------------------------------

class TestEquivalenceMatrix:
    """compute_directive must agree with the existing adaptive rule machinery."""

    # -- dyslexia: latency_weight 0.5 (decoding time) -----------------------

    def test_dyslexia_correct_fast(self):
        rule = get_adaptive_rule("dyslexia")
        # 2000ms * 0.5 = 1000ms adjusted — not slow → harder
        assert compute_directive(True, 2000, rule) == "harder"

    def test_dyslexia_correct_slow(self):
        rule = get_adaptive_rule("dyslexia")
        # 6000ms * 0.5 = 3000ms adjusted — not slow → stays harder
        # ("A slow correct answer ... should remain harder unless latency is
        #  very high" — rule_description)
        assert compute_directive(True, 6000, rule) == "harder"

    def test_dyslexia_correct_very_slow(self):
        rule = get_adaptive_rule("dyslexia")
        # 16001ms * 0.5 = 8000.5ms adjusted — very slow → same
        assert compute_directive(True, LATENCY_VERY_SLOW_MS * 2 + 1, rule) == "same"

    def test_dyslexia_wrong_normal_time(self):
        rule = get_adaptive_rule("dyslexia")
        # 3000ms * 0.5 = 1500ms adjusted — normal-time wrong → revisit
        assert compute_directive(False, 3000, rule) == "revisit"

    def test_dyslexia_wrong_slow(self):
        rule = get_adaptive_rule("dyslexia")
        # Even beyond the slow threshold, decoding-time rule keeps revisit:
        # 11001ms * 0.5 = 5500.5ms adjusted — slow wrong → revisit, NOT easier
        # ("A slow wrong answer should trigger revisit, not easier" — rule_description)
        assert compute_directive(False, LATENCY_SLOW_THRESHOLD_MS * 2 + 1, rule) == "revisit"

    # -- adhd: latency_weight 1.2, fast_wrong_is_impulsive ------------------

    def test_adhd_correct_fast(self):
        rule = get_adaptive_rule("adhd")
        # 2000ms * 1.2 = 2400ms adjusted — not slow → harder
        assert compute_directive(True, 2000, rule) == "harder"

    def test_adhd_correct_slow(self):
        rule = get_adaptive_rule("adhd")
        # 4200ms * 1.2 = 5040ms adjusted — slow → same
        assert compute_directive(True, 4200, rule) == "same"

    def test_adhd_wrong_fast_is_impulsive(self):
        rule = get_adaptive_rule("adhd")
        # Fast wrong answer = impulsivity signal → revisit, never easier
        assert compute_directive(False, LATENCY_FAST_THRESHOLD_MS - 1, rule) == "revisit"

    def test_adhd_wrong_slow(self):
        rule = get_adaptive_rule("adhd")
        # Slow wrong (not impulsive) → easier
        assert compute_directive(False, 6000, rule) == "easier"

    # -- autism: easier never allowed ---------------------------------------

    def test_autism_correct_fast(self):
        rule = get_adaptive_rule("autism")
        assert compute_directive(True, 2000, rule) == "harder"

    def test_autism_correct_slow(self):
        rule = get_adaptive_rule("autism")
        # 5001ms adjusted — slow → same
        assert compute_directive(True, LATENCY_SLOW_THRESHOLD_MS + 1, rule) == "same"

    def test_autism_wrong_normal_time(self):
        rule = get_adaptive_rule("autism")
        assert compute_directive(False, 3000, rule) == "revisit"

    def test_autism_wrong_slow_never_easier(self):
        rule = get_adaptive_rule("autism")
        # The autism safety rule: 'easier' signals failure and causes distress —
        # revisit replaces it in all cases.
        assert compute_directive(False, LATENCY_SLOW_THRESHOLD_MS + 1, rule) == "revisit"

    def test_autism_wrong_very_slow_never_easier(self):
        rule = get_adaptive_rule("autism")
        assert compute_directive(False, LATENCY_VERY_SLOW_MS + 1, rule) == "revisit"

    # -- intellectual_disability: consecutive-correct gate ------------------

    def test_id_correct_fast_single_answer_returns_same(self):
        rule = get_adaptive_rule("intellectual_disability")
        # A single correct answer never escalates: 'harder' requires
        # ID_MIN_CONSECUTIVE_FOR_HARDER consecutive correct answers.
        assert compute_directive(True, 2000, rule, consecutive_correct=0) == "same"
        assert compute_directive(True, 2000, rule, consecutive_correct=1) == "same"

    def test_id_correct_fast_with_streak_returns_harder(self):
        rule = get_adaptive_rule("intellectual_disability")
        assert compute_directive(
            True, 2000, rule, consecutive_correct=ID_MIN_CONSECUTIVE_FOR_HARDER
        ) == "harder"

    def test_id_correct_slow_returns_same(self):
        rule = get_adaptive_rule("intellectual_disability")
        assert compute_directive(
            True, LATENCY_SLOW_THRESHOLD_MS + 1, rule,
            consecutive_correct=ID_MIN_CONSECUTIVE_FOR_HARDER,
        ) == "same"

    def test_id_wrong_normal_time_revisit_before_easier(self):
        rule = get_adaptive_rule("intellectual_disability")
        # "A wrong answer returns revisit before easier — the learner gets a
        #  second chance before difficulty drops." (rule_description)
        assert compute_directive(False, 3000, rule) == "revisit"

    def test_id_wrong_slow_returns_easier(self):
        rule = get_adaptive_rule("intellectual_disability")
        # id allows easier, is not decoding-weighted, not impulsive → easier
        assert compute_directive(False, LATENCY_SLOW_THRESHOLD_MS + 1, rule) == "easier"


# ---------------------------------------------------------------------------
# Comorbid profiles — most-protective combination
# ---------------------------------------------------------------------------

class TestComorbidDirectives:

    def test_comorbid_autism_id_single_correct_same(self):
        rule = get_adaptive_rule("autism+intellectual_disability")
        # ID consecutive gate + autism easier ban
        assert compute_directive(True, 2000, rule, consecutive_correct=1) == "same"

    def test_comorbid_autism_id_correct_fast_streak_harder(self):
        rule = get_adaptive_rule("autism+intellectual_disability")
        assert compute_directive(
            True, 2000, rule, consecutive_correct=ID_MIN_CONSECUTIVE_FOR_HARDER
        ) == "harder"

    def test_comorbid_autism_adhd_wrong_slow_revisit(self):
        rule = get_adaptive_rule("autism+adhd")
        # autism bans easier (would have been easier from the adhd slow-wrong path)
        assert compute_directive(False, 6000, rule) == "revisit"

    def test_comorbid_dyslexia_adhd_correct_slow(self):
        rule = get_adaptive_rule("dyslexia+adhd")
        # comorbid latency_weight = min(0.5, 1.2) = 0.5 → decoding-time rule:
        # slow correct stays harder
        assert compute_directive(True, 6000, rule) == "harder"


# ---------------------------------------------------------------------------
# Rule-driver coverage — each machinery signal that changes the directive
# ---------------------------------------------------------------------------

class TestRuleDrivers:

    def test_impulsivity_signal_drives_revisit(self):
        """ADHD fast-wrong: is_fast_wrong is the exact driver of revisit."""
        rule = get_adaptive_rule("adhd")
        latency = LATENCY_FAST_THRESHOLD_MS - 1
        assert is_fast_wrong(latency, False, rule) is True
        assert compute_directive(False, latency, rule) == "revisit"
        # The same latency on a non-impulsive profile would take the
        # normal-time wrong path — which is also revisit, so compare against
        # the slow-wrong path instead: only impulsivity converts a
        # would-be-easier slow-ish wrong into revisit at the fast boundary.

    def test_latency_weight_drives_decoding_time_rule(self):
        """Dyslexia slowness reflects decoding, not difficulty."""
        rule = get_adaptive_rule("dyslexia")
        latency = LATENCY_SLOW_THRESHOLD_MS * 2 + 1  # adjusted: slow
        assert is_slow(latency, rule) is True
        assert rule.latency_weight < 1.0
        assert compute_directive(False, latency, rule) == "revisit"

    def test_easier_allowed_gate_drives_wrong_slow(self):
        """Only profiles where easier_allowed is True can return easier."""
        for profile in ALL_PROFILES:
            rule = get_adaptive_rule(profile)
            directive = compute_directive(False, LATENCY_SLOW_THRESHOLD_MS + 1, rule)
            if rule.easier_allowed:
                assert directive in {"easier", "revisit"}
            else:
                assert directive != "easier"

    def test_consecutive_gate_only_binds_when_required(self):
        """Profiles without a consecutive requirement escalate immediately."""
        for profile in ("dyslexia", "adhd", "autism"):
            rule = get_adaptive_rule(profile)
            assert rule.requires_consecutive_correct == 0
            assert compute_directive(True, 2000, rule, consecutive_correct=0) == "harder"

    def test_consecutive_gate_counts_up_correctly(self):
        rule = get_adaptive_rule("intellectual_disability")
        streaks = range(0, ID_MIN_CONSECUTIVE_FOR_HARDER + 2)
        directives = [
            compute_directive(True, 2000, rule, consecutive_correct=s) for s in streaks
        ]
        assert directives == ["same", "same", "harder", "harder"]


# ---------------------------------------------------------------------------
# Determinism — same input → same directive, always
# ---------------------------------------------------------------------------

class TestDeterminism:

    @pytest.mark.parametrize("profile", ALL_PROFILES)
    @pytest.mark.parametrize("is_correct", [True, False])
    @pytest.mark.parametrize("latency_ms", [500, 1999, 2000, 4999, 5001, 8001, 16001, 30000])
    def test_repeated_calls_identical(self, profile, is_correct, latency_ms):
        rule = get_adaptive_rule(profile)
        first = compute_directive(is_correct, latency_ms, rule)
        for _ in range(20):
            assert compute_directive(is_correct, latency_ms, rule) == first

    def test_result_is_always_a_valid_directive(self):
        valid = {"easier", "same", "harder", "revisit"}
        for profile in ALL_PROFILES:
            rule = get_adaptive_rule(profile)
            for latency in (0, 1, 1999, 2000, 4999, 5001, 8001, 100000):
                for correct in (True, False):
                    assert compute_directive(correct, latency, rule) in valid

    def test_pure_no_mutation_of_rule(self):
        """Calling compute_directive must not mutate the shared rule object."""
        rule = get_adaptive_rule("dyslexia")
        before = (rule.easier_allowed, rule.latency_weight, rule.fast_wrong_is_impulsive)
        compute_directive(True, 6000, rule)
        compute_directive(False, 3000, rule)
        after = (rule.easier_allowed, rule.latency_weight, rule.fast_wrong_is_impulsive)
        assert before == after
