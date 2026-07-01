package com.elekeza.backend.learner

import com.elekeza.backend.auth.User
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.web.bind.annotation.*

@RestController
@RequestMapping("/api/progress")
class ProgressController(
    private val progressRepo: LessonProgressRepository
) {
    @GetMapping("/dashboard")
    fun dashboard(@AuthenticationPrincipal user: User): Map<String, Any> {
        val completed = progressRepo.findByUserIdAndCompleted(user.id, true)
        val avg = progressRepo.avgQuizScore(user.id) ?: 0.0
        return mapOf(
            "completedCount" to completed.size,
            "averageScore" to avg,
            "recentLessons" to completed.sortedByDescending { it.completedAt }.take(5).map { p ->
                mapOf("contentId" to p.contentId, "quizScore" to p.quizScore, "completedAt" to p.completedAt?.toString())
            }
        )
    }

    @GetMapping("/lessons")
    fun assignedLessons(@AuthenticationPrincipal user: User): List<Map<String, Any>> {
        val progress = progressRepo.findByUserIdOrderByCreatedAtDesc(user.id)
        return if (progress.isEmpty()) {
            listOf(mapOf("id" to 1, "title" to "The Water Cycle"))
        } else {
            progress.map { p ->
                mapOf("id" to p.contentId, "title" to "Lesson ${p.contentId}", "score" to (p.quizScore ?: 0.0))
            }
        }
    }
}
