package com.elekeza.backend.guardian

import com.elekeza.backend.auth.User
import org.springframework.http.ResponseEntity
import org.springframework.security.access.prepost.PreAuthorize
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.web.bind.annotation.*

@RestController
@RequestMapping("/api/guardian")
@PreAuthorize("hasRole('GUARDIAN')")
class GuardianWardDetailController {

    @GetMapping("/wards/{id}")
    fun getWardDetail(
        @AuthenticationPrincipal guardian: User,
        @PathVariable id: Long
    ): ResponseEntity<Map<String, Any>> {
        // Return structured mock details for the ward with the specified id
        val mockData = mapOf(
            "id" to id,
            "name" to "Juma Ali",
            "sneType" to "DYSLEXIA",
            "lessonsCompleted" to 12,
            "lessonsPending" to 3,
            "averageScore" to 84.5,
            "lastActive" to "2026-07-24T14:30:00Z",
            "recentQuizzes" to mapOf(
                "Lesson 1: Water Cycle" to 80.0,
                "Lesson 2: Plant Nutrition" to 90.0,
                "Lesson 3: Solar System" to 85.0
            ),
            "progressHistory" to mapOf(
                "2026-07-20" to 75.0,
                "2026-07-22" to 82.0,
                "2026-07-24" to 84.5
            )
        )
        return ResponseEntity.ok(mockData)
    }
}
