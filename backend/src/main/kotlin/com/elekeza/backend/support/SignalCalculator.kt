package com.elekeza.backend.support

import java.time.LocalDate

/**
 * Pure signal calculation — every signal must carry a human-readable reason
 * (no unexplained black-box labels). This is an early-support system, not a
 * diagnostic one: it flags "potential support required" for teacher review.
 */
data class LearnerSignalInput(
    val learnerId: Long,
    val name: String,
    /** Completed quiz scores, most recent first. */
    val recentScores: List<Double>,
    /** Days since the last completed lesson; null when nothing was ever completed. */
    val daysSinceLastActivity: Long?,
    /** Whether the learner has any assigned lessons at all. */
    val hasAssignments: Boolean,
    /** Wrong answers in the most recent completed attempt. */
    val latestWrongAnswers: Int,
)

data class ComputedSignal(val type: SignalType, val reason: String)

object SignalCalculator {

    private const val LOW_SCORE_THRESHOLD = 50.0
    private const val INACTIVITY_DAYS = 14

    fun computeSignals(input: LearnerSignalInput): List<ComputedSignal> {
        val signals = mutableListOf<ComputedSignal>()

        // Repeated low performance: at least 2 of the last 3 scores below threshold.
        val recent = input.recentScores.take(3)
        if (recent.size >= 2 && recent.count { it < LOW_SCORE_THRESHOLD } >= 2) {
            val scores = recent.joinToString(", ") { "%.0f%%".format(it) }
            signals.add(ComputedSignal(
                SignalType.LOW_PERFORMANCE,
                "${input.name}'s last ${recent.size} quiz scores ($scores) were mostly below the 50% support threshold."
            ))
        }

        // Declining performance: last score dropped by more than 20 points from the previous one.
        if (input.recentScores.size >= 2) {
            val last = input.recentScores[0]
            val previous = input.recentScores[1]
            if (last < 60.0 && previous - last > 20.0) {
                signals.add(ComputedSignal(
                    SignalType.DECLINING,
                    "${input.name}'s latest score (%.0f%%) dropped more than 20 points from the previous one (%.0f%%).".format(last, previous)
                ))
            }
        }

        // Repeated failed questions in the most recent attempt.
        if (input.latestWrongAnswers >= 3) {
            signals.add(ComputedSignal(
                SignalType.REPEATED_FAILURES,
                "${input.name} got ${input.latestWrongAnswers} questions wrong in the most recent quiz attempt."
            ))
        }

        // Prolonged inactivity, only when the learner has assigned work.
        if (input.hasAssignments) {
            val days = input.daysSinceLastActivity
            if (days != null && days >= INACTIVITY_DAYS) {
                signals.add(ComputedSignal(
                    SignalType.INACTIVITY,
                    "${input.name} has not completed a lesson in $days days."
                ))
            } else if (days == null) {
                signals.add(ComputedSignal(
                    SignalType.INACTIVITY,
                    "${input.name} has assigned lessons but has not completed any yet."
                ))
            }
        }

        return signals
    }

    /** Deterministic, small helper used by tests. */
    fun daysBetween(from: LocalDate, to: LocalDate): Long = java.time.temporal.ChronoUnit.DAYS.between(from, to)
}
