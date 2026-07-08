package com.elekeza.backend.quiz

import com.elekeza.backend.auth.User
import com.elekeza.backend.auth.UserRepository
import com.elekeza.backend.common.ai.AiClient
import com.elekeza.backend.learner.LessonProgress
import com.elekeza.backend.learner.LessonProgressRepository
import com.elekeza.backend.learner.LearnerProfileRepository
import com.elekeza.backend.learner.SneType
import com.fasterxml.jackson.databind.ObjectMapper
import org.slf4j.LoggerFactory
import org.springframework.http.ResponseEntity
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.web.bind.annotation.*
import java.time.Instant

@RestController
@RequestMapping("/api/quiz")
class QuizController(
    private val quizRepo: QuizRepository,
    private val quizQuestionRepo: QuizQuestionRepository,
    private val quizAttemptRepo: QuizAttemptRepository,
    private val lessonProgressRepo: LessonProgressRepository,
    private val userRepo: UserRepository,
    private val learnerProfileRepo: LearnerProfileRepository,
    private val aiClient: AiClient,
    private val objectMapper: ObjectMapper
) {
    private val log = LoggerFactory.getLogger(javaClass)

    @GetMapping("/{lessonId}/start")
    fun startQuiz(@PathVariable lessonId: Long, @AuthenticationPrincipal user: User): ResponseEntity<Map<String, Any>> {
        val quiz = quizRepo.findByLessonId(lessonId) ?: run {
            log.info("No quiz found for lesson {}, auto-generating...", lessonId)
            // Auto-generate quiz from lesson content (simplified)
            val generated = generateQuizFromLesson(lessonId, user)
            return@startQuiz generated
        }

        val questions = quizQuestionRepo.findByQuizId(quiz.id).map { q ->
            mapOf(
                "id" to q.id.toString(),
                "questionText" to q.questionText,
                "options" to listOf(q.optionA, q.optionB, q.optionC, q.optionD)
                // NEVER RETURN correctOptionId
            )
        }

        // Create a pending attempt
        val attempt = quizAttemptRepo.save(QuizAttempt(
            quizId = quiz.id,
            userId = user.id,
            startedAt = Instant.now()
        ))

        return ResponseEntity.ok(mapOf(
            "quizId" to quiz.id,
            "attemptId" to attempt.id,
            "questions" to questions
        ))
    }

    @PostMapping("/{quizId}/answer")
    fun submitAnswer(
        @PathVariable quizId: Long,
        @RequestBody body: AnswerRequest,
        @AuthenticationPrincipal user: User
    ): ResponseEntity<Map<String, Any>> {
        val attempt = quizAttemptRepo.findById(body.attemptId).orElseThrow()
        require(attempt.userId == user.id) { "Attempt does not belong to user" }

        val question = quizQuestionRepo.findById(body.questionId).orElseThrow()
        val isCorrect = (body.selectedOptionId == question.correctOptionId)

        // Persist answer
        attempt.answers = (attempt.answers ?: emptyMap()) + (question.id.toString() to body.selectedOptionId)
        attempt.lastQuestionIndex = body.currentIndex
        quizAttemptRepo.save(attempt)

        // AI adaptive feedback
        var feedback = ""
        try {
            val profile = learnerProfileRepo.findByUserId(user.id)
            val sneType = profile?.sneType ?: SneType.NONE
            val response = if (isCorrect) {
                aiClient.adaptiveResponse(sneType.name, question.questionText, body.selectedOptionId, true)
            } else {
                aiClient.wrongAnswerFlow(sneType.name, question.questionText, body.selectedOptionId, question.correctOptionId)
            }
            feedback = response ?: ""
        } catch (e: Exception) {
            log.warn("AI feedback failed, using fallback", e)
            feedback = if (isCorrect) "Correct!" else "Not quite. The correct answer was saved."
        }

        return ResponseEntity.ok(mapOf(
            "isCorrect" to isCorrect,
            "feedback" to feedback,
            "nextIndex" to (body.currentIndex + 1)
        ))
    }

    @PostMapping("/{quizId}/complete")
    fun completeQuiz(
        @PathVariable quizId: Long,
        @RequestBody body: CompleteRequest,
        @AuthenticationPrincipal user: User
    ): ResponseEntity<Map<String, Any>> {
        val attempt = quizAttemptRepo.findById(body.attemptId).orElseThrow()
        require(attempt.userId == user.id) { "Attempt does not belong to user" }

        val questions = quizQuestionRepo.findByQuizId(quizId)
        var correctCount = 0
        val answers = attempt.answers ?: emptyMap()

        questions.forEach { q ->
            val selected = answers[q.id.toString()]
            if (selected == q.correctOptionId) correctCount++
        }

        val score = if (questions.isNotEmpty()) (correctCount * 100) / questions.size else 0

        attempt.completedAt = Instant.now()
        attempt.score = score
        quizAttemptRepo.save(attempt)

        // Update lesson progress
        val quiz = quizRepo.findById(quizId).orElseThrow()
        val lessonProgress = lessonProgressRepo.findByUserIdAndContentId(user.id, quiz.lessonId)
        if (lessonProgress != null) {
            lessonProgress.quizScore = score
            lessonProgress.completed = true
            lessonProgress.completedAt = Instant.now()
            lessonProgressRepo.save(lessonProgress)
        }

        return ResponseEntity.ok(mapOf(
            "score" to score,
            "correct" to correctCount,
            "total" to questions.size
        ))
    }

    private fun generateQuizFromLesson(lessonId: Long, user: User): ResponseEntity<Map<String, Any>> {
        // Stub: create a basic quiz with placeholder questions
        val quiz = quizRepo.save(Quiz(lessonId = lessonId, title = "Auto Quiz"))
        listOf(
            QuizQuestion(quizId = quiz.id, questionText = "Placeholder question 1?", optionA = "A", optionB = "B", optionC = "C", optionD = "D", correctOptionId = "A"),
            QuizQuestion(quizId = quiz.id, questionText = "Placeholder question 2?", optionA = "A", optionB = "B", optionC = "C", optionD = "D", correctOptionId = "B")
        ).forEach { quizQuestionRepo.save(it) }

        val questions = quizQuestionRepo.findByQuizId(quiz.id).map { q ->
            mapOf("id" to q.id.toString(), "questionText" to q.questionText, "options" to listOf(q.optionA, q.optionB, q.optionC, q.optionD))
        }
        val attempt = quizAttemptRepo.save(QuizAttempt(quizId = quiz.id, userId = user.id, startedAt = Instant.now()))
        return ResponseEntity.ok(mapOf("quizId" to quiz.id, "attemptId" to attempt.id, "questions" to questions))
    }
}

data class AnswerRequest(val attemptId: Long, val questionId: Long, val selectedOptionId: String, val currentIndex: Int)
data class CompleteRequest(val attemptId: Long)
