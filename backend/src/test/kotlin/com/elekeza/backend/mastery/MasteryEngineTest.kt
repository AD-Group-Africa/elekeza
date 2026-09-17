package com.elekeza.backend.mastery

import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test

/**
 * Mastery V1 — deterministic engine tests. Same evidence always produces the
 * same state; every evaluation must carry a human-readable rationale; a
 * single attempt can never confirm mastery.
 */
class MasteryEngineTest {

    private val t = MasteryThresholds.DEFAULT

    // ── States ──────────────────────────────────────────────────────────────

    @Test
    fun `no attempts is NOT_ASSESSED`() {
        val e = MasteryEngine.evaluate(emptyList())
        assertThat(e.state).isEqualTo(MasteryState.NOT_ASSESSED)
        assertThat(e.rationale).contains("No completed quiz attempts")
    }

    @Test
    fun `single strong attempt is APPROACHING - never MASTERED`() {
        val e = MasteryEngine.evaluate(listOf(90.0))
        assertThat(e.state).isEqualTo(MasteryState.APPROACHING)
        assertThat(e.rationale).contains("at least 2 attempt(s) are needed")
    }

    @Test
    fun `single weak attempt raises an early NEEDS_SUPPORT signal`() {
        val e = MasteryEngine.evaluate(listOf(20.0))
        assertThat(e.state).isEqualTo(MasteryState.NEEDS_SUPPORT)
        assertThat(e.rationale).contains("early support is wise")
    }

    @Test
    fun `single mid attempt is DEVELOPING until more evidence arrives`() {
        val e = MasteryEngine.evaluate(listOf(60.0))
        assertThat(e.state).isEqualTo(MasteryState.DEVELOPING)
        assertThat(e.rationale).contains("at least 2 attempt(s) are needed to judge reliably")
    }

    @Test
    fun `two strong attempts confirm MASTERED`() {
        val e = MasteryEngine.evaluate(listOf(85.0, 90.0))
        assertThat(e.state).isEqualTo(MasteryState.MASTERED)
        // (0.6*90 + 0.4*87.5) = 89
        assertThat(e.rationale).contains("Mastery confirmed")
    }

    @Test
    fun `one strong one weak attempt is not MASTERED - recency matters`() {
        // best 90, recent avg 20 -> combined 0.6*90+0.4*20 = 62 -> APPROACHING
        val e = MasteryEngine.evaluate(listOf(90.0, 20.0))
        assertThat(e.state).isEqualTo(MasteryState.APPROACHING)
    }

    @Test
    fun `weak evidence across attempts is NEEDS_SUPPORT`() {
        val e = MasteryEngine.evaluate(listOf(30.0, 35.0))
        // combined 0.6*35+0.4*32.5 = 34 -> below developing threshold 40
        assertThat(e.state).isEqualTo(MasteryState.NEEDS_SUPPORT)
        assertThat(e.rationale).contains("Needs support")
    }

    @Test
    fun `mid evidence is APPROACHING`() {
        val e = MasteryEngine.evaluate(listOf(60.0, 65.0))
        // combined 0.6*65+0.4*62.5 = 64 -> between 50 and 80
        assertThat(e.state).isEqualTo(MasteryState.APPROACHING)
    }

    @Test
    fun `older strong attempt decays - recent weakness dominates`() {
        // best 95, recent avg 30 -> combined 69 -> APPROACHING, not MASTERED
        val e = MasteryEngine.evaluate(listOf(95.0, 30.0, 25.0, 35.0))
        assertThat(e.state).isEqualTo(MasteryState.APPROACHING)
    }

    @Test
    fun `recovered learner with strong recent evidence is MASTERED`() {
        // best 90, recent [85, 90] avg 87.5 -> combined 0.6*90 + 0.4*87.5 = 89 >= 80
        val e = MasteryEngine.evaluate(listOf(40.0, 85.0, 90.0))
        assertThat(e.state).isEqualTo(MasteryState.MASTERED)
        assertThat(e.rationale).contains("Mastery confirmed")
    }

    // ── Determinism ─────────────────────────────────────────────────────────

    @Test
    fun `same evidence always yields the same state`() {
        val evidence = listOf(45.0, 70.0, 62.0)
        val a = MasteryEngine.evaluate(evidence)
        val b = MasteryEngine.evaluate(evidence)
        assertThat(a.state).isEqualTo(b.state)
        assertThat(a.rationale).isEqualTo(b.rationale)
    }

    // ── Threshold configuration ─────────────────────────────────────────────

    @Test
    fun `custom thresholds change outcomes deterministically`() {
        val strict = MasteryThresholds(minAttempts = 3, masteredPct = 90.0)
        // Two attempts at 100 would be MASTERED under defaults but not here.
        val e = MasteryEngine.evaluate(listOf(100.0, 100.0), strict)
        assertThat(e.state).isEqualTo(MasteryState.APPROACHING)
        assertThat(e.rationale).contains("at least 3 attempt(s)")
    }

    @Test
    fun `thresholds must be ordered`() {
        org.junit.jupiter.api.assertThrows<IllegalArgumentException> {
            MasteryThresholds(developingPct = 60.0, approachingPct = 50.0)
        }
    }

    @Test
    fun `weights must sum to one`() {
        org.junit.jupiter.api.assertThrows<IllegalArgumentException> {
            MasteryThresholds(bestWeight = 0.8, recentWeight = 0.4)
        }
    }

    // ── Explainability + recommendations ────────────────────────────────────

    @Test
    fun `every state carries a readable rationale`() {
        val samples = mapOf(
            listOf<Double>() to MasteryState.NOT_ASSESSED,
            listOf(20.0) to MasteryState.NEEDS_SUPPORT,
            listOf(55.0) to MasteryState.DEVELOPING,
            listOf(55.0, 60.0) to MasteryState.APPROACHING,
            listOf(85.0, 90.0) to MasteryState.MASTERED
        )
        samples.forEach { (evidence, expected) ->
            val e = MasteryEngine.evaluate(evidence)
            assertThat(e.state).isEqualTo(expected)
            assertThat(e.rationale).isNotBlank()
            assertThat(e.rationale.length).isGreaterThan(20)
        }
    }

    @Test
    fun `next step per state is explainable`() {
        assertThat(MasteryEngine.nextStep(MasteryEngine.evaluate(emptyList())).action).isEqualTo("start")
        assertThat(MasteryEngine.nextStep(MasteryEngine.evaluate(listOf(90.0))).action).isEqualTo("practice")
        assertThat(MasteryEngine.nextStep(MasteryEngine.evaluate(listOf(20.0, 25.0))).action).isEqualTo("support")
        assertThat(MasteryEngine.nextStep(MasteryEngine.evaluate(listOf(85.0, 90.0))).action).isEqualTo("challenge")
    }

    @Test
    fun `insufficient evidence never yields a strong recommendation`() {
        val step = MasteryEngine.nextStep(MasteryEngine.evaluate(emptyList()))
        assertThat(step.reason).contains("no strong recommendation")
    }
}
