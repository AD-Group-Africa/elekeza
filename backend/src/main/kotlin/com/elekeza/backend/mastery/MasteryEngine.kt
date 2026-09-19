package com.elekeza.backend.mastery

import kotlin.math.roundToInt

/**
 * Mastery V1 — deterministic, explainable, evidence-based.
 *
 * Design rules (see docs/RELEASE_CANDIDATE_READINESS.md):
 *  - Evidence is completed quiz attempts per lesson (objective ≈ lesson in V1;
 *    questions are not yet skill-tagged, so per-skill mastery is a later phase).
 *  - States are ordered: NOT_ASSESSED < DEVELOPING < APPROACHING < MASTERED,
 *    with NEEDS_SUPPORT as a distinct "teacher, look here" state — never a
 *    diagnosis, never a label about the child, always about the evidence.
 *  - All thresholds are configurable ([MasteryThresholds]), never hard-coded
 *    in frontend logic.
 *  - A strong state (MASTERED) requires repeated evidence ([MasteryThresholds.minAttempts]);
 *    a single attempt can never confirm mastery.
 *  - [nextStep] recommendations are always explainable and never diagnose
 *    disability. There is no engine input or output about ability labels.
 */
enum class MasteryState {
    NOT_ASSESSED,
    DEVELOPING,
    APPROACHING,
    MASTERED,
    NEEDS_SUPPORT
}

/**
 * Configurable mastery thresholds. Defaults are sensible for a pilot; a
 * deployment may tune them via configuration rather than code changes.
 */
data class MasteryThresholds(
    /** Completed attempts required before MASTERED may be awarded. */
    val minAttempts: Int = 2,
    /** Combined score at or above this (and enough attempts) is APPROACHING. */
    val approachingPct: Double = 50.0,
    /** Combined score at or above this is DEVELOPING; below is NEEDS_SUPPORT. */
    val developingPct: Double = 40.0,
    /** Combined score at or above this (and enough attempts) is MASTERED. */
    val masteredPct: Double = 80.0,
    /** Weight of the best attempt in the combined score. */
    val bestWeight: Double = 0.6,
    /** Weight of the recent-attempt average in the combined score. */
    val recentWeight: Double = 0.4,
    /** How many of the most recent attempts form the "recent" average. */
    val recentCount: Int = 2
) {
    init {
        require(minAttempts >= 1) { "minAttempts must be >= 1" }
        require(developingPct <= approachingPct && approachingPct <= masteredPct) {
            "thresholds must be ordered: developing <= approaching <= mastered"
        }
        require(bestWeight + recentWeight == 1.0) { "weights must sum to 1.0" }
    }

    companion object {
        val DEFAULT = MasteryThresholds()
    }
}

/** Result of evaluating one lesson's evidence: state + human-readable why. */
data class MasteryEvaluation(
    val state: MasteryState,
    /** Plain-language explanation a learner or teacher can read verbatim. */
    val rationale: String
)

object MasteryEngine {

