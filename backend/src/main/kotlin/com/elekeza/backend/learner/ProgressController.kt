package com.elekeza.backend.learner

import com.elekeza.backend.auth.User
import com.elekeza.backend.content.ContentRepository
import com.elekeza.backend.quiz.QuizAttemptRepository
import com.elekeza.backend.quiz.QuizRepository
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.web.bind.annotation.*

@RestController
@RequestMapping("/api/progress")
class ProgressController(
    private val progressRepo: LessonProgressRepository,
    private val contentRepo: ContentRepository,
    private val quizRepo: QuizRepository,
    private val attemptRepo: QuizAttemptRepository
) {
    @GetMapping("/dashboard")
    fun dashboard(@AuthenticationPrincipal user: User): Map<String, Any> {
        val completed = progressRepo.findByUserIdAndCompleted(user.id, true)
        val avg = progressRepo.avgQuizScore(user.id) ?: 0.0
        val upcoming = progressRepo.findByUserIdOrderByCreatedAtDesc(user.id)
            .filter { !it.completed }
            .mapNotNull { p ->
                val quiz = quizRepo.findByContentId(p.contentId) ?: return@mapNotNull null
                val title = contentRepo.findById(p.contentId).map { it.title ?: "Lesson ${p.contentId}" }.orElse("Lesson ${p.contentId}")
                mapOf("id" to quiz.id, "lessonId" to p.contentId, "title" to title)
            }
        return mapOf(
            // The learner's own name — the companion greets them personally.
            "name"             to user.name.substringBefore(' ').ifBlank { "Learner" },
            // Legacy key kept for the older dashboard page
            "completedCount"  to completed.size,
            // Keys the learner pages (student-home, progress, student-quizzes) read
            "completedLessons" to completed.size,
            "quizzesTaken"     to attemptRepo.countByUserIdAndCompleted(user.id, true),
            "averageScore"     to avg,
            "recentLessons"    to completed.sortedByDescending { it.completedAt }.take(5).map { p ->
                val title = contentRepo.findById(p.contentId).map { it.title ?: "Lesson ${p.contentId}" }.orElse("Lesson ${p.contentId}")
                mapOf(
                    "id" to p.contentId, "contentId" to p.contentId, "title" to title,
                    "quizScore" to p.quizScore, "completedAt" to p.completedAt?.toString()
                )
            },
            "upcomingQuizzes"  to upcoming
        )
    }

    @GetMapping("/lessons")
    fun assignedLessons(@AuthenticationPrincipal user: User): List<Map<String, Any>> {
        val progress = progressRepo.findByUserIdOrderByCreatedAtDesc(user.id)
        // Return empty list when no lessons assigned — never return hardcoded fallback
        return progress.map { p ->
            val title = contentRepo.findById(p.contentId).map { it.title ?: "Lesson ${p.contentId}" }.orElse("Lesson ${p.contentId}")
            mapOf(
                "id"        to p.contentId,
                "title"     to title,
                "score"     to (p.quizScore ?: 0.0),
                "completed" to p.completed
            )
        }
    }
}
