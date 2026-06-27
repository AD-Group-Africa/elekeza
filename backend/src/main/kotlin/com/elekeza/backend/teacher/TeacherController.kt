package com.elekeza.backend.teacher

import com.elekeza.backend.auth.*
import com.elekeza.backend.content.*
import com.elekeza.backend.learner.*
import org.springframework.http.ResponseEntity
import org.springframework.security.crypto.password.PasswordEncoder
import org.springframework.web.bind.annotation.*

@RestController
@RequestMapping("/api/teacher")
class TeacherController(
    private val userRepo: UserRepository,
    private val learnerProfileRepo: LearnerProfileRepository,
    private val lessonProgressRepo: LessonProgressRepository,
    private val contentRepo: ContentRepository,
    private val passwordEncoder: PasswordEncoder
) {
    @GetMapping("/students")
    fun getStudents(): ResponseEntity<List<StudentDto>> {
        val students = userRepo.findAll().filter { it.role == UserRole.STUDENT }
        val dtos = students.map { s ->
            val profile = learnerProfileRepo.findByUserId(s.id)
            StudentDto(s.id.toString(), s.name, profile?.sneType?.name ?: "NONE")
        }
        return ResponseEntity.ok(dtos)
    }

    @PostMapping("/student")
    fun createStudent(@RequestBody req: CreateStudentRequest): ResponseEntity<StudentDto> {
        val student = User(
            name = req.fullName,
            email = req.email,
            password = passwordEncoder.encode(req.password),
            role = UserRole.STUDENT
        )
        userRepo.save(student)
        val profile = LearnerProfile(
            user = student,
            sneType = SneType.valueOf(req.sneType),
            preferences = emptyMap(),
            adaptationState = emptyMap()
        )
        learnerProfileRepo.save(profile)
        return ResponseEntity.ok(StudentDto(student.id.toString(), student.name, req.sneType))
    }

    @PostMapping("/content/assign")
    fun assignContent(@RequestBody req: AssignContentRequest): ResponseEntity<Map<String, String>> {
        req.studentIds.forEach { studentId ->
            val progress = LessonProgress(
                user = userRepo.findById(studentId).orElseThrow(),
                contentId = req.contentId
            )
            lessonProgressRepo.save(progress)
        }
        return ResponseEntity.ok(mapOf("status" to "assigned"))
    }

    @GetMapping("/student/{studentId}/progress")
    fun getStudentProgress(@PathVariable studentId: Long): ResponseEntity<StudentProgressDto> {
        val student = userRepo.findById(studentId).orElseThrow()
        val completed = lessonProgressRepo.countByUserIdAndCompleted(studentId, true)
        val avgScore = lessonProgressRepo.avgQuizScore(studentId)
        return ResponseEntity.ok(StudentProgressDto(student.name, completed.toInt(), avgScore))
    }
}

data class CreateStudentRequest(val email: String, val fullName: String, val password: String, val sneType: String)
data class AssignContentRequest(val contentId: Long, val studentIds: List<Long>)
data class StudentDto(val id: String, val name: String, val sneType: String)
data class StudentProgressDto(val studentName: String, val completedLessons: Int, val lastQuizScore: Double?)
