package com.elekeza.backend.guardian

import com.elekeza.backend.learner.*
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.*

@RestController
@RequestMapping("/api/guardian")
class GuardianController(
    private val guardianRepo: GuardianRepository,
    private val lessonProgressRepo: LessonProgressRepository
) {
    @GetMapping("/wards")
    fun getWards(): ResponseEntity<List<WardDto>> {
        val guardianId = 3L
        val links = guardianRepo.findAllByLearnerId(java.util.UUID.randomUUID())
        val wards = links.map { link ->
            val completed = lessonProgressRepo.countByUserIdAndCompleted(1L, true)
            val avgScore = lessonProgressRepo.avgQuizScore(1L)
            WardDto(link.fullName, completed.toInt(), avgScore)
        }
        return ResponseEntity.ok(wards)
    }
}

data class WardDto(val name: String, val completedLessons: Int, val lastQuizScore: Double?)
