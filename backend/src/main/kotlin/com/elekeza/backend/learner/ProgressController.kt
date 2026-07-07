package com.elekeza.backend.learner

import com.elekeza.backend.auth.User
import com.elekeza.backend.content.ContentRepository
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.web.bind.annotation.*

@RestController
@RequestMapping("/api/progress")
class ProgressController(
    private val progressRepo: LessonProgressRepository,
    private val contentRepo: ContentRepository
) {
    @GetMapping("/dashboard")
    fun dashboard(@AuthenticationPrincipal user: User): Map<String, Any> {
        val completed = progressRepo.findByUserIdAndCompleted(user.id, true)
        val avg = progressRepo.avgQuizScore(user.id) ?: 0.0
        return mapOf(
            "completedCount" to completed.size,
            "averageScore"   to avg,
            "recentLessons"  to completed.sortedByDescending { it.completedAt }.take(5).map { p ->
                val title = contentRepo.findById(p.contentId).map { it.title ?: "Lesson ${p.contentId}" }.orElse("Lesson ${p.contentId}")
                mapOf("contentId" to p.contentId, "title" to title, "quizScore" to p.quizScore, "completedAt" to p.completedAt?.toString())
            }
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
