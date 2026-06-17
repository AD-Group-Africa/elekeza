package com.elekeza.teacher

import org.springframework.http.ResponseEntity
import org.springframework.security.access.prepost.PreAuthorize
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.web.bind.annotation.*
import com.elekeza.user.User

@RestController
@RequestMapping("/api/teacher")
@PreAuthorize("hasAnyRole('TEACHER', 'ADMIN', 'SCHOOL_ADMIN')")
class TeacherController(
    private val teacherService: TeacherService,
) {
    @PostMapping("/content/assign")
    fun assignContent(
        @AuthenticationPrincipal teacher: User,
        @RequestBody request: TeacherService.AssignContentRequest,
    ): ResponseEntity<Map<String, Any>> {
        val count = teacherService.assignContent(teacher.id, request)
        return ResponseEntity.ok(mapOf("assigned" to count))
    }

    @GetMapping("/students")
    fun getStudents(
        @AuthenticationPrincipal teacher: User,
    ): ResponseEntity<List<TeacherService.StudentProgress>> {
        return ResponseEntity.ok(teacherService.getStudents(teacher.id))
    }
}
