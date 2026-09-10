package com.elekeza.backend.guardian

import com.elekeza.backend.auth.User
import com.elekeza.backend.auth.UserRepository
import com.elekeza.backend.learner.LessonProgressRepository
import com.elekeza.backend.learner.LearnerProfileRepository
import com.elekeza.backend.institution.GuardianLinkRepository
import org.springframework.http.ResponseEntity
import org.springframework.security.access.prepost.PreAuthorize
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.web.bind.annotation.*

@RestController
@RequestMapping("/api/guardian")
@PreAuthorize("hasRole('GUARDIAN')")
class GuardianController(
    private val userRepo: UserRepository,
    private val lessonProgressRepo: LessonProgressRepository,
    private val learnerProfileRepo: LearnerProfileRepository,
    private val guardianLinkRepo: GuardianLinkRepository
) {
    @GetMapping("/wards")
    fun getWards(@AuthenticationPrincipal guardian: User): ResponseEntity<List<Map<String, Any>>> {
        val links = guardianLinkRepo.findAll().filter { it.guardianId == guardian.id }
        val wards = links.mapNotNull { link ->
            val learner = userRepo.findById(link.learnerId).orElse(null) ?: return@mapNotNull null
            val profile = learnerProfileRepo.findByUserId(learner.id)
            val progress = lessonProgressRepo.findByUserIdOrderByCreatedAtDesc(learner.id)
            val completed = progress.filter { it.completed }
            val avgScore = if (completed.isNotEmpty()) completed.mapNotNull { it.quizScore }.average() else 0.0

            mapOf<String, Any>(
                "id" to learner.id,
                "name" to learner.name,
                // Relationship label (PARENT/CAREGIVER/OLDER_SIBLING/…): the
                // account role is always GUARDIAN — this describes the bond.
                "relationship" to link.relationship,
                "sneType" to (profile?.sneType?.name ?: "NONE"),
                "lessonsCompleted" to completed.size,
                "lessonsPending" to progress.size - completed.size,
                "averageScore" to avgScore,
                // Latest *completed* activity — a pending row has no completedAt.
                "lastActive" to (progress.mapNotNull { it.completedAt }.maxOrNull()?.toString() ?: ""),
                "recentQuizzes" to completed.takeLast(5).map { q ->
                    mapOf<String, Any>(
                        "lessonId" to q.contentId,
                        "score" to (q.quizScore ?: 0.0),
                        "date" to (q.completedAt?.toString() ?: "")
                    )
                },
                "progressHistory" to completed.sortedBy { it.completedAt }.map { p ->
                    mapOf<String, Any>(
                        "date" to (p.completedAt?.toString() ?: ""),
                        "score" to (p.quizScore ?: 0.0)
                    )
                }
            )
        }
        return ResponseEntity.ok(wards)
    }

    @GetMapping("/wards/{wardId}/progress")
    fun getWardProgress(@AuthenticationPrincipal guardian: User, @PathVariable wardId: Long): ResponseEntity<Map<String, Any>> {
        val link = guardianLinkRepo.findAll().firstOrNull { it.guardianId == guardian.id && it.learnerId == wardId }
            ?: return ResponseEntity.status(403).body(mapOf("error" to "Not authorized"))
        val learner = userRepo.findById(wardId).orElseThrow()
        val progress = lessonProgressRepo.findByUserIdOrderByCreatedAtDesc(wardId)
        val completed = progress.filter { it.completed }

        return ResponseEntity.ok(mapOf(
            "learner" to mapOf("id" to learner.id, "name" to learner.name),
            "completedLessons" to completed.size,
            "totalLessons" to progress.size,
            "averageScore" to (if (completed.isNotEmpty()) completed.mapNotNull { it.quizScore }.average() else 0.0),
            "progress" to completed.map { mapOf("lessonId" to it.contentId, "score" to (it.quizScore ?: 0.0), "date" to it.completedAt.toString()) }
        ))
    }
}
