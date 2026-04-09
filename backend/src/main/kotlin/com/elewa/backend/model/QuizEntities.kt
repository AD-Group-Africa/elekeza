package com.elewa.backend.model

import jakarta.persistence.*
import java.math.BigDecimal
import java.time.Instant
import java.util.UUID

@Entity
@Table(name = "quizzes")
class Quiz {

    @Id
    val id: UUID = UUID.randomUUID()

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "lesson_id", nullable = false)
    lateinit var lesson: Lesson

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "learner_id", nullable = false)
    lateinit var learner: Learner

    @Column(name = "score_percentage", precision = 5, scale = 2)
    var scorePercentage: BigDecimal? = null

    @Column(name = "correct_count")
    var correctCount: Int? = null

    @Column(name = "total_questions", nullable = false)
    var totalQuestions: Int = 5

    @Column(name = "summary_message", columnDefinition = "TEXT")
    var summaryMessage: String? = null   // ← nullable

    @Column(name = "completed_at")
    var completedAt: Instant? = null

    @OneToMany(mappedBy = "quiz", cascade = [CascadeType.ALL], fetch = FetchType.LAZY)
    @OrderBy("sequenceNumber ASC")
    var questions: MutableList<QuizQuestion> = mutableListOf()

    @Column(name = "created_at", nullable = false, updatable = false)
    val createdAt: Instant = Instant.now()

    @Column(name = "updated_at", nullable = false)
    var updatedAt: Instant = Instant.now()

    constructor() {}

    constructor(lesson: Lesson, learner: Learner) : this() {
        this.lesson = lesson
        this.learner = learner
    }

    @PreUpdate
    fun preUpdate() {
        updatedAt = Instant.now()
    }
}

@Entity
@Table(name = "quiz_questions")
class QuizQuestion {

    @Id
    val id: UUID = UUID.randomUUID()

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "quiz_id", nullable = false)
    lateinit var quiz: Quiz

    @Column(name = "sequence_number", nullable = false)
    var sequenceNumber: Int = 0

    @Column(name = "question_text", nullable = false, columnDefinition = "TEXT")
    lateinit var questionText: String

    // Stored as JSON string: ["Option A", "Option B", ...]
    @Column(columnDefinition = "jsonb")
    @org.hibernate.annotations.JdbcTypeCode(org.hibernate.type.SqlTypes.JSON)
    var options: String? = null

    @Column(name = "correct_option_id", nullable = false)
    lateinit var correctOptionId: String

    @Column(columnDefinition = "TEXT")
    var explanation: String? = null

    @Column(nullable = false)
    var difficulty: String = "medium"

    @Column(name = "created_at", nullable = false, updatable = false)
    val createdAt: Instant = Instant.now()

    // JPA no-arg constructor
    constructor() {}

    // Convenience constructor
    constructor(quiz: Quiz, sequenceNumber: Int, questionText: String, options: String, correctOptionId: String, explanation: String?) : this() {
        this.quiz = quiz
        this.sequenceNumber = sequenceNumber
        this.questionText = questionText
        this.options = options
        this.correctOptionId = correctOptionId
        this.explanation = explanation
    }
}

@Entity
@Table(name = "quiz_responses")
class QuizResponse {

    @Id
    val id: UUID = UUID.randomUUID()

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "quiz_id", nullable = false)
    lateinit var quiz: Quiz

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "quiz_question_id", nullable = false)
    lateinit var question: QuizQuestion

    @Column(name = "selected_option_id", nullable = false)
    lateinit var selectedOptionId: String

    @Column(name = "is_correct", nullable = false)
    var isCorrect: Boolean = false

    @Column(name = "latency_ms")
    var latencyMs: Int? = null

    @Column
    var directive: String? = null

    @Column(name = "learner_message", columnDefinition = "TEXT")
    var learnerMessage: String? = null

    @Column(name = "created_at", nullable = false, updatable = false)
    val createdAt: Instant = Instant.now()

    // JPA no-arg constructor
    constructor() {}

    // Convenience constructor
    constructor(quiz: Quiz, question: QuizQuestion, selectedOptionId: String, isCorrect: Boolean, latencyMs: Int?, directive: String?, learnerMessage: String?) : this() {
        this.quiz = quiz
        this.question = question
        this.selectedOptionId = selectedOptionId
        this.isCorrect = isCorrect
        this.latencyMs = latencyMs
        this.directive = directive
        this.learnerMessage = learnerMessage
    }
}