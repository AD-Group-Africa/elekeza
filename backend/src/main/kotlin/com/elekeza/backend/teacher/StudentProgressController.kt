package com.elekeza.backend.teacher

import com.elekeza.backend.auth.User
import com.elekeza.backend.auth.UserRepository
import com.elekeza.backend.auth.UserRole
import com.elekeza.backend.learner.LessonProgress
import com.elekeza.backend.learner.LessonProgressRepository
import com.elekeza.backend.quiz.QuizAttemptRepository
import com.elekeza.backend.quiz.QuizRepository
import org.springframework.http.ResponseEntity
import org.springframework.security.access.prepost.PreAuthorize
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.web.bind.annotation.*

data class StudentProgressDto(
    val studentId: String,
    val studentName: String,
    val assignedLessons: Int,
    val inProgressLessons: Int,
    val completedLessons: Int,
    val averageScore: Double
)

@RestController
@RequestMapping("/api/teacher")
class StudentProgressController(
    private val userRepo: UserRepository,
    private val lessonProgressRepo: LessonProgressRepository,
    private val quizRepo: QuizRepository,
    private val attemptRepo: QuizAttemptRepository
) {

    /**
     * Institution-scoped per-student progress summary built from real
     * LessonProgress + quiz-attempt state (replaces the previous stub).
     * in-progress = an open (started, unfinished) quiz attempt exists.
     */
    @GetMapping("/student/progress")
    @PreAuthorize("hasAnyRole('TEACHER', 'ADMIN', 'SCHOOL_ADMIN')")
    fun getStudentProgress(@AuthenticationPrincipal teacher: User): ResponseEntity<List<StudentProgressDto>> {
        val institutionId = teacher.institutionId
            ?: return ResponseEntity.ok(emptyList())
        val students = userRepo.findByInstitutionIdAndRole(institutionId, UserRole.STUDENT)
        if (students.isEmpty()) return ResponseEntity.ok(emptyList())
        val studentIds = students.map { it.id }

        val allProgress = lessonProgressRepo.findByUserIdIn(studentIds)
        val contentIds = allProgress.map { it.contentId }.distinct()
        val contentByQuizId = quizRepo.findByContentIdIn(contentIds).associate { it.id to it.contentId }
        val openAttempts = attemptRepo.findByUserIdInAndCompletedFalse(studentIds)
        val startedByStudent: Map<Long, Set<Long>> = openAttempts
            .groupBy { it.userId }
            .mapValues { (_, attempts) -> attempts.mapNotNull { contentByQuizId[it.quizId] }.toSet() }

        val byStudent = allProgress.groupBy { it.user.id }
        val dtos = students.map { s ->
            val rows = byStudent[s.id].orEmpty()
            val completed = rows.filter(LessonProgress::completed)
            val inProgress = rows.count { !it.completed && startedByStudent[s.id]?.contains(it.contentId) == true }
            StudentProgressDto(
                studentId = s.id.toString(),
                studentName = s.name,
                assignedLessons = rows.size,
                inProgressLessons = inProgress,
                completedLessons = completed.size,
                averageScore = if (completed.isNotEmpty()) completed.mapNotNull { it.quizScore }.average() else 0.0
            )
        }
        return ResponseEntity.ok(dtos)
    }
}