    /**
     * Evaluate completed-attempt scores (0..100, oldest first) for one lesson.
     * Pure and deterministic: same evidence always yields the same state.
     */
    fun evaluate(scores: List<Double>, t: MasteryThresholds = MasteryThresholds.DEFAULT): MasteryEvaluation {
        if (scores.isEmpty()) {
            return MasteryEvaluation(
                MasteryState.NOT_ASSESSED,
                "No completed quiz attempts yet — mastery has not been assessed."
            )
        }

        val best = scores.max()
        val recent = scores.takeLast(t.recentCount.coerceAtMost(scores.size))
        val recentAvg = recent.average()
        val combined = t.bestWeight * best + t.recentWeight * recentAvg

        val bestPct = best.roundToInt()
        val recentPct = recentAvg.roundToInt()
        val combinedPct = combined.roundToInt()

        // A single attempt is never enough to confirm mastery — the strongest
        // honest claim for one excellent attempt is APPROACHING. One very weak
        // attempt still raises an early, soft support signal (better a false
        // early flag than a missed learner), explained in the rationale.
        if (scores.size < t.minAttempts) {
            return when {
                best >= t.masteredPct -> MasteryEvaluation(
                    MasteryState.APPROACHING,
                    "Strong start: ${bestPct}% on the first attempt already meets the " +
                        "${t.masteredPct.roundToInt()}% mastery bar, but at least ${t.minAttempts} " +
                        "attempt(s) are needed to confirm mastery."
                )
                best < t.developingPct -> MasteryEvaluation(
                    MasteryState.NEEDS_SUPPORT,
                    "Only ${scores.size} attempt(s) so far, but the score of ${bestPct}% is below the " +
                        "${t.developingPct.roundToInt()}% developing threshold — early support is wise. " +
                        "More attempts will confirm the picture."
                )
                else -> MasteryEvaluation(
                    MasteryState.DEVELOPING,
                    "Only ${scores.size} attempt(s) so far with a best score of ${bestPct}% — " +
                        "at least ${t.minAttempts} attempt(s) are needed to judge reliably."
                )
            }
        }

        return when {
            combined >= t.masteredPct -> MasteryEvaluation(
                MasteryState.MASTERED,
                "Mastery confirmed: best score ${bestPct}% and recent average ${recentPct}% " +
                    "combine to ${combinedPct}%, above the ${t.masteredPct.roundToInt()}% threshold " +
                    "across ${scores.size} attempts."
            )
            combined >= t.approachingPct -> MasteryEvaluation(
                MasteryState.APPROACHING,
                "Close to mastery: best score ${bestPct}% and recent average ${recentPct}% " +
                    "combine to ${combinedPct}% — between ${t.approachingPct.roundToInt()}% and " +
                    "${t.masteredPct.roundToInt()}%. One more good attempt will confirm it."
            )
            combined >= t.developingPct -> MasteryEvaluation(
                MasteryState.DEVELOPING,
                "Still developing: best score ${bestPct}% and recent average ${recentPct}% " +
                    "combine to ${combinedPct}% — more practice recommended."
            )
            else -> MasteryEvaluation(
                MasteryState.NEEDS_SUPPORT,
                "Needs support: best score ${bestPct}% and recent average ${recentPct}% " +
                    "combine to ${combinedPct}%, below the ${t.developingPct.roundToInt()}% " +
                    "developing threshold across ${scores.size} attempts."
            )
        }
    }

    /** Learner-facing human label for a state (respectful, never diagnostic). */
    fun label(state: MasteryState): String = when (state) {
        MasteryState.NOT_ASSESSED -> "Not assessed yet"
        MasteryState.DEVELOPING -> "Developing"
        MasteryState.APPROACHING -> "Almost there"
        MasteryState.MASTERED -> "Mastered"
        MasteryState.NEEDS_SUPPORT -> "Needs support"
    }

    /**
     * Explainable next-step recommendation. Insufficient evidence produces a
     * weak recommendation, never a strong one.
     */
    data class NextStep(
        val action: String,   // start | practice | support | challenge
        val label: String,
        val reason: String
    )

    fun nextStep(evaluation: MasteryEvaluation, t: MasteryThresholds = MasteryThresholds.DEFAULT): NextStep =
        when (evaluation.state) {
            MasteryState.NOT_ASSESSED -> NextStep(
                action = "start",
                label = "Take the quiz to show what you know",
                reason = "There is no quiz evidence for this lesson yet, so no strong recommendation is made."
            )
            MasteryState.MASTERED -> NextStep(
                action = "challenge",
                label = "Try a more challenging lesson next",
                reason = evaluation.rationale
            )
            MasteryState.APPROACHING -> NextStep(
                action = "practice",
                label = "One more practice quiz will confirm mastery",
                reason = evaluation.rationale
            )
            MasteryState.DEVELOPING -> NextStep(
                action = "practice",
                label = "Practise this lesson again",
                reason = evaluation.rationale
            )
            MasteryState.NEEDS_SUPPORT -> NextStep(
                action = "support",
                label = "Ask your teacher for help with this lesson",
                reason = evaluation.rationale
            )
        }
}
