package com.elekeza.teacher

import com.elekeza.content.ContentRepository
import com.elekeza.content.ContentAssignment
import com.elekeza.content.ContentAssignmentRepository
import com.elekeza.learner.LearnerProfileRepository
import com.elekeza.user.UserRepository
import com.elekeza.user.UserRole
import org.slf4j.LoggerFactory
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

@Service
class TeacherService(
    private val userRepo: UserRepository,
    private val learnerProfileRepo: LearnerProfileRepository,
    private val contentRepo: ContentRepository,
    private val assignmentRepo: ContentAssignmentRepository,
) {
    private val log = LoggerFactory.getLogger(javaClass)

    data class AssignContentRequest(
        val contentId: Long,
        val studentIds: List<Long>,
    )

    data class StudentProgress(
        val userId: Long,
        val firstName: String,
        val lastName: String,
        val sneType: String?,
        val gradeLevel: String?,
        val lessonsCompleted: Int,
        val lessonsAssigned: Int,
        val averageScore: Double?,
        val lastActive: java.time.Instant?,
    )

    @Transactional
    fun assignContent(teacherId: Long, request: AssignContentRequest): Int {
        val content = contentRepo.findById(request.contentId)
            .orElseThrow { IllegalArgumentException("Content not found") }

        var assigned = 0
        request.studentIds.forEach { studentId ->
            val existing = assignmentRepo.findByContentIdAndStudentId(content.id, studentId)
            if (existing == null) {
                assignmentRepo.save(ContentAssignment(
                    contentId = content.id,
                    studentId = studentId,
                    assignedBy = teacherId,
                ))
                assigned++
            }
        }
        log.info("Teacher {} assigned content {} to {} students", teacherId, content.id, assigned)
        return assigned
    }

    fun getStudents(teacherId: Long): List<StudentProgress> {
        // For pilot: return all learners in teacher's institution
        val teacher = userRepo.findById(teacherId)
            .orElseThrow { IllegalArgumentException("Teacher not found") }
        val students = userRepo.findByInstitutionIdAndRole(teacher.institutionId, UserRole.LEARNER)

        return students.map { student ->
            val profile = learnerProfileRepo.findByUserId(student.id)
            val assignments = assignmentRepo.findByStudentId(student.id)
            StudentProgress(
                userId = student.id,
                firstName = student.firstName,
                lastName = student.lastName,
                sneType = profile?.diagnosedConditions?.firstOrNull(),
                gradeLevel = profile?.gradeLevel,
                lessonsCompleted = assignments.count { it.completedAt != null },
                lessonsAssigned = assignments.size,
                averageScore = null, // TODO
                lastActive = null,   // TODO
            )
        }
    }
}