package com.elekeza.backend.teacher

import com.elekeza.backend.auth.User
import com.elekeza.backend.auth.UserRepository
import com.elekeza.backend.auth.UserRole
import com.elekeza.backend.learner.LearnerProfileRepository
import com.elekeza.backend.learner.LessonProgressRepository
import com.elekeza.backend.content.ContentRepository
import com.elekeza.backend.institution.GuardianLink
import com.elekeza.backend.institution.GuardianLinkRepository
import com.elekeza.backend.learner.LessonProgress
import org.springframework.http.ResponseEntity
import org.springframework.security.access.prepost.PreAuthorize
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.security.crypto.password.PasswordEncoder
import org.springframework.web.bind.annotation.*

@RestController
@RequestMapping("/api/teacher")
class TeacherController(
    private val userRepo: UserRepository,
    private val learnerProfileRepo: LearnerProfileRepository,
    private val lessonProgressRepo: LessonProgressRepository,
    private val contentRepo: ContentRepository,
    private val guardianLinkRepo: GuardianLinkRepository,
    private val passwordEncoder: PasswordEncoder
) {
    data class StudentDto(val id: String, val name: String, val email: String, val sneType: String)
    data class CreateStudentRequest(val email: String, val fullName: String, val password: String, val sneType: String)
    data class AssignContentRequest(val contentId: Long, val studentIds: List<Long>)
    data class LinkGuardianRequest(val studentId: Long, val guardianEmail: String, val relationship: String = "PARENT")

    @GetMapping("/students")
    fun getStudents(@AuthenticationPrincipal teacher: User): ResponseEntity<List<StudentDto>> {
        val institutionId = teacher.institutionId ?: return ResponseEntity.ok(emptyList())
        val students = userRepo.findByInstitutionIdAndRole(institutionId, UserRole.STUDENT)
        val dtos = students.map { s -> StudentDto(s.id.toString(), s.name, s.email, "NONE") }
        return ResponseEntity.ok(dtos)
    }

    @PostMapping("/student")
    fun createStudent(@AuthenticationPrincipal teacher: User, @RequestBody req: CreateStudentRequest): ResponseEntity<StudentDto> {
        val institutionId = teacher.institutionId
        val student = userRepo.save(User(
            email = req.email,
            name = req.fullName,
            password = passwordEncoder.encode(req.password),
            role = UserRole.STUDENT,
            institutionId = institutionId
        ))
        return ResponseEntity.ok(StudentDto(student.id.toString(), student.name, student.email, "NONE"))
    }

    @PostMapping("/content/assign")
    fun assignContent(@AuthenticationPrincipal teacher: User, @RequestBody req: AssignContentRequest): ResponseEntity<Map<String, Any>> {
        req.studentIds.forEach { studentId ->
            val student = userRepo.findById(studentId).orElseThrow { IllegalArgumentException("Student not found") }
            if (student.institutionId != teacher.institutionId) throw SecurityException("Student not in your institution")
            val progress = LessonProgress(user = student, contentId = req.contentId)
            lessonProgressRepo.save(progress)
        }
        return ResponseEntity.ok(mapOf("assigned" to req.studentIds.size))
    }

    @PostMapping("/guardian-link")
    fun linkGuardian(@AuthenticationPrincipal teacher: User, @RequestBody req: LinkGuardianRequest): ResponseEntity<Map<String, Any>> {
        val student = userRepo.findById(req.studentId).orElseThrow { IllegalArgumentException("Student not found") }
        if (student.role != UserRole.STUDENT || student.institutionId != teacher.institutionId) {
            throw SecurityException("Student not in your institution")
        }
        val guardian = userRepo.findByEmail(req.guardianEmail.lowercase().trim())
            ?: throw IllegalArgumentException("Guardian account not found")
        if (guardian.role != UserRole.GUARDIAN) throw IllegalArgumentException("Account is not a guardian")

        val exists = guardianLinkRepo.findAll().any { it.guardianId == guardian.id && it.learnerId == student.id }
        if (!exists) guardianLinkRepo.save(GuardianLink(guardianId = guardian.id, learnerId = student.id, relationship = req.relationship))
        return ResponseEntity.ok(mapOf("linked" to true, "guardianId" to guardian.id, "studentId" to student.id))
    }

    @GetMapping("/student/{studentId}/progress")
    fun getStudentProgress(@AuthenticationPrincipal teacher: User, @PathVariable studentId: Long): ResponseEntity<Map<String, Any>> {
        val student = userRepo.findById(studentId).orElseThrow()
        val completed = lessonProgressRepo.countByUserIdAndCompleted(studentId, true)
        val avgScore = lessonProgressRepo.avgQuizScore(studentId)
        return ResponseEntity.ok(mapOf("studentName" to student.name, "completedLessons" to completed, "averageScore" to (avgScore ?: 0.0)))
    }
}
