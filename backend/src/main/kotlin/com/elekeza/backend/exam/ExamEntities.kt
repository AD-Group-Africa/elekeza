package com.elekeza.backend.exam

import jakarta.persistence.*
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.stereotype.Repository
import java.time.Instant

// ── Entities ──────────────────────────────────────────────────────────────────

enum class ExamStatus { DRAFT, PUBLISHED, CLOSED }
enum class QuestionType { MCQ, TRUE_FALSE, SHORT_ANSWER }
enum class AttemptStatus { IN_PROGRESS, SUBMITTED, TIMED_OUT }

@Entity
@Table(name = "exams", indexes = [
    Index(name = "idx_exam_institution", columnList = "institution_id"),
    Index(name = "idx_exam_status", columnList = "status")
])
data class Exam(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,
    @Column(name = "institution_id", nullable = false) val institutionId: Long,
    @Column(name = "creator_id", nullable = false) val creatorId: Long,
    @Column(nullable = false) val title: String,
    @Column(columnDefinition = "TEXT") val description: String? = null,
    @Column(nullable = false) val subject: String,
    @Column(name = "duration_minutes", nullable = false) val durationMinutes: Int = 30,
    @Column(name = "max_attempts", nullable = false) val maxAttempts: Int = 1,
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20) val status: ExamStatus = ExamStatus.DRAFT,
    @Column(name = "available_from") val availableFrom: Instant? = null,
    @Column(name = "available_until") val availableUntil: Instant? = null,
    @Column(name = "created_at") val createdAt: Instant = Instant.now(),
    @Column(name = "updated_at") val updatedAt: Instant = Instant.now()
) {
    fun isOpenAt(now: Instant): Boolean =
        status == ExamStatus.PUBLISHED &&
            (availableFrom == null || !now.isBefore(availableFrom)) &&
            (availableUntil == null || now.isBefore(availableUntil))
}

@Entity
@Table(name = "exam_questions", indexes = [
    Index(name = "idx_exam_question_exam", columnList = "exam_id")
])
data class ExamQuestion(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,
    @Column(name = "exam_id", nullable = false) val examId: Long,
    @Column(columnDefinition = "TEXT", nullable = false) val question: String,
    @Enumerated(EnumType.STRING)
    @Column(name = "qtype", nullable = false, length = 20) val qtype: QuestionType = QuestionType.MCQ,
    @Column(name = "option_a", columnDefinition = "TEXT") val optionA: String? = null,
    @Column(name = "option_b", columnDefinition = "TEXT") val optionB: String? = null,
    @Column(name = "option_c", columnDefinition = "TEXT") val optionC: String? = null,
    @Column(name = "option_d", columnDefinition = "TEXT") val optionD: String? = null,
    @Column(name = "correct_option", length = 1) val correctOption: String? = null,
    @Column(name = "correct_text", columnDefinition = "TEXT") val correctText: String? = null,
    @Column(nullable = false) val marks: Int = 1,
    @Column(name = "order_index", nullable = false) val orderIndex: Int = 0
)

@Entity
@Table(name = "exam_attempts", indexes = [
    Index(name = "idx_exam_attempt_exam", columnList = "exam_id"),
    Index(name = "idx_exam_attempt_student", columnList = "student_id")
])
data class ExamAttempt(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,
    @Column(name = "exam_id", nullable = false) val examId: Long,
    @Column(name = "student_id", nullable = false) val studentId: Long,
    @Column(name = "started_at", nullable = false) val startedAt: Instant = Instant.now(),
    @Column(name = "expires_at", nullable = false) val expiresAt: Instant,
    @Column(name = "submitted_at") val submittedAt: Instant? = null,
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20) val status: AttemptStatus = AttemptStatus.IN_PROGRESS,
    val score: Double? = null,
    @Column(name = "total_marks", nullable = false) val totalMarks: Int = 0
)

@Entity
@Table(name = "exam_answers", indexes = [
    Index(name = "idx_exam_answer_attempt", columnList = "attempt_id")
])
data class ExamAnswer(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,
    @Column(name = "attempt_id", nullable = false) val attemptId: Long,
    @Column(name = "question_id", nullable = false) val questionId: Long,
    @Column(columnDefinition = "TEXT") val answer: String? = null,
    @Column(name = "saved_at", nullable = false) val savedAt: Instant = Instant.now(),
    @Column(name = "marks_awarded") val marksAwarded: Double? = null,
    @Column(columnDefinition = "TEXT") val feedback: String? = null
)

@Entity
@Table(name = "exam_integrity_events", indexes = [
    Index(name = "idx_exam_integrity_attempt", columnList = "attempt_id")
])
data class ExamIntegrityEvent(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,
    @Column(name = "attempt_id", nullable = false) val attemptId: Long,
    @Column(name = "event_type", nullable = false, length = 50) val eventType: String,
    @Column(name = "occurred_at", nullable = false) val occurredAt: Instant = Instant.now(),
    @Column(length = 255) val detail: String? = null
)

// ── Repositories ──────────────────────────────────────────────────────────────

