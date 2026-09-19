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
import com.elekeza.backend.notification.NotificationService
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.security.access.prepost.PreAuthorize
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.security.crypto.password.PasswordEncoder
import org.springframework.web.bind.annotation.*
import org.springframework.web.server.ResponseStatusException

@RestController
@RequestMapping("/api/teacher")
class TeacherController(
    private val userRepo: UserRepository,
    private val learnerProfileRepo: LearnerProfileRepository,
    private val lessonProgressRepo: LessonProgressRepository,
    private val contentRepo: ContentRepository,
    private val guardianLinkRepo: GuardianLinkRepository,
    private val passwordEncoder: PasswordEncoder,
    private val notificationService: NotificationService,
) {
    data class StudentDto(val id: String, val name: String, val email: String, val sneType: String)
    data class CreateStudentRequest(val email: String, val fullName: String, val password: String, val sneType: String)
    data class AssignContentRequest(val contentId: Long, val studentIds: List<Long>)
    data class LinkGuardianRequest(val studentId: Long, val guardianEmail: String, val relationship: String = "PARENT")

    @GetMapping("/students")
    fun getStudents(@AuthenticationPrincipal teacher: User): ResponseEntity<List<StudentDto>> {
        val institutionId = teacher.institutionId ?: return ResponseEntity.ok(emptyList())
        val students = userRepo.findByInstitutionIdAndRole(institutionId, UserRole.STUDENT)
        // Surface the learner's real SNE profile so teachers see who needs which
        // support — hardcoded "NONE" hid Elekeza's core differentiation story.
        val sneByUser = learnerProfileRepo.findByUserIdIn(students.map { it.id })
            .associate { it.userId to (it.sneType?.name ?: "NONE") }
        val dtos = students.map { s -> StudentDto(s.id.toString(), s.name, s.email, sneByUser[s.id] ?: "NONE") }
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
        if (teacher.institutionId == null) throw SecurityException("Teacher has no institution")
        val content = contentRepo.findById(req.contentId)
            .orElseThrow { ResponseStatusException(HttpStatus.NOT_FOUND, "Content not found") }
        if (teacher.role != UserRole.ADMIN && content.userId != teacher.id) {
            throw SecurityException("Content is not owned by this teacher")
        }
        // Deduplicate accidental re-assignments: an existing LessonProgress row
        // for the same (student, content) is an idempotent no-op, not a duplicate.
        var assigned = 0
        req.studentIds.toSet().forEach { studentId ->
            val student = userRepo.findById(studentId)
                .orElseThrow { ResponseStatusException(HttpStatus.NOT_FOUND, "Student not found") }
            if (student.role != UserRole.STUDENT || student.institutionId != teacher.institutionId) {
                throw SecurityException("Student not in your institution")
            }
            if (lessonProgressRepo.findByUserIdAndContentId(student.id, content.id) != null) return@forEach
            lessonProgressRepo.save(LessonProgress(user = student, contentId = content.id))
            notificationService.notifyStudentOnAssignment(student.id, content.id)
            assigned++
        }
        return ResponseEntity.ok(mapOf("assigned" to assigned))
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
        if (teacher.role != UserRole.ADMIN && (teacher.institutionId == null || student.institutionId != teacher.institutionId)) {
            throw SecurityException("Student not in your institution")
        }
        val completed = lessonProgressRepo.countByUserIdAndCompleted(studentId, true)
        val avgScore = lessonProgressRepo.avgQuizScore(studentId)
        return ResponseEntity.ok(mapOf("studentName" to student.name, "completedLessons" to completed, "averageScore" to (avgScore ?: 0.0)))
    }
}
