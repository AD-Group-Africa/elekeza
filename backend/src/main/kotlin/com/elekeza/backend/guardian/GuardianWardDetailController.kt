package com.elekeza.backend.guardian

import com.elekeza.backend.auth.User
import com.elekeza.backend.auth.UserRepository
import com.elekeza.backend.institution.GuardianLinkRepository
import com.elekeza.backend.learner.LearnerProfileRepository
import com.elekeza.backend.learner.LessonProgressRepository
import org.springframework.http.ResponseEntity
import org.springframework.security.access.prepost.PreAuthorize
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.web.bind.annotation.*

@RestController
@RequestMapping("/api/guardian")
class GuardianWardDetailController(
    private val guardianLinkRepo: GuardianLinkRepository,
    private val userRepo: UserRepository,
    private val lessonProgressRepo: LessonProgressRepository,
    private val learnerProfileRepo: LearnerProfileRepository,
) {

    @GetMapping("/wards/{id}")
    @PreAuthorize("hasAnyRole('GUARDIAN', 'ADMIN')")
    fun getWardDetail(@AuthenticationPrincipal guardian: User, @PathVariable id: Long): ResponseEntity<Map<String, Any>> {
        // A guardian may only view their own linked ward.
        val link = guardianLinkRepo.findAll().firstOrNull { it.guardianId == guardian.id && it.learnerId == id }
            ?: return ResponseEntity.status(403).body(mapOf("error" to "Not authorized"))
        val learner = userRepo.findById(id).orElse(null)
            ?: return ResponseEntity.status(404).body(mapOf("error" to "Ward not found"))
        val profile = learnerProfileRepo.findByUserId(learner.id)
        val progress = lessonProgressRepo.findByUserIdOrderByCreatedAtDesc(learner.id)
        val completed = progress.filter { it.completed }
        val avgScore = if (completed.isNotEmpty()) completed.mapNotNull { it.quizScore }.average() else 0.0

        return ResponseEntity.ok(mapOf(
            "id" to learner.id,
            "name" to learner.name,
            "sneType" to (profile?.sneType?.name ?: "NONE"),
            "lessonsCompleted" to completed.size,
            "lessonsPending" to (progress.size - completed.size),
            "averageScore" to avgScore,
            "lastActive" to (progress.firstOrNull()?.completedAt?.toString() ?: ""),
            "recentQuizzes" to completed.takeLast(5).map { q ->
                mapOf(
                    "lessonId" to q.contentId,
                    "score" to (q.quizScore ?: 0.0),
                    "date" to (q.completedAt?.toString() ?: "")
                )
            },
            "progressHistory" to completed.sortedBy { it.completedAt }.map { p ->
                mapOf(
                    "date" to (p.completedAt?.toString() ?: ""),
                    "score" to (p.quizScore ?: 0.0)
                )
            }
        ))
    }
}
