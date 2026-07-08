package com.elekeza.backend.teacher

import com.elekeza.backend.auth.User
import com.elekeza.backend.auth.UserRepository
import com.elekeza.backend.auth.UserRole
import com.elekeza.backend.learner.LearnerProfileRepository
import com.elekeza.backend.learner.LessonProgressRepository
import com.elekeza.backend.content.ContentRepository
import org.springframework.http.ResponseEntity
import org.springframework.security.access.prepost.PreAuthorize
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.security.crypto.password.PasswordEncoder
import org.springframework.web.bind.annotation.*

@RestController
@RequestMapping("/api/teacher")
@PreAuthorize("hasAnyRole('TEACHER', 'ADMIN', 'SCHOOL_ADMIN')")
class TeacherController(
    private val userRepo: UserRepository,
    private val learnerProfileRepo: LearnerProfileRepository,
    private val lessonProgressRepo: LessonProgressRepository,
    private val contentRepo: ContentRepository,
    private val passwordEncoder: PasswordEncoder
) {
    data class StudentDto(val id: String, val name: String, val email: String, val sneType: String)
    data class CreateStudentRequest(val email: String, val fullName: String, val password: String, val sneType: String)
    data class AssignContentRequest(val contentId: Long, val studentIds: List<Long>)

    @GetMapping("/students")
    fun getStudents(@AuthenticationPrincipal teacher: User): ResponseEntity<List<StudentDto>> {
        val institutionId = teacher.institutionId ?: return ResponseEntity.ok(emptyList())
        val students = userRepo.findByInstitutionIdAndRole(institutionId, UserRole.STUDENT)
        val dtos = students.map { s ->
            val profile = learnerProfileRepo.findByUserId(s.id)
            StudentDto(s.id.toString(), s.name, s.email, profile?.sneType?.name ?: "NONE")
        }
        return ResponseEntity.ok(dtos)
    }

    @PostMapping("/student")
    fun createStudent(@AuthenticationPrincipal teacher: User, @RequestBody req: CreateStudentRequest): ResponseEntity<StudentDto> {
        val institutionId = teacher.institutionId ?: throw IllegalStateException("Teacher not linked to an institution")
        val student = userRepo.save(User(
            email = req.email,
            name = req.fullName,
            password = passwordEncoder.encode(req.password),
            role = UserRole.STUDENT,
            institutionId = institutionId
        ))
        val sneType = try { com.elekeza.backend.auth.SneType.valueOf(req.sneType) } catch (e: Exception) { com.elekeza.backend.auth.SneType.NONE }
        learnerProfileRepo.save(com.elekeza.backend.learner.LearnerProfile(
            user = student,
            sneType = sneType,
            preferences = emptyMap(),
            adaptationState = emptyMap()
        ))
        return ResponseEntity.ok(StudentDto(student.id.toString(), student.name, student.email, sneType.name))
    }

    @PostMapping("/content/assign")
    fun assignContent(@AuthenticationPrincipal teacher: User, @RequestBody req: AssignContentRequest): ResponseEntity<Map<String, Any>> {
        req.studentIds.forEach { studentId ->
            val student = userRepo.findById(studentId).orElseThrow { IllegalArgumentException("Student not found") }
            if (student.institutionId != teacher.institutionId) throw SecurityException("Student not in your institution")
            lessonProgressRepo.save(com.elekeza.backend.learner.LessonProgress(
                user = student,
                contentId = req.contentId
            ))
        }
        return ResponseEntity.ok(mapOf("assigned" to req.studentIds.size))
    }

    @GetMapping("/student/{studentId}/progress")
    fun getStudentProgress(@AuthenticationPrincipal teacher: User, @PathVariable studentId: Long): ResponseEntity<Map<String, Any>> {
        val student = userRepo.findById(studentId).orElseThrow()
        if (student.institutionId != teacher.institutionId) throw SecurityException("Cross-institution access denied")
        val completed = lessonProgressRepo.countByUserIdAndCompleted(studentId, true)
        val avgScore = lessonProgressRepo.avgQuizScore(studentId)
        return ResponseEntity.ok(mapOf("studentName" to student.name, "completedLessons" to completed, "averageScore" to (avgScore ?: 0.0)))
    } {
        val student = userRepo.findById(studentId).orElseThrow()
        val completed = lessonProgressRepo.countByUserIdAndCompleted(studentId, true)
        val avgScore = lessonProgressRepo.avgQuizScore(studentId)
        return ResponseEntity.ok(mapOf("studentName" to student.name, "completedLessons" to completed, "averageScore" to (avgScore ?: 0.0)))
    }
}


