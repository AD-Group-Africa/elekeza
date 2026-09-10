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

    data class GamificationData(
        val level: Int,
        val levelName: String,
        val points: Int,
        val nextLevelPoints: Int,
        val stars: Int,
        val achievements: List<String>
    )

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

        fun compute(points: Int, quizzes: Int, lessons: Int, avgScore: Double, streak: Int): GamificationData {
            val level = ((points / POINTS_PER_LEVEL) + 1).coerceAtMost(LEVEL_NAMES.size)
            val nextLevelPoints = (level * POINTS_PER_LEVEL) - points
            val stars = when {
                avgScore >= 90 -> 5
                avgScore >= 75 -> 4
                avgScore >= 60 -> 3
                avgScore >= 40 -> 2
                quizzes > 0 -> 1
                else -> 0
            }
            val achievements = buildList {
                if (quizzes >= 1) add("First Steps")
                if (quizzes >= 5) add("Quiz Explorer")
                if (quizzes >= 10) add("Quiz Champion")
                if (lessons >= 5) add("Lesson Star")
                if (lessons >= 10) add("Scholar")
                if (avgScore >= 80 && quizzes >= 3) add("Sharpshooter")
                if (streak >= 3) add("On Fire")
                if (streak >= 7) add("Unstoppable")
            }
            return GamificationData(level, LEVEL_NAMES[level - 1], points, nextLevelPoints, stars, achievements)
        }
    }

    @GetMapping("/student")
    fun student(@AuthenticationPrincipal user: User): GamificationData {
        val quizzes = attemptRepo.countByUserIdAndCompleted(user.id, true).toInt()
        val lessons = progressRepo.findByUserIdAndCompleted(user.id, true).size
        val avg = progressRepo.avgQuizScore(user.id) ?: 0.0
        val points = quizzes * POINTS_PER_QUIZ + lessons * POINTS_PER_LESSON
        return compute(points, quizzes, lessons, avg, streak = 0)
    }
}
