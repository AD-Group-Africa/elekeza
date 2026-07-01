package com.elekeza.backend.guardian

import com.elekeza.backend.auth.User
import com.elekeza.backend.auth.UserRepository
import com.elekeza.backend.learner.*
import org.springframework.http.ResponseEntity
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.web.bind.annotation.*

@RestController
@RequestMapping("/api/guardian")
class GuardianController(
    private val guardianRepo: GuardianRepository,
    private val lessonProgressRepo: LessonProgressRepository,
    private val learnerRepo: LearnerRepository,
    private val userRepo: UserRepository
) {
    @GetMapping("/wards")
    fun getWards(@AuthenticationPrincipal user: User): ResponseEntity<List<WardDto>> {
        val guardians = guardianRepo.findAllByEmail(user.email)
        val wards = guardians.mapNotNull { g ->
            val learner = g.learner
            // Learner.email → find the corresponding User (User.id is Long)
            val learnerUser = userRepo.findByEmail(learner.email) ?: return@mapNotNull null
            val completed = lessonProgressRepo.countByUserIdAndCompleted(learnerUser.id, true)
            val avgScore = lessonProgressRepo.avgQuizScore(learnerUser.id)
            WardDto(learnerUser.name, completed.toInt(), avgScore)
        }
        return ResponseEntity.ok(wards)
    }
}

data class WardDto(val name: String, val completedLessons: Int, val lastQuizScore: Double?)
