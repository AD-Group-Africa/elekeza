package com.elekeza.backend.quiz.controller

import com.elekeza.backend.auth.User
import com.elekeza.backend.common.ai.*
import com.elekeza.backend.content.ContentRepository
import com.elekeza.backend.content.ContentStatus
import com.elekeza.backend.learner.LessonProgress
import com.elekeza.backend.learner.LessonProgressRepository
import com.elekeza.backend.learner.LearnerProfileRepository
import com.elekeza.backend.quiz.*
import com.fasterxml.jackson.databind.ObjectMapper
import org.slf4j.LoggerFactory
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.web.bind.annotation.*
import org.springframework.web.server.ResponseStatusException
import java.time.LocalDateTime

@RestController
@RequestMapping("/api/quiz")
class QuizController(
    private val quizRepository: QuizRepository,
    private val quizQuestionRepository: QuizQuestionRepository,
    private val quizAttemptRepository: QuizAttemptRepository,
    private val contentRepository: ContentRepository,
    private val lessonProgressRepository: LessonProgressRepository,
    private val learnerProfileRepository: LearnerProfileRepository,
    private val aiClient: AiClient,
    private val objectMapper: ObjectMapper
) {
    private val log = LoggerFactory.getLogger(javaClass)

    // ── POST /api/quiz/{lessonId}/start ───────────────────────────────────────
    // Creates or retrieves a quiz for this content and returns the first question.

    @PostMapping("/{lessonId}/start")
    fun startQuiz(
        @PathVariable lessonId: Long,
        @AuthenticationPrincipal user: User
    ): ResponseEntity<QuizStartResponse> {
        val content = contentRepository.findById(lessonId).orElseThrow {
            ResponseStatusException(HttpStatus.NOT_FOUND, "Lesson $lessonId not found")
        }
        if (content.status != ContentStatus.READY) {
            throw ResponseStatusException(HttpStatus.CONFLICT, "Lesson is still being processed")
        }

        // Get or create quiz record for this content
        val quiz = quizRepository.findByContentId(lessonId) ?: run {
            val created = quizRepository.save(Quiz(contentId = lessonId, userId = user.id))
            // Parse quiz questions from simplified_text JSON and persist them
            seedQuestionsFromContent(created.id, content.simplifiedText)
            created
        }

        val questions = quizQuestionRepository.findByQuizId(quiz.id)
        if (questions.isEmpty()) {
            throw ResponseStatusException(HttpStatus.CONFLICT, "No quiz questions available for this lesson")
        }

        // Create attempt record
        val attempt = quizAttemptRepository.save(QuizAttempt(
            quizId         = quiz.id,
            userId         = user.id,
            totalQuestions = questions.size
        ))

        val first = questions.first()
        return ResponseEntity.ok(QuizStartResponse(
            quizId         = quiz.id,
            attemptId      = attempt.id,
            totalQuestions = questions.size,
            firstQuestion  = first.toDto()
        ))
    }

    // ── POST /api/quiz/{quizId}/answer ────────────────────────────────────────
    // Accepts an answer, calls AI for adaptive feedback, returns next question.

    @PostMapping("/{quizId}/answer")
    fun submitAnswer(
        @PathVariable quizId: Long,
        @RequestBody req: AnswerRequest,
        @AuthenticationPrincipal user: User
    ): ResponseEntity<AnswerResponse> {
        val attempt = quizAttemptRepository.findByQuizIdAndUserId(quizId, user.id)
            ?: throw ResponseStatusException(HttpStatus.NOT_FOUND, "Quiz attempt not found")

        if (attempt.completed) {
            throw ResponseStatusException(HttpStatus.CONFLICT, "Quiz already completed")
        }

        val question = quizQuestionRepository.findById(req.questionId).orElseThrow {
            ResponseStatusException(HttpStatus.NOT_FOUND, "Question not found")
        }

        val isCorrect = question.correctOption.equals(req.selectedOption.trim(), ignoreCase = true)

        // Fetch learner's SNE profile for adaptive context
        val profile = learnerProfileRepository.findByUserId(user.id)
        val sneType = profile?.sneType?.name ?: "STANDARD"

        // Call AI for adaptive feedback
        val adaptive = runCatching {
            if (isCorrect) {
                aiClient.adaptiveResponse(AdaptiveResponseRequest(
                    userContext = "SNE:$sneType latency:${req.latencyMs}ms streak:${req.consecutiveCorrect}",
                    query       = question.question
                ))
            } else {
                val wrong = aiClient.wrongAnswerFlow(WrongAnswerFlowRequest(
                    questionId  = req.questionId.toString(),
                    givenAnswer = req.selectedOption
                ))
                AdaptiveResponseJSON(response = "${wrong.feedback} ${wrong.hint}")
            }
        }.onFailure {
            log.warn("Adaptive AI call failed for quizId=$quizId: ${it.message}")
        }.getOrDefault(AdaptiveResponseJSON(
            response = if (isCorrect) "Well done! Keep going." else "Let's review that again."
        ))

        // Load all questions to find next one
        val allQuestions = quizQuestionRepository.findByQuizId(quizId)
        val currentIndex = allQuestions.indexOfFirst { it.id == req.questionId }
        val nextQuestion = allQuestions.getOrNull(currentIndex + 1)

        return ResponseEntity.ok(AnswerResponse(
            isCorrect       = isCorrect,
            correctOption   = question.correctOption,
            explanation     = question.explanation,
            adaptiveMessage = adaptive.response,
            nextQuestion    = nextQuestion?.toDto(),
            quizComplete    = nextQuestion == null
        ))
    }

    // ── POST /api/quiz/{quizId}/complete ──────────────────────────────────────
    // Finalises attempt: saves score, marks lesson_progress complete.

    @PostMapping("/{quizId}/complete")
    fun completeQuiz(
        @PathVariable quizId: Long,
        @RequestBody req: CompleteRequest,
        @AuthenticationPrincipal user: User
    ): ResponseEntity<QuizCompleteResponse> {
        val attempt = quizAttemptRepository.findByQuizIdAndUserId(quizId, user.id)
            ?: throw ResponseStatusException(HttpStatus.NOT_FOUND, "Quiz attempt not found")

        val quiz      = quizRepository.findById(quizId).orElseThrow { ResponseStatusException(HttpStatus.NOT_FOUND, "Quiz not found") }
        val questions = quizQuestionRepository.findByQuizId(quizId)
        val total     = questions.size.coerceAtLeast(1)
        val correct   = req.correctCount.coerceIn(0, total)
        val score     = (correct.toDouble() / total) * 100.0

        // Persist attempt
        val completed = attempt.copy(
            score       = score,
            completed   = true,
            completedAt = LocalDateTime.now()
        )
        quizAttemptRepository.save(completed)

        // Update or create lesson_progress
        val existingProgress = lessonProgressRepository.findByUserIdAndContentId(user.id, quiz.contentId)
        if (existingProgress != null) {
            existingProgress.quizScore  = score
            existingProgress.completed  = true
            existingProgress.completedAt = LocalDateTime.now()
            lessonProgressRepository.save(existingProgress)
        } else {
            lessonProgressRepository.save(LessonProgress(
                user        = attempt.let {
                    // Load User entity — we only need the reference here
                    com.elekeza.backend.auth.User(id = user.id, name = user.name, email = user.email, password = user.password, role = user.role)
                },
                contentId   = quiz.contentId,
                quizScore   = score,
                completed   = true,
                completedAt = LocalDateTime.now()
            ))
        }

        log.info("Quiz $quizId completed by user ${user.id}: $correct/$total = $score%")

        return ResponseEntity.ok(QuizCompleteResponse(
            quizId          = quizId,
            attemptId       = attempt.id,
            scorePercentage = score,
            correctCount    = correct,
            totalQuestions  = total,
            passed          = score >= 60.0,
            summaryMessage  = buildSummaryMessage(score, sneType = learnerProfileRepository.findByUserId(user.id)?.sneType?.name)
        ))
    }

    // ── GET /api/quiz/{quizId}/review ─────────────────────────────────────────

    @GetMapping("/{quizId}/review")
    fun reviewQuiz(
        @PathVariable quizId: Long,
        @AuthenticationPrincipal user: User
    ): ResponseEntity<List<QuizReviewItem>> {
        quizAttemptRepository.findByQuizIdAndUserId(quizId, user.id)
            ?: throw ResponseStatusException(HttpStatus.NOT_FOUND, "Attempt not found")

        val questions = quizQuestionRepository.findByQuizId(quizId)
        val review = questions.map { q -> QuizReviewItem(
            questionId    = q.id,
            questionText  = q.question,
            correctOption = q.correctOption,
            explanation   = q.explanation,
            options       = mapOf("A" to q.optionA, "B" to q.optionB, "C" to q.optionC, "D" to q.optionD)
        )}
        return ResponseEntity.ok(review)
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    private fun seedQuestionsFromContent(quizId: Long, simplifiedText: String?) {
        if (simplifiedText.isNullOrBlank()) return
        runCatching {
            val tree  = objectMapper.readTree(simplifiedText)
            val qNode = tree["quiz"] ?: return
            val toSave = qNode.mapNotNull { q ->
                val options = q["options"]?.toList() ?: return@mapNotNull null
                val (a, b, c, d) = List(4) { i -> options.getOrNull(i)?.get("text")?.asText() ?: "" }
                val correctIdx   = options.indexOfFirst { it["correct"]?.asBoolean() == true }
                val correctLetter = listOf("A","B","C","D").getOrElse(correctIdx) { "A" }
                QuizQuestion(
                    quizId        = quizId,
                    question      = q["question"]?.asText() ?: return@mapNotNull null,
                    optionA       = a, optionB = b, optionC = c, optionD = d,
                    correctOption = correctLetter,
                    explanation   = null
                )
            }
            quizQuestionRepository.saveAll(toSave)
        }.onFailure { log.warn("Failed to seed questions for quiz $quizId: ${it.message}") }
    }

    private fun QuizQuestion.toDto() = QuizQuestionDto(
        questionId = id,
        question   = question,
        options    = mapOf("A" to optionA, "B" to optionB, "C" to optionC, "D" to optionD)
    )

    private fun buildSummaryMessage(score: Double, sneType: String?): String = when {
        score >= 90 -> "Outstanding work! You have mastered this lesson."
        score >= 70 -> "Great job! You have a solid understanding."
        score >= 60 -> "Good effort! Review the highlighted sections to strengthen your understanding."
        else        -> "Keep practising. Every attempt builds your skills."
    }
}

// ── Request / Response DTOs ───────────────────────────────────────────────────

data class AnswerRequest(
    val questionId:        Long,
    val selectedOption:    String,  // "A", "B", "C", or "D"
    val latencyMs:         Long    = 0,
    val consecutiveCorrect: Int    = 0
)

data class CompleteRequest(val correctCount: Int)

data class QuizStartResponse(
    val quizId:         Long,
    val attemptId:      Long,
    val totalQuestions: Int,
    val firstQuestion:  QuizQuestionDto
)

data class AnswerResponse(
    val isCorrect:       Boolean,
    val correctOption:   String,
    val explanation:     String?,
    val adaptiveMessage: String,
    val nextQuestion:    QuizQuestionDto?,
    val quizComplete:    Boolean
)

data class QuizCompleteResponse(
    val quizId:          Long,
    val attemptId:       Long,
    val scorePercentage: Double,
    val correctCount:    Int,
    val totalQuestions:  Int,
    val passed:          Boolean,
    val summaryMessage:  String
)

data class QuizReviewItem(
    val questionId:    Long,
    val questionText:  String,
    val correctOption: String,
    val explanation:   String?,
    val options:       Map<String, String>
)
