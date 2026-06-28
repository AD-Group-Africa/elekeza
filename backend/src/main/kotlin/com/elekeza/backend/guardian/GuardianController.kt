package com.elekeza.backend.guardian

import com.elekeza.backend.auth.User
import com.elekeza.backend.auth.UserRepository
import com.elekeza.backend.learner.GuardianRepository
import com.elekeza.backend.learner.LessonProgressRepository
import com.elekeza.backend.learner.LearnerProfileRepository
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.security.access.prepost.PreAuthorize
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.web.bind.annotation.*
import org.springframework.web.server.ResponseStatusException

@RestController
@RequestMapping("/api/guardian")
@PreAuthorize("hasAnyRole('GUARDIAN', 'ADMIN')")
class GuardianController(
    private val userRepository: UserRepository,
    private val guardianRepository: GuardianRepository,
    private val lessonProgressRepository: LessonProgressRepository,
    private val learnerProfileRepository: LearnerProfileRepository
) {

    // ── GET /api/guardian/wards ───────────────────────────────────────────────
    // Returns all children linked to the authenticated guardian, with progress.

    @GetMapping("/wards")
    fun getWards(@AuthenticationPrincipal guardian: User): ResponseEntity<List<WardDto>> {
        // Guardian links are stored with guardian email matching user email
        // Guardian entity → learner (UUID) → learner email → User (Long id)
        val guardianEmail = guardian.email

        // Find all Guardian records where the guardian email matches
        val links = guardianRepository.findAllByEmail(guardianEmail)

        val wards = links.mapNotNull { link ->
            // Resolve learner UUID → email → User
            val learner = link.learner
            val learnerUser = userRepository.findByEmail(learner.email) ?: return@mapNotNull null
            val profile     = learnerProfileRepository.findByUserId(learnerUser.id)

            val completed  = lessonProgressRepository.countByUserIdAndCompleted(learnerUser.id, true)
            val avgScore   = lessonProgressRepository.avgQuizScore(learnerUser.id)
            val recent     = lessonProgressRepository.findByUserIdOrderByCreatedAtDesc(learnerUser.id)
                .take(3)
                .map { p -> RecentLessonDto(p.contentId, p.quizScore, p.completedAt?.toString()) }

            WardDto(
                id               = learnerUser.id,
                name             = learnerUser.name,
                email            = learnerUser.email,
                sneType          = profile?.sneType?.name ?: "NONE",
                completedLessons = completed.toInt(),
                avgQuizScore     = avgScore,
                relationship     = link.relationship,
                recentActivity   = recent
            )
        }

        return ResponseEntity.ok(wards)
    }

    // ── GET /api/guardian/wards/{wardId}/progress ─────────────────────────────

    @GetMapping("/wards/{wardId}/progress")
    fun getWardProgress(
        @PathVariable wardId: Long,
        @AuthenticationPrincipal guardian: User
    ): ResponseEntity<WardProgressDto> {
        // Verify this ward is linked to the requesting guardian
        val wardUser = userRepository.findById(wardId).orElseThrow {
            ResponseStatusException(HttpStatus.NOT_FOUND, "Student not found")
        }
        val links = guardianRepository.findAllByEmail(guardian.email)
        val isLinked = links.any { it.learner.email == wardUser.email }
        if (!isLinked) throw ResponseStatusException(HttpStatus.FORBIDDEN, "Not linked to this student")

        val completed = lessonProgressRepository.countByUserIdAndCompleted(wardId, true)
        val pending   = lessonProgressRepository.findByUserIdAndCompleted(wardId, false)
        val avgScore  = lessonProgressRepository.avgQuizScore(wardId)
        val recent    = lessonProgressRepository.findByUserIdOrderByCreatedAtDesc(wardId).take(10)

        return ResponseEntity.ok(WardProgressDto(
            studentName      = wardUser.name,
            completedLessons = completed.toInt(),
            pendingLessons   = pending.size,
            avgQuizScore     = avgScore,
            recentActivity   = recent.map { p ->
                RecentLessonDto(p.contentId, p.quizScore, p.completedAt?.toString())
            }
        ))
    }
}

// ── DTOs ─────────────────────────────────────────────────────────────────────

data class WardDto(
    val id:               Long,
    val name:             String,
    val email:            String,
    val sneType:          String,
    val completedLessons: Int,
    val avgQuizScore:     Double?,
    val relationship:     String,
    val recentActivity:   List<RecentLessonDto>
)

data class WardProgressDto(
    val studentName:      String,
    val completedLessons: Int,
    val pendingLessons:   Int,
    val avgQuizScore:     Double?,
    val recentActivity:   List<RecentLessonDto>
)

data class RecentLessonDto(
    val contentId:   Long,
    val quizScore:   Double?,
    val completedAt: String?
)
