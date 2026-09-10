package com.elekeza.backend.teacher

import com.elekeza.backend.auth.User
import com.elekeza.backend.auth.UserRepository
import com.elekeza.backend.auth.UserRole
import com.elekeza.backend.content.ContentRepository
import com.elekeza.backend.learner.LessonProgress
import com.elekeza.backend.learner.LessonProgressRepository
import com.elekeza.backend.quiz.QuizAttemptRepository
import com.elekeza.backend.quiz.QuizRepository
import org.springframework.http.ResponseEntity
import org.springframework.security.access.prepost.PreAuthorize
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.web.bind.annotation.*

data class AssignmentDto(
    val id: Long,
    val contentId: Long,
    val lessonTitle: String,
    val studentId: Long,
    val studentName: String,
    val assignedAt: String,
    val status: String,
    val score: Double?
)

@RestController
@RequestMapping("/api/teacher")
class AssignmentController(
    private val userRepo: UserRepository,
    private val lessonProgressRepo: LessonProgressRepository,
    private val contentRepo: ContentRepository,
    private val quizRepo: QuizRepository,
    private val attemptRepo: QuizAttemptRepository
) {

    /**
     * Real, institution-scoped assignment listing. An assignment is a
     * LessonProgress row for one of the teacher's institution students; its
     * status is derived from persisted state only:
     *   - COMPLETED   -> the lesson's quiz was finished (completed=true)
     *   - IN_PROGRESS -> an open (started, unfinished) quiz attempt exists
     *   - ASSIGNED    -> assigned but not yet started
     */
    @GetMapping("/assignments")
    @PreAuthorize("hasAnyRole('TEACHER', 'ADMIN', 'SCHOOL_ADMIN')")
    fun getAssignments(@AuthenticationPrincipal teacher: User): ResponseEntity<List<AssignmentDto>> {
        val institutionId = teacher.institutionId
            ?: return ResponseEntity.ok(emptyList())
        val students = userRepo.findByInstitutionIdAndRole(institutionId, UserRole.STUDENT)
        if (students.isEmpty()) return ResponseEntity.ok(emptyList())
        val studentIds = students.map { it.id }

        val progressRows = lessonProgressRepo.findByUserIdIn(studentIds)
        if (progressRows.isEmpty()) return ResponseEntity.ok(emptyList())

        val studentById = students.associateBy { it.id }
        val contentIds = progressRows.map { it.contentId }.distinct()
        val contentsById = contentRepo.findAllById(contentIds).associateBy { it.id }

        // Which lessons has each student actually started (open quiz attempt)?
        val quizzes = quizRepo.findByContentIdIn(contentIds)
        val contentByQuizId = quizzes.associate { it.id to it.contentId }
        val openAttempts = attemptRepo.findByUserIdInAndCompletedFalse(studentIds)
        val startedByStudent: Map<Long, Set<Long>> = openAttempts
            .groupBy { it.userId }
            .mapValues { (_, attempts) -> attempts.mapNotNull { contentByQuizId[it.quizId] }.toSet() }

        val dtos = progressRows
            .sortedWith(compareByDescending<LessonProgress> { it.createdAt }.thenByDescending { it.contentId })
            .map { p ->
                val student = studentById[p.user.id]
                val title = contentsById[p.contentId]?.title ?: "Lesson ${p.contentId}"
                val status = when {
                    p.completed -> "COMPLETED"
                    startedByStudent[p.user.id]?.contains(p.contentId) == true -> "IN_PROGRESS"
                    else -> "ASSIGNED"
                }
                AssignmentDto(
                    id = p.id,
                    contentId = p.contentId,
                    lessonTitle = title,
                    studentId = p.user.id,
                    studentName = student?.name ?: "Unknown student",
                    assignedAt = p.createdAt.toString(),
                    status = status,
                    score = if (p.completed) p.quizScore else null
                )
            }
        return ResponseEntity.ok(dtos)
    }
}
