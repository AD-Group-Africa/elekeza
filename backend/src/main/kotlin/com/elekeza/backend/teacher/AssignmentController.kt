package com.elekeza.backend.teacher

import com.elekeza.backend.auth.User
import org.springframework.http.ResponseEntity
import org.springframework.security.access.prepost.PreAuthorize
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.web.bind.annotation.*

data class AssignmentDto(
    val id: Long,
    val title: String,
    val dueDate: String?,
    val assignedCount: Int,
    val submittedCount: Int
)

@RestController
@RequestMapping("/api/teacher")
class AssignmentController {

    @GetMapping("/assignments")
    @PreAuthorize("hasAnyRole('TEACHER', 'ADMIN', 'SCHOOL_ADMIN')")
    fun getAssignments(@AuthenticationPrincipal teacher: User): ResponseEntity<List<AssignmentDto>> {
        // For now, return an empty list. Replace with real service call later.
        return ResponseEntity.ok(emptyList())
    }
}
