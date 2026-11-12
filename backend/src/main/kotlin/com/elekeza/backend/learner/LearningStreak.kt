package com.elekeza.backend.learner

import java.time.LocalDate

/**
 * Consecutive-day learning streak, shared by gamification and analytics so the
 * two never disagree.
 *
 * Rules:
 *  - several completions on the same day count once (the old loop broke the
 *    streak when two lessons were finished on one day);
 *  - the streak is still "alive" if the last learning day was today or
 *    yesterday — a learner who has not studied yet today has not lost it;
 *  - a gap of more than one day ends it, so stale history gives 0.
 */
object LearningStreak {
    fun current(activityDays: Collection<LocalDate>, today: LocalDate = LocalDate.now()): Int {
        val days = activityDays.filter { !it.isAfter(today) }.distinct().sortedDescending()
        val latest = days.firstOrNull() ?: return 0
        if (latest.isBefore(today.minusDays(1))) return 0

        var streak = 0
        var expected = latest
        for (day in days) {
            if (day == expected) {
                streak++
                expected = expected.minusDays(1)
            } else {
                break
            }
        }
        return streak
    }
}