@Repository
interface ExamRepository : JpaRepository<Exam, Long> {
    fun findByInstitutionIdOrderByCreatedAtDesc(institutionId: Long): List<Exam>
    fun findByInstitutionIdAndStatus(institutionId: Long, status: ExamStatus): List<Exam>
}

@Repository
interface ExamQuestionRepository : JpaRepository<ExamQuestion, Long> {
    fun findByExamIdOrderByOrderIndexAscIdAsc(examId: Long): List<ExamQuestion>
    fun deleteByExamId(examId: Long)
}

@Repository
interface ExamAttemptRepository : JpaRepository<ExamAttempt, Long> {
    fun findByExamIdAndStudentId(examId: Long, studentId: Long): List<ExamAttempt>
    fun findByExamIdInOrderByStartedAtDesc(examIds: Collection<Long>): List<ExamAttempt>
    fun findByStudentIdOrderByStartedAtDesc(studentId: Long): List<ExamAttempt>
}

@Repository
interface ExamAnswerRepository : JpaRepository<ExamAnswer, Long> {
    fun findByAttemptId(attemptId: Long): List<ExamAnswer>
    fun findByAttemptIdAndQuestionId(attemptId: Long, questionId: Long): ExamAnswer?
    fun findByAttemptIdIn(attemptIds: Collection<Long>): List<ExamAnswer>
}

@Repository
interface ExamIntegrityEventRepository : JpaRepository<ExamIntegrityEvent, Long> {
    fun findByAttemptIdOrderByOccurredAtAsc(attemptId: Long): List<ExamIntegrityEvent>
}

// ── DTOs ──────────────────────────────────────────────────────────────────────

data class ExamQuestionIn(
    val question: String,
    val qtype: String = "MCQ",                 // MCQ | TRUE_FALSE | SHORT_ANSWER
    val options: List<String> = emptyList(),   // used for MCQ (2-4 entries)
    val correctOption: String? = null,         // "A".."D" or "A"/"B" for TRUE_FALSE
    val correctText: String? = null,           // for SHORT_ANSWER
    val marks: Int = 1
)

data class CreateExamRequest(
    val title: String,
    val description: String? = null,
    val subject: String,
    val durationMinutes: Int = 30,
    val maxAttempts: Int = 1,
    val availableFrom: String? = null,
    val availableUntil: String? = null,
    val questions: List<ExamQuestionIn> = emptyList()
)

data class UpdateExamRequest(
    val title: String? = null,
    val description: String? = null,
    val subject: String? = null,
    val durationMinutes: Int? = null,
    val maxAttempts: Int? = null,
    val availableFrom: String? = null,
    val availableUntil: String? = null,
    val questions: List<ExamQuestionIn>? = null   // full replacement when present
)

data class ExamSummaryDto(
    val id: Long,
    val title: String,
    val subject: String,
    val description: String?,
    val durationMinutes: Int,
    val maxAttempts: Int,
    val status: String,
    val availableFrom: Instant?,
    val availableUntil: Instant?,
    val questionCount: Int,
    val totalMarks: Int,
    val createdAt: Instant
)

data class ExamQuestionOut(
    val id: Long,
    val question: String,
    val qtype: String,
    val options: List<String?>,
    val marks: Int,
    val orderIndex: Int
)

data class ExamDetailDto(
    val id: Long,
    val title: String,
    val description: String?,
    val subject: String,
    val durationMinutes: Int,
    val maxAttempts: Int,
    val status: String,
    val availableFrom: Instant?,
    val availableUntil: Instant?,
    val questions: List<ExamQuestionOut>
)

data class AttemptDto(
    val id: Long,
    val examId: Long,
    val examTitle: String,
    val status: String,
    val startedAt: Instant,
    val expiresAt: Instant,
    val submittedAt: Instant?,
    val score: Double?,
    val totalMarks: Int,
    val remainingSeconds: Long
)

data class StartAttemptResponse(
    val attemptId: Long,
    val examId: Long,
    val expiresAt: Instant,
    val remainingSeconds: Long,
    val questions: List<ExamQuestionOut>,
    val savedAnswers: Map<Long, String>
)

data class SaveAnswerRequest(val questionId: Long, val answer: String?)

data class SubmitExamRequest(val answers: List<SaveAnswerRequest> = emptyList())

data class IntegrityEventRequest(val eventType: String, val detail: String? = null)

data class MarkShortAnswerRequest(
    val questionId: Long,
    val marksAwarded: Double,
    val feedback: String? = null
)

data class ExamResultDto(
    val attemptId: Long,
    val examId: Long,
    val examTitle: String,
    val studentId: Long,
    val studentName: String,
    val status: String,
    val score: Double?,
    val totalMarks: Int,
    val submittedAt: Instant?,
    val breakdown: List<QuestionResultDto> = emptyList()
)

data class QuestionResultDto(
    val questionId: Long,
    val question: String,
    val qtype: String,
    val studentAnswer: String?,
    val correct: Boolean?,
    val marksAwarded: Double?,
    val marksPossible: Int,
    val correctAnswer: String?,
    val feedback: String? = null
)
