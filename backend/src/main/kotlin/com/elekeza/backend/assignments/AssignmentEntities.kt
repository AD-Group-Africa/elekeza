package com.elekeza.backend.assignments

import com.elekeza.backend.auth.User
import jakarta.persistence.*
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.repository.query.Param
import org.springframework.data.jpa.repository.Query
import org.springframework.stereotype.Repository
import java.time.Instant
import java.time.LocalDate

// ── Entities ──────────────────────────────────────────────────────────────────

@Entity
@Table(name = "assignments", indexes = [
    Index(name = "idx_assignment_institution", columnList = "institution_id"),
    Index(name = "idx_assignment_class", columnList = "class_id"),
    Index(name = "idx_assignment_due", columnList = "due_date")
])
data class Assignment(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,
    @Column(name = "institution_id", nullable = false) val institutionId: Long,
    @Column(name = "class_id", nullable = false) val classId: Long,
    @Column(name = "created_by", nullable = false) val createdBy: Long,
    @Column(nullable = false, length = 200) val title: String,
    @Column(columnDefinition = "TEXT") val instructions: String? = null,
    @Column(name = "due_date") val dueDate: LocalDate? = null,
    @Column(nullable = false) val points: Int = 100,
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20) val status: AssignmentStatus = AssignmentStatus.PUBLISHED,
    @Column(name = "created_at", nullable = false) val createdAt: Instant = Instant.now(),
    @Column(name = "updated_at", nullable = false) val updatedAt: Instant = Instant.now()
)

enum class AssignmentStatus { DRAFT, PUBLISHED, CLOSED }

@Entity
@Table(name = "assignment_submissions", indexes = [
    Index(name = "idx_submission_assignment", columnList = "assignment_id"),
    Index(name = "idx_submission_learner", columnList = "learner_id")
])
data class AssignmentSubmission(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,
    @Column(name = "assignment_id", nullable = false) val assignmentId: Long,
    @Column(name = "learner_id", nullable = false) val learnerId: Long,
    @Column(nullable = false, columnDefinition = "TEXT") val content: String,
    @Column(name = "submitted_at", nullable = false) val submittedAt: Instant = Instant.now(),
    @Column val score: Int? = null,
    @Column(columnDefinition = "VARCHAR(2000)") val feedback: String? = null,
    @Column(name = "graded_by") val gradedBy: Long? = null,
    @Column(name = "graded_at") val gradedAt: Instant? = null,
    @Column(name = "updated_at", nullable = false) val updatedAt: Instant = Instant.now()
)

// ── Repositories ──────────────────────────────────────────────────────────────

@Repository
interface AssignmentRepository : JpaRepository<Assignment, Long> {
    fun findByClassIdInOrderByDueDateDesc(classIds: Collection<Long>): List<Assignment>
    fun findByInstitutionIdAndClassIdOrderByDueDateDesc(institutionId: Long, classId: Long): List<Assignment>
    fun findByInstitutionIdOrderByDueDateDesc(institutionId: Long): List<Assignment>
    fun findByClassIdInAndStatus(classIds: Collection<Long>, status: AssignmentStatus): List<Assignment>
}

@Repository
interface AssignmentSubmissionRepository : JpaRepository<AssignmentSubmission, Long> {
    fun findByAssignmentId(assignmentId: Long): List<AssignmentSubmission>
    fun findByAssignmentIdAndLearnerId(assignmentId: Long, learnerId: Long): AssignmentSubmission?
    fun findByLearnerIdOrderBySubmittedAtDesc(learnerId: Long): List<AssignmentSubmission>
    @Query("select s from AssignmentSubmission s where s.learnerId in :learnerIds")
    fun findByLearnerIds(@Param("learnerIds") learnerIds: Collection<Long>): List<AssignmentSubmission>
}

// ── DTOs ──────────────────────────────────────────────────────────────────────

data class CreateAssignmentRequest(
    val classId: Long,
    val title: String,
    val instructions: String? = null,
    val dueDate: LocalDate? = null,
    val points: Int = 100
)

data class UpdateAssignmentRequest(
    val title: String? = null,
    val instructions: String? = null,
    val dueDate: LocalDate? = null,
    val points: Int? = null,
    val status: String? = null   // DRAFT | PUBLISHED | CLOSED
)

data class AssignmentDto(
    val id: Long,
    val classId: Long,
    val className: String?,
    val title: String,
    val instructions: String?,
    val dueDate: LocalDate?,
    val points: Int,
    val status: String,
    val createdBy: Long,
    val submissionCount: Long = 0,
    val gradedCount: Long = 0
)

data class SubmissionDto(
    val id: Long,
    val assignmentId: Long,
    val learnerId: Long,
    val learnerName: String?,
    val content: String,
    val submittedAt: Instant,
    val score: Int?,
    val feedback: String?,
    val graded: Boolean
)

data class SubmitAssignmentRequest(val content: String)

data class GradeSubmissionRequest(val score: Int, val feedback: String? = null)
