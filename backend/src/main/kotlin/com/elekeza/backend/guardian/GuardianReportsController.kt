package com.elekeza.backend.guardian

import com.elekeza.backend.auth.User
import com.elekeza.backend.auth.UserRepository
import com.elekeza.backend.institution.GuardianLinkRepository
import com.elekeza.backend.learner.LessonProgressRepository
import org.springframework.http.ResponseEntity
import org.springframework.security.access.prepost.PreAuthorize
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.web.bind.annotation.*
import java.time.LocalDate

@RestController
@RequestMapping("/api/guardian")
class GuardianReportsController(
    private val guardianLinkRepo: GuardianLinkRepository,
    private val userRepo: UserRepository,
    private val lessonProgressRepo: LessonProgressRepository,
) {

    /**
     * One progress report per ward, built from real lesson-progress data.
     * The `title`/`date` fields match what the guardian reports page renders.
     */
    @GetMapping("/reports")
    @PreAuthorize("hasAnyRole('GUARDIAN', 'ADMIN')")
    fun getReports(@AuthenticationPrincipal guardian: User): ResponseEntity<List<Map<String, Any>>> {
        val links = guardianLinkRepo.findAll().filter { it.guardianId == guardian.id }
        val reports = links.mapNotNull { link ->
            val learner = userRepo.findById(link.learnerId).orElse(null) ?: return@mapNotNull null
            val progress = lessonProgressRepo.findByUserIdOrderByCreatedAtDesc(learner.id)
            val completed = progress.filter { it.completed }
            val avgScore = if (completed.isNotEmpty()) completed.mapNotNull { it.quizScore }.average() else 0.0
            val lastActive = progress.firstOrNull()?.completedAt

            mapOf<String, Any>(
                "id" to learner.id,
                "title" to "Progress report — ${learner.name}",
                "date" to (lastActive?.toLocalDate()?.toString() ?: LocalDate.now().toString()),
                "wardName" to learner.name,
                "lessonsCompleted" to completed.size,
                "lessonsPending" to (progress.size - completed.size),
                "averageScore" to avgScore,
            )
        }
        return ResponseEntity.ok(reports)
    }
}
