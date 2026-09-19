package com.elekeza.backend.support

import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test

class SignalCalculatorTest {

    private fun input(
        recentScores: List<Double> = emptyList(),
        daysSinceLastActivity: Long? = null,
        hasAssignments: Boolean = true,
        latestWrongAnswers: Int = 0,
    ) = LearnerSignalInput(
        learnerId = 1L,
        name = "Amina",
        recentScores = recentScores,
        daysSinceLastActivity = daysSinceLastActivity,
        hasAssignments = hasAssignments,
        latestWrongAnswers = latestWrongAnswers,
    )

    @Test
    fun `flags low performance when most recent scores are below threshold`() {
        val signals = SignalCalculator.computeSignals(input(recentScores = listOf(40.0, 35.0, 90.0)))
        assertThat(signals.map { it.type }).contains(SignalType.LOW_PERFORMANCE)
        assertThat(signals.first { it.type == SignalType.LOW_PERFORMANCE }.reason)
            .contains("below the 50% support threshold")
    }

    @Test
    fun `does not flag low performance for generally good scores`() {
        val signals = SignalCalculator.computeSignals(input(recentScores = listOf(80.0, 90.0, 45.0)))
        assertThat(signals.map { it.type }).doesNotContain(SignalType.LOW_PERFORMANCE)
    }

    @Test
    fun `flags declining performance when the latest score drops sharply`() {
        val signals = SignalCalculator.computeSignals(input(recentScores = listOf(45.0, 80.0)))
        assertThat(signals.map { it.type }).contains(SignalType.DECLINING)
        assertThat(signals.first { it.type == SignalType.DECLINING }.reason)
            .contains("dropped more than 20 points")
    }

    @Test
    fun `does not flag decline when the drop is small or the latest score is healthy`() {
        assertThat(SignalCalculator.computeSignals(input(recentScores = listOf(70.0, 80.0))).map { it.type })
            .doesNotContain(SignalType.DECLINING)
        assertThat(SignalCalculator.computeSignals(input(recentScores = listOf(75.0, 40.0))).map { it.type })
            .doesNotContain(SignalType.DECLINING)
    }

    @Test
    fun `flags repeated failures from the latest attempt`() {
        val signals = SignalCalculator.computeSignals(input(latestWrongAnswers = 4))
        assertThat(signals.map { it.type }).contains(SignalType.REPEATED_FAILURES)
        assertThat(signals.first { it.type == SignalType.REPEATED_FAILURES }.reason).contains("4 questions wrong")
    }

    @Test
    fun `does not flag repeated failures for a strong attempt`() {
        assertThat(SignalCalculator.computeSignals(input(latestWrongAnswers = 1)).map { it.type })
            .doesNotContain(SignalType.REPEATED_FAILURES)
    }

    @Test
    fun `flags inactivity after the threshold with assigned work`() {
        val signals = SignalCalculator.computeSignals(input(daysSinceLastActivity = 20))
        assertThat(signals.map { it.type }).contains(SignalType.INACTIVITY)
        assertThat(signals.first { it.type == SignalType.INACTIVITY }.reason).contains("20 days")
    }

    @Test
    fun `flags never-started learners who have assigned work`() {
        val signals = SignalCalculator.computeSignals(input(daysSinceLastActivity = null, hasAssignments = true))
        assertThat(signals.map { it.type }).contains(SignalType.INACTIVITY)
    }

    @Test
    fun `does not flag inactivity when there is no assigned work`() {
        val signals = SignalCalculator.computeSignals(input(daysSinceLastActivity = 30, hasAssignments = false))
        assertThat(signals.map { it.type }).doesNotContain(SignalType.INACTIVITY)
    }

    @Test
    fun `clean learner produces no signals`() {
        val signals = SignalCalculator.computeSignals(input(
            recentScores = listOf(85.0, 92.0, 78.0),
            daysSinceLastActivity = 2,
            hasAssignments = true,
            latestWrongAnswers = 1,
        ))
        assertThat(signals).isEmpty()
    }

    @Test
    fun `every signal carries a human-readable reason`() {
        val signals = SignalCalculator.computeSignals(input(
            recentScores = listOf(35.0, 30.0),
            daysSinceLastActivity = 21,
            latestWrongAnswers = 5,
        ))
        assertThat(signals).isNotEmpty()
        signals.forEach { s ->
            assertThat(s.reason).isNotBlank()
            assertThat(s.reason).startsWith("Amina")
        }
    }
}
