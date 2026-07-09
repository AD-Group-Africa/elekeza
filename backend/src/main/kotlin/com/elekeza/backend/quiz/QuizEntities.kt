package com.elekeza.backend.quiz

import jakarta.persistence.*
import org.springframework.data.jpa.repository.JpaRepository
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

// ── Repositories ──────────────────────────────────────────────────────────────

@Repository
interface QuizRepository : JpaRepository<Quiz, Long> {
    fun findByContentId(contentId: Long): Quiz?
    fun findByContentIdAndUserId(contentId: Long, userId: Long): Quiz?
}

@Repository
interface QuizQuestionRepository : JpaRepository<QuizQuestion, Long> {
    fun findByQuizId(quizId: Long): List<QuizQuestion>
}

@Repository
interface QuizAttemptRepository : JpaRepository<QuizAttempt, Long> {
    fun findByQuizIdAndUserId(quizId: Long, userId: Long): List<QuizAttempt>
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


