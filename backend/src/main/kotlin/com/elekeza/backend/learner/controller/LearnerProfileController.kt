package com.elekeza.backend.learner.controller

import com.elekeza.backend.auth.User
import com.elekeza.backend.auth.UserRepository
import com.elekeza.backend.learner.*
import org.slf4j.LoggerFactory
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.security.core.userdetails.UserDetails
import org.springframework.web.bind.annotation.*
import org.springframework.web.server.ResponseStatusException
import java.time.LocalDate
import java.time.LocalDateTime

data class UpdateProfileRequest(val sneType: String? = null, val preferences: Map<String, Any>? = null)
data class CompleteProgressRequest(val quizScore: Double? = null)

data class LearnerProfileDto(val id: Long, val userId: Long, val sneType: String?, val preferences: Map<String, Any>, val createdAt: LocalDateTime, val updatedAt: LocalDateTime)
data class LessonProgressDto(val id: Long, val userId: Long, val contentId: Long, val quizScore: Double?, val completed: Boolean, val completedAt: LocalDateTime?, val createdAt: LocalDateTime)
data class LearnerStatsDto(val lessonsCompleted: Long, val avgQuizScore: Double?, val recentActivity: Int, val streak: Int, val lastActive: LocalDate?)

fun LearnerProfile.toDto() = LearnerProfileDto(id, userId, sneType?.name, preferences, createdAt, updatedAt)
fun LessonProgress.toDto() = LessonProgressDto(id, user.id, contentId, quizScore, completed, completedAt, createdAt)

@RestController
@RequestMapping("/api/learner")
class LearnerProfileController(
    private val profileRepository:  LearnerProfileRepository,
    private val progressRepository: LessonProgressRepository,
    private val userRepository:     UserRepository
) {
    private val log = LoggerFactory.getLogger(LearnerProfileController::class.java)

    private fun resolveUser(principal: UserDetails): User =
        userRepository.findByEmail(principal.username)
            ?: throw ResponseStatusException(HttpStatus.UNAUTHORIZED, "User not found")

    @GetMapping("/profile")
    fun getProfile(@AuthenticationPrincipal principal: UserDetails): ResponseEntity<LearnerProfileDto> {
        val user    = resolveUser(principal)
        val profile = profileRepository.findByUserId(user.id) ?: LearnerProfile(user = user)
        return ResponseEntity.ok(profile.toDto())
    }

    @PutMapping("/profile")
    fun updateProfile(@AuthenticationPrincipal principal: UserDetails, @RequestBody req: UpdateProfileRequest): ResponseEntity<LearnerProfileDto> {
        val user     = resolveUser(principal)
        val existing = profileRepository.findByUserId(user.id)
        val updated  = if (existing != null) {
            existing.copy(updatedAt = LocalDateTime.now())
        } else {
            LearnerProfile(user = user, preferences = req.preferences ?: emptyMap())
        }
        return ResponseEntity.ok(profileRepository.save(updated).toDto())
    }

    @GetMapping("/progress")
    fun getProgress(@AuthenticationPrincipal principal: UserDetails): ResponseEntity<List<LessonProgressDto>> {
        val user = resolveUser(principal)
        return ResponseEntity.ok(progressRepository.findByUserIdOrderByCreatedAtDesc(user.id).map { it.toDto() })
    }

    @PostMapping("/progress/{contentId}")
    fun recordProgress(
        @AuthenticationPrincipal principal: UserDetails,
        @PathVariable contentId: Long,
        @RequestBody req: CompleteProgressRequest
    ): ResponseEntity<LessonProgressDto> {
        val user     = resolveUser(principal)
        val existing = progressRepository.findByUserIdAndContentId(user.id, contentId)
        val record   = (existing ?: LessonProgress(user = user, contentId = contentId)).copy(
            quizScore   = req.quizScore ?: existing?.quizScore,
            completed   = true,
            completedAt = LocalDateTime.now()
        )
        return ResponseEntity.ok(progressRepository.save(record).toDto())
    }

    @GetMapping("/stats")
    fun getStats(@AuthenticationPrincipal principal: UserDetails): ResponseEntity<LearnerStatsDto> {
        val user             = resolveUser(principal)
        val lessonsCompleted = progressRepository.countByUserIdAndCompleted(user.id, true)
        val avgScore         = progressRepository.avgQuizScore(user.id)
        val recentActivity   = progressRepository.findRecentActivity(user.id, LocalDateTime.now().minusDays(7)).size
        val allProgress      = progressRepository.findByUserIdAndCompleted(user.id, true).sortedByDescending { it.completedAt }
        val streak           = calculateStreak(allProgress)
        val lastActive       = allProgress.firstOrNull()?.completedAt?.toLocalDate()
        return ResponseEntity.ok(LearnerStatsDto(lessonsCompleted, avgScore?.let { Math.round(it * 1000) / 1000.0 }, recentActivity, streak, lastActive))
    }

    private fun calculateStreak(progress: List<LessonProgress>): Int {
        if (progress.isEmpty()) return 0
        val dates   = progress.mapNotNull { it.completedAt?.toLocalDate() }.toSortedSet(compareByDescending { it }).toList()
        var streak  = 0
        var current = LocalDate.now()
        for (date in dates) {
            if (date == current || date == current.minusDays(1)) { streak++; current = date } else break
        }
        return streak
    }
}