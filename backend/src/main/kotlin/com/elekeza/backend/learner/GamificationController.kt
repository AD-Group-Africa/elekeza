package com.elekeza.backend.learner

import com.elekeza.backend.auth.User
import com.elekeza.backend.quiz.QuizAttemptRepository
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

/**
 * Gamification for the learner experience — computed on the fly from data the
 * platform already records (completed quizzes, scores, streaks). No new
 * tables, no leaderboards, no competition: the reward is the learner's own
 * progress ("I did it"), not beating anyone.
 */
@RestController
@RequestMapping("/api/gamification")
class GamificationController(
    private val progressRepo: LessonProgressRepository,
    private val attemptRepo: QuizAttemptRepository
) {

    /**
     * One badge in the catalogue. Locked badges are returned too so the
     * learner can see what to aim for next; [progress]/[goal] drive a small
     * "3 of 5" hint. Badges are never taken away.
     */
    data class Badge(
        val id: String,
        val name: String,
        val description: String,
        val icon: String,
        val earned: Boolean,
        val progress: Int,
        val goal: Int
    )

    data class GamificationData(
        val level: Int,
        val levelName: String,
        val points: Int,
        val nextLevelPoints: Int,
        val stars: Int,
        /** Names of earned badges (kept for existing clients). */
        val achievements: List<String>,
        /** Consecutive learning days, see [LearningStreak]. */
        val streak: Int = 0,
        /** Full badge catalogue, earned first. */
        val badges: List<Badge> = emptyList()
    )

    private data class BadgeRule(
        val id: String,
        val name: String,
        val description: String,
        val icon: String,
        val goal: Int,
        val measure: (Stats) -> Int
    )

    private data class Stats(val quizzes: Int, val lessons: Int, val avgScore: Double, val streak: Int)

    companion object {
        // Points: 10 per completed quiz + 2 per completed lesson. Levels every
        // 50 points — deliberately easy so early learners celebrate quickly.
        const val POINTS_PER_QUIZ = 10
        const val POINTS_PER_LESSON = 2
        const val POINTS_PER_LEVEL = 50

        val LEVEL_NAMES = listOf(
            "Seed", "Sprout", "Explorer", "Adventurer", "Pathfinder",
            "Trailblazer", "Star Chaser", "Scholar", "Champion", "Legend"
        )

        // Order = display order for locked badges (easiest first).
        private val BADGES = listOf(
            BadgeRule("first-steps", "First Steps", "Finish your first quiz", "🌱", 1) { it.quizzes },
            BadgeRule("on-fire", "On Fire", "Learn 3 days in a row", "🔥", 3) { it.streak },
            BadgeRule("quiz-explorer", "Quiz Explorer", "Finish 5 quizzes", "🧭", 5) { it.quizzes },
            BadgeRule("lesson-star", "Lesson Star", "Complete 5 lessons", "⭐", 5) { it.lessons },
            BadgeRule("sharpshooter", "Sharpshooter", "Average 80% or more over 3+ quizzes", "🎯", 3) {
                if (it.avgScore >= 80) it.quizzes else 0
            },
            BadgeRule("unstoppable", "Unstoppable", "Learn 7 days in a row", "🚀", 7) { it.streak },
            BadgeRule("quiz-champion", "Quiz Champion", "Finish 10 quizzes", "🏆", 10) { it.quizzes },
            BadgeRule("scholar", "Scholar", "Complete 10 lessons", "📚", 10) { it.lessons },
        )

        fun compute(points: Int, quizzes: Int, lessons: Int, avgScore: Double, streak: Int): GamificationData {
            val level = ((points / POINTS_PER_LEVEL) + 1).coerceAtMost(LEVEL_NAMES.size)
            // At the top level there is no next level to count towards.
            val nextLevelPoints = ((level * POINTS_PER_LEVEL) - points).coerceAtLeast(0)
            val stars = when {
                avgScore >= 90 -> 5
                avgScore >= 75 -> 4
                avgScore >= 60 -> 3
                avgScore >= 40 -> 2
                quizzes > 0 -> 1
                else -> 0
            }
            val stats = Stats(quizzes, lessons, avgScore, streak)
            val badges = BADGES.map { rule ->
                val value = rule.measure(stats)
                Badge(
                    id = rule.id,
                    name = rule.name,
                    description = rule.description,
                    icon = rule.icon,
                    earned = value >= rule.goal,
                    progress = value.coerceIn(0, rule.goal),
                    goal = rule.goal
                )
            }.sortedByDescending { it.earned }
            return GamificationData(
                level = level,
                levelName = LEVEL_NAMES[level - 1],
                points = points,
                nextLevelPoints = nextLevelPoints,
                stars = stars,
                achievements = badges.filter { it.earned }.map { it.name },
                streak = streak,
                badges = badges
            )
        }
    }

    @GetMapping("/student")
    fun student(@AuthenticationPrincipal user: User): GamificationData {
        val quizzes = attemptRepo.countByUserIdAndCompleted(user.id, true).toInt()
        val completed = progressRepo.findByUserIdAndCompleted(user.id, true)
        val lessons = completed.size
        val avg = progressRepo.avgQuizScore(user.id) ?: 0.0
        val streak = LearningStreak.current(completed.mapNotNull { it.completedAt?.toLocalDate() })
        val points = quizzes * POINTS_PER_QUIZ + lessons * POINTS_PER_LESSON
        return compute(points, quizzes, lessons, avg, streak)
    }
}
