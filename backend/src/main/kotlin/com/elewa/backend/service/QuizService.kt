package com.elewa.backend.service

import com.elewa.backend.dto.*
import com.elewa.backend.model.*
import com.elewa.backend.repository.*
import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.module.kotlin.readValue
import com.fasterxml.jackson.core.type.TypeReference
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.math.BigDecimal
import java.math.RoundingMode
import java.time.Instant
import java.util.UUID

@Service
class QuizService(
    private val quizRepository: QuizRepository,
    private val quizQuestionRepository: QuizQuestionRepository,
    private val quizResponseRepository: QuizResponseRepository,
    private val lessonRepository: LessonRepository,
    private val lessonSectionRepository: LessonSectionRepository,
    private val learnerRepository: LearnerRepository,
    private val aiClient: AiClient,
    private val objectMapper: ObjectMapper
) {

    // ── Quiz Start ────────────────────────────────────────────

    @Transactional
    fun startQuiz(learnerId: UUID, lessonId: UUID): QuizStartResponse {
        val learner = learnerRepository.findById(learnerId)
            .orElseThrow { IllegalArgumentException("Learner not found") }
        val lesson = lessonRepository.findById(lessonId)
            .orElseThrow { IllegalArgumentException("Lesson not found") }
        check(lesson.learner.id == learnerId) { "Access denied" }

        // If there is an existing incomplete quiz for this learner/lesson, return it
        quizRepository.findByLessonIdAndLearnerId(lessonId, learnerId)
            ?.let { existing ->
                if (existing.completedAt == null) {
                    val questions = quizQuestionRepository.findAllByQuizIdOrderBySequenceNumberAsc(existing.id)
                    val answeredIds = quizResponseRepository.findAllByQuizId(existing.id)
                        .map { it.question.id }.toSet()
                    val next = questions.firstOrNull { it.id !in answeredIds }
                        ?: questions.first()
                    return QuizStartResponse(
                        quizId = existing.id,
                        totalQuestions = existing.totalQuestions,
                        firstQuestion = next.toResponse()
                    )
                }
            }

        // Create a new quiz from the stored JSON
        val quiz = Quiz().apply {
            this.lesson = lesson
            this.learner = learner
        }
        quizRepository.save(quiz)

        // FIX 1: removed unused `questionsJson` variable — deserialize directly
        val rawJson = lesson.quizQuestions
            ?: throw IllegalStateException("Lesson has no quiz questions")

        val typeRef = object : TypeReference<List<com.elewa.backend.dto.ai.QuizQuestion>>() {}
        val questionDTOs: List<com.elewa.backend.dto.ai.QuizQuestion> = objectMapper.readValue(rawJson, typeRef)

        val quizQuestions = questionDTOs.mapIndexed { idx, dto ->
            QuizQuestion().apply {
                this.quiz = quiz
                this.sequenceNumber = idx + 1
                this.questionText = dto.question
                this.options = objectMapper.writeValueAsString(dto.options)
                this.correctOptionId = dto.correctIndex.toString()
                this.explanation = dto.explanation
            }
        }
        quizQuestionRepository.saveAll(quizQuestions)

        quiz.totalQuestions = quizQuestions.size
        quizRepository.save(quiz)

        return QuizStartResponse(
            quizId = quiz.id,
            totalQuestions = quiz.totalQuestions,
            firstQuestion = quizQuestions.first().toResponse()
        )
    }

    // ── Submit Answer ─────────────────────────────────────────
    @Transactional
    fun submitAnswer(learnerId: UUID, quizId: UUID, request: AnswerRequest): AnswerResponse {
        // FIX 2: removed unused `learner` lookup — learnerId is only needed for the access check below
        val quiz = quizRepository.findById(quizId)
            .orElseThrow { IllegalArgumentException("Quiz not found") }
        check(quiz.learner.id == learnerId) { "Access denied" }
        check(quiz.completedAt == null) { "Quiz already completed" }

        val question = quizQuestionRepository.findById(request.questionId)
            .orElseThrow { IllegalArgumentException("Question not found") }

        val isCorrect = question.correctOptionId == request.selectedOptionId

        val learnerMessage = if (isCorrect) {
            "Correct! ${question.explanation ?: "Well done!"}"
        } else {
            // FIX 3: options is non-null per entity contract; removed redundant null check
            val options = question.options?.let {
                objectMapper.readValue(it, object : TypeReference<List<String>>() {})
            } ?: emptyList<String>()
            // FIX 3 cont: correctOptionId is non-null — removed redundant != null check and !! operator
            val correctOption = if (options.isNotEmpty()) {
                options[question.correctOptionId.toInt()]
            } else "the correct answer"
            "Incorrect. The correct answer is: $correctOption"
        }

        quizResponseRepository.save(
            QuizResponse().apply {
                this.quiz = quiz
                this.question = question
                this.selectedOptionId = request.selectedOptionId
                this.isCorrect = isCorrect
                this.latencyMs = request.latencyMs
                this.directive = if (isCorrect) "REINFORCE" else "RETEACH"
                this.learnerMessage = learnerMessage
            }
        )

        val allQuestions = quizQuestionRepository.findAllByQuizIdOrderBySequenceNumberAsc(quizId)
        val answeredIds = quizResponseRepository.findAllByQuizId(quizId).map { it.question.id }.toSet()
        val nextQuestion = allQuestions.firstOrNull { it.id !in answeredIds }
        val quizComplete = nextQuestion == null

        return AnswerResponse(
            isCorrect = isCorrect,
            learnerMessage = learnerMessage,
            explanation = if (isCorrect) question.explanation else null,
            directive = if (isCorrect) "REINFORCE" else "RETEACH",
            nextQuestion = nextQuestion?.toResponse(),
            quizComplete = quizComplete
        )
    }

    @Transactional
    fun completeQuiz(learnerId: UUID, quizId: UUID): QuizCompleteResponse {
        val quiz = quizRepository.findById(quizId)
            .orElseThrow { IllegalArgumentException("Quiz not found") }
        check(quiz.learner.id == learnerId) { "Access denied" }

        val responses = quizResponseRepository.findAllByQuizId(quizId)
        val correctCount = responses.count { it.isCorrect }
        val total = quiz.totalQuestions

        val score = if (total > 0) {
            BigDecimal((correctCount.toDouble() / total) * 100).setScale(2, RoundingMode.HALF_UP)
        } else BigDecimal.ZERO

        val summary = when {
            score >= BigDecimal(80) -> "Excellent work! You understood this lesson very well."
            score >= BigDecimal(60) -> "Good effort! You are making great progress."
            score >= BigDecimal(40) -> "Keep going! Reading the lesson again will help."
            else -> "Do not worry — learning takes time. Try the lesson again."
        }

        quiz.apply {
            this.scorePercentage = score
            this.correctCount = correctCount
            this.totalQuestions = total
            this.summaryMessage = summary
            this.completedAt = Instant.now()
        }
        quizRepository.save(quiz)

        return QuizCompleteResponse(
            quizId = quiz.id,
            scorePercentage = score.toDouble(),
            correctCount = correctCount,
            totalQuestions = total,
            summaryMessage = summary
        )
    }

    // ── Mapper ────────────────────────────────────────────────

    private fun QuizQuestion.toResponse(): QuizQuestionResponse {
        val opts = options?.let { objectMapper.readValue<List<QuizOption>>(it) } ?: emptyList()
        return QuizQuestionResponse(
            id = id,
            sequenceNumber = sequenceNumber,
            text = questionText,
            options = opts
        )
    }
}