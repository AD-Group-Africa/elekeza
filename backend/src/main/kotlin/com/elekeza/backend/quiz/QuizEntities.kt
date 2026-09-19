package com.elekeza.backend.quiz

import jakarta.persistence.*
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param
import org.springframework.stereotype.Repository
import java.time.LocalDateTime

// ── Entities ──────────────────────────────────────────────────────────────────

@Entity
@Table(name = "quizzes", indexes = [
    Index(name = "idx_quiz_content", columnList = "content_id"),
    Index(name = "idx_quiz_user",    columnList = "user_id")
])
data class Quiz(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,
    @Column(name = "content_id", nullable = false) val contentId: Long,
    @Column(name = "user_id",    nullable = false) val userId:    Long,
    @Column(name = "created_at") val createdAt: LocalDateTime = LocalDateTime.now()
)

@Entity
@Table(name = "quiz_questions", indexes = [
    Index(name = "idx_quiz_question_quiz", columnList = "quiz_id")
])
data class QuizQuestion(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) val id: Long = 0,
    @Column(name = "quiz_id", nullable = false)  val quizId:   Long,
    @Column(columnDefinition = "TEXT", nullable = false) val question: String,
    @Column(name = "option_a", columnDefinition = "TEXT") val optionA: String = "",
    @Column(name = "option_b", columnDefinition = "TEXT") val optionB: String = "",
    @Column(name = "option_c", columnDefinition = "TEXT") val optionC: String = "",
    @Column(name = "option_d", columnDefinition = "TEXT") val optionD: String = "",
    @Column(name = "correct_option", length = 1) val correctOption: String = "A",
    @Column(columnDefinition = "TEXT") val explanation: String? = null
)

@Entity
@Table(name = "quiz_attempts", indexes = [
    Index(name = "idx_quiz_attempt_quiz", columnList = "quiz_id"),
    Index(name = "idx_quiz_attempt_user", columnList = "user_id")
])
data class QuizAttempt(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) val id: Long = 0,
    @Column(name = "quiz_id", nullable = false) val quizId:    Long,
    @Column(name = "user_id", nullable = false) val userId:    Long,
    @Column val score:          Double?       = null,
    @Column(name = "total_questions") val totalQuestions: Int = 0,
    @Column val completed:      Boolean       = false,
    @Column(name = "created_at")   val createdAt:   LocalDateTime = LocalDateTime.now(),
    @Column(name = "completed_at") val completedAt: LocalDateTime? = null
)

@Entity
@Table(name = "quiz_answers", indexes = [
    Index(name = "idx_quiz_answer_attempt", columnList = "attempt_id"),
    Index(name = "idx_quiz_answer_question", columnList = "question_id")
])
data class QuizAnswer(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) val id: Long = 0,
    @Column(name = "attempt_id",  nullable = false) val attemptId:     Long,
    @Column(name = "question_id", nullable = false) val questionId:    Long,
    @Column(name = "selected_option", length = 1)   val selectedOption: String,
    @Column(name = "is_correct", nullable = false)  val isCorrect:     Boolean,
    @Column(name = "answered_at")                   val answeredAt:    LocalDateTime = LocalDateTime.now()
)

// ── Repositories ──────────────────────────────────────────────────────────────

@Repository
interface QuizRepository : JpaRepository<Quiz, Long> {
    fun findByContentId(contentId: Long): Quiz?
    fun findByContentIdAndUserId(contentId: Long, userId: Long): Quiz?
    fun findByContentIdIn(contentIds: Collection<Long>): List<Quiz>
}

@Repository
interface QuizQuestionRepository : JpaRepository<QuizQuestion, Long> {
    fun findByQuizId(quizId: Long): List<QuizQuestion>
}

@Repository
interface QuizAttemptRepository : JpaRepository<QuizAttempt, Long> {
    fun findByQuizIdAndUserId(quizId: Long, userId: Long): List<QuizAttempt>

    @Query("SELECT COUNT(a) FROM QuizAttempt a WHERE a.userId = :userId AND a.completed = :completed")
    fun countByUserIdAndCompleted(@Param("userId") userId: Long, @Param("completed") completed: Boolean): Long

    fun findByUserIdIn(ids: Collection<Long>): List<QuizAttempt>

    fun findByUserIdInAndCompletedFalse(ids: Collection<Long>): List<QuizAttempt>
}

@Repository
interface QuizAnswerRepository : JpaRepository<QuizAnswer, Long> {
    fun findByAttemptId(attemptId: Long): List<QuizAnswer>
    fun findByAttemptIdAndQuestionId(attemptId: Long, questionId: Long): QuizAnswer?
    fun findByAttemptIdIn(attemptIds: Collection<Long>): List<QuizAnswer>
}

// ── DTOs ──────────────────────────────────────────────────────────────────────

data class QuizDto(
    val quizId:    Long,
    val lessonId:  Long,
    val questions: List<QuizQuestionDto>
)

data class QuizQuestionDto(
    val questionId: Long,
    val question:   String,
    val options:    Map<String, String>
)

data class AnswerSubmission(
    val questionId:     Long,
    val selectedOption: String
)

data class AnswerResult(
    val correct:       Boolean,
    val correctOption: String,
    val explanation:   String?
)

data class QuizFeedbackItem(
    val questionId:    Long,
    val correct:       Boolean,
    val correctOption: String,
    val explanation:   String?
)

data class QuizResult(
    val quizId:         Long,
    val score:          Double,
    val totalQuestions: Int,
    val feedback:       List<QuizFeedbackItem>
)

// Legacy aliases (used by some older controller code)
typealias QuizSubmission = AnswerSubmission


