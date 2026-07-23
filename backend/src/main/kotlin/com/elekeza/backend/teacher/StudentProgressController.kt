package com.elekeza.backend.teacher

import com.elekeza.backend.auth.User
import org.springframework.http.ResponseEntity
import org.springframework.security.access.prepost.PreAuthorize
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.web.bind.annotation.*

data class StudentProgressDto(
    val studentId: String,
    val studentName: String,
    val completedLessons: Int,
    val averageScore: Double
)

@RestController
@RequestMapping("/api/teacher")
class StudentProgressController {

    @GetMapping("/student/progress")
    @PreAuthorize("hasAnyRole('TEACHER', 'ADMIN', 'SCHOOL_ADMIN')")
    fun getStudentProgress(@AuthenticationPrincipal teacher: User): ResponseEntity<List<StudentProgressDto>> {
        // Replace with real data query later
        return ResponseEntity.ok(emptyList())
    }
}
