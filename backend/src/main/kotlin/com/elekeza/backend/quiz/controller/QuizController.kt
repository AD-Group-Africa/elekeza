package com.elekeza.backend.quiz.controller

import com.elekeza.backend.auth.User
import com.elekeza.backend.auth.UserRepository
import com.elekeza.backend.auth.UserRole
import com.elekeza.backend.common.ai.AdaptiveResponseRequest
import com.elekeza.backend.common.ai.AiClient
import com.elekeza.backend.common.ai.LearnerContext
import com.elekeza.backend.content.Content
import com.elekeza.backend.content.ContentAccessGuard
import com.elekeza.backend.content.ContentRepository
import com.elekeza.backend.learner.LearnerProfileRepository
import com.elekeza.backend.learner.LessonProgress
import com.elekeza.backend.learner.LessonProgressRepository
import com.elekeza.backend.quiz.*
import org.springframework.http.HttpStatus
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.bind.annotation.*
import org.springframework.web.server.ResponseStatusException
import java.time.LocalDateTime

@RestController
@RequestMapping("/api/quiz")
class QuizController(
    private val quizRepo: QuizRepository,
    private val questionRepo: QuizQuestionRepository,
    private val attemptRepo: QuizAttemptRepository,
    private val answerRepo: QuizAnswerRepository,
    private val progressRepo: LessonProgressRepository,
    private val userRepo: UserRepository,
    private val contentRepo: ContentRepository,
    private val learnerProfileRepo: LearnerProfileRepository,
    private val aiClient: AiClient,
    private val aiQuizParser: AiQuizParser,
    private val notificationService: com.elekeza.backend.notification.NotificationService,
    private val contentAccessGuard: ContentAccessGuard
) {
    // Keep GET for the existing lesson page and accept POST for API clients.
    @RequestMapping("/{lessonId}/start", method = [RequestMethod.GET, RequestMethod.POST])
    fun startQuiz(@PathVariable lessonId: Long, @AuthenticationPrincipal user: User): Map<String, Any> {
        val content = contentRepo.findById(lessonId)
            .orElseThrow { ResponseStatusException(HttpStatus.NOT_FOUND, "Lesson not found") }
        // A learner may only start a quiz for content they can access.
        contentAccessGuard.requireAccess(user, content)

        var quiz = quizRepo.findByContentId(lessonId)
        if (quiz == null) {
            quiz = quizRepo.save(Quiz(contentId = lessonId, userId = user.id))
            val parsed = aiQuizParser.parse(content.simplifiedText)
            if (parsed != null) {
                // Real AI questions — never substitute placeholders when the
                // stored quiz section exists but is broken/empty.
                questionRepo.saveAll(parsed.map { p ->
                    QuizQuestion(
                        quizId = quiz.id,
                        question = p.question,
                        optionA = p.optionA,
                        optionB = p.optionB,
                        optionC = p.optionC,
                        optionD = p.optionD,
                        correctOption = p.correctOption,
                        explanation = p.explanation
                    )
                })
            } else {
                // No stored AI quiz at all — placeholder fallback.
                questionRepo.save(QuizQuestion(quizId = quiz.id, question = "What is the main idea of this lesson?", optionA = "Option A", optionB = "Option B", optionC = "Option C", optionD = "Option D", correctOption = "A", explanation = "Review the lesson content"))
                questionRepo.save(QuizQuestion(quizId = quiz.id, question = "What is a key concept from this lesson?", optionA = "Option A", optionB = "Option B", optionC = "Option C", optionD = "Option D", correctOption = "B", explanation = "Check the lesson for details"))
            }
        }
        val questions = questionRepo.findByQuizId(quiz.id)
        if (questions.isEmpty()) throw ResponseStatusException(HttpStatus.NOT_FOUND, "No questions")

        // Create a pending attempt
        val attempt = attemptRepo.save(QuizAttempt(quizId = quiz.id, userId = user.id, totalQuestions = questions.size))

        return mapOf(
            "quizId" to quiz.id,
            "attemptId" to attempt.id,
            "questions" to questions.map { q ->
                mapOf(
                    "id" to q.id,
                    "questionText" to q.question,
                    "options" to listOf(q.optionA, q.optionB, q.optionC, q.optionD)
                    // NEVER RETURN correctOption or explanation here
                )
            }
        )
    }

    @PostMapping("/{quizId}/answer")
    fun submitAnswer(@PathVariable quizId: Long, @RequestBody req: Map<String, Any>, @AuthenticationPrincipal user: User): Map<String, Any> {
        val questionId = (req["questionId"] as? Number)?.toLong()
            ?: throw ResponseStatusException(HttpStatus.BAD_REQUEST, "Missing questionId")
        val selected = (req["selectedOptionId"] as? String)?.trim()
            ?: throw ResponseStatusException(HttpStatus.BAD_REQUEST, "Missing selectedOptionId")
        val latencyMs = (req["latencyMs"] as? Number)?.toInt() ?: 0

        // The question must belong to the quiz named in the path — question IDs
        // cannot be used to reach questions from another quiz.
        val question = questionRepo.findById(questionId)
            .orElseThrow { ResponseStatusException(HttpStatus.NOT_FOUND, "Question not found") }
        if (question.quizId != quizId)
            throw ResponseStatusException(HttpStatus.FORBIDDEN, "Question does not belong to this quiz")

        // The user may only answer a quiz they have started themselves (a
        // pending attempt of their own must exist).
        val attempts = attemptRepo.findByQuizIdAndUserId(quizId, user.id)
        val attempt = attempts.firstOrNull { !it.completed }
            ?: throw ResponseStatusException(HttpStatus.FORBIDDEN, "No active quiz attempt — start the quiz first")

        // Correctness is determined server-side only — the correct option and
        // explanation are never returned to the client while answering.
        val correct = selected.equals(question.correctOption, ignoreCase = true)

        // Persist the per-question answer (idempotent) so post-quiz review
        // can be served without re-sending the answer key while answering.
        if (answerRepo.findByAttemptIdAndQuestionId(attempt.id, question.id) == null) {
            answerRepo.save(QuizAnswer(
                attemptId = attempt.id,
                questionId = question.id,
                selectedOption = selected.uppercase(),
                isCorrect = correct
            ))
        }

        // Best-effort adaptive AI feedback (exact FastAPI AdaptiveResponseRequest
        // contract). selected_option follows the AI service's fixture convention
        // (the option text, not the letter). Never exposes the answer key — only
        // learner_message/directive. Degrades gracefully when the AI service is
        // unavailable.
        val selectedOptionText = when (selected.uppercase()) {
            "A" -> question.optionA
            "B" -> question.optionB
            "C" -> question.optionC
            "D" -> question.optionD
            else -> selected
        }.ifBlank { selected }
        val adaptive = runCatching {
            val context = LearnerContext.fromSneType(user.id, learnerProfileRepo.findByUserId(user.id)?.sneType?.name)
            aiClient.adaptiveResponse(AdaptiveResponseRequest(
                learnerContext = context,
                question = question.question,
                selectedOption = selectedOptionText,
                isCorrect = correct,
                latencyMs = latencyMs
            ))
        }.getOrNull()

        return buildMap {
            put("correct", correct)
            adaptive?.let { a ->
                put("learnerMessage", a.learnerMessage)
                put("directive", a.directive)
            }
        }
    }

    @PostMapping("/{quizId}/complete")
    @Transactional
    fun completeQuiz(@PathVariable quizId: Long, @RequestBody answers: List<AnswerSubmission>, @AuthenticationPrincipal user: User): Map<String, Any> {
        val quiz = quizRepo.findById(quizId)
            .orElseThrow { ResponseStatusException(HttpStatus.NOT_FOUND, "Quiz not found") }
        val questions = questionRepo.findByQuizId(quizId)

        // A user may only complete a quiz they have started (a pending attempt exists).
        val attempts = attemptRepo.findByQuizIdAndUserId(quizId, user.id)
        val latest = attempts.maxByOrNull { it.createdAt }
            ?: throw ResponseStatusException(HttpStatus.BAD_REQUEST, "No quiz attempt found — start the quiz before submitting answers")

        var correctCount = 0
        val feedback = mutableListOf<QuizFeedbackItem>()

        answers.forEach { submission ->
            val question = questions.find { it.id == submission.questionId }
            if (question != null) {
                val isCorrect = submission.selectedOption == question.correctOption
                if (isCorrect) correctCount++
                feedback.add(QuizFeedbackItem(
                    questionId = question.id,
                    correct = isCorrect,
                    correctOption = question.correctOption,
                    explanation = question.explanation
                ))
            }
        }

        // Persist any submitted answers that were not recorded via /answer
        // (keeps clients that submit everything at once consistent).
        answers.forEach { submission ->
            val q = questions.find { it.id == submission.questionId } ?: return@forEach
            if (answerRepo.findByAttemptIdAndQuestionId(latest.id, q.id) == null) {
                val isCorrect = submission.selectedOption == q.correctOption
                answerRepo.save(QuizAnswer(
                    attemptId = latest.id,
                    questionId = q.id,
                    selectedOption = submission.selectedOption.uppercase(),
                    isCorrect = isCorrect
                ))
            }
        }

        val totalQuestions = questions.size
        val score = if (totalQuestions > 0) (correctCount.toDouble() / totalQuestions) * 100 else 0.0

        // Update the latest attempt (handles multiple starts on same quiz)
        attemptRepo.save(latest.copy(score = score, totalQuestions = totalQuestions, completed = true, completedAt = LocalDateTime.now()))

        // Notify linked guardians about the completed quiz (async, best-effort).
        try {
            notificationService.notifyGuardianOnQuizComplete(user.id, quiz.contentId, score)
        } catch (e: Exception) {
            // Notification must never break the completion flow.
        }

        // Update lesson progress (mutate managed entity)
        val managedUser = userRepo.findById(user.id).orElseThrow()
        val existingProgress = progressRepo.findByUserIdAndContentId(user.id, quiz.contentId)
        if (existingProgress != null) {
            existingProgress.quizScore = score
            existingProgress.completed = true
            existingProgress.completedAt = LocalDateTime.now()
            progressRepo.save(existingProgress)
        } else {
            progressRepo.save(LessonProgress(
                user = managedUser,
                contentId = quiz.contentId,
                quizScore = score,
                completed = true,
                completedAt = LocalDateTime.now()
            ))
        }

        return mapOf(
            "score" to score,
            "correctCount" to correctCount,
            "totalQuestions" to totalQuestions,
            "feedback" to feedback.map { mapOf("questionId" to it.questionId, "correct" to it.correct, "correctOption" to it.correctOption, "explanation" to (it.explanation ?: "")) }
        )
    }

    /**
     * Post-quiz review. Requires the caller to own a completed attempt on this
     * quiz, so the answer key can only be seen after the learner has finished.
     * Returns per-question user answers from the persisted quiz_answers rows.
     */
    @GetMapping("/{quizId}/review")
    fun reviewQuiz(@PathVariable quizId: Long, @AuthenticationPrincipal user: User): Map<String, Any> {
        val quiz = quizRepo.findById(quizId)
            .orElseThrow { ResponseStatusException(HttpStatus.NOT_FOUND, "Quiz not found") }
        val attempts = attemptRepo.findByQuizIdAndUserId(quizId, user.id)
        val completed = attempts.filter { it.completed }.maxByOrNull { it.completedAt ?: it.createdAt }
            ?: throw ResponseStatusException(HttpStatus.FORBIDDEN, "Complete the quiz before reviewing answers")

        val questions = questionRepo.findByQuizId(quizId)
        val answers = answerRepo.findByAttemptId(completed.id).associateBy { it.questionId }
        val review = questions.map { q ->
            val a = answers[q.id]
            mapOf<String, Any>(
                "questionId" to q.id,
                "question" to q.question,
                "userAnswer" to (a?.selectedOption ?: "—"),
                "correctAnswer" to q.correctOption,
                "correct" to (a?.isCorrect ?: false),
                "explanation" to (q.explanation ?: "")
            )
        }
        return mapOf(
            "quizId" to quizId,
            "score" to (completed.score ?: 0.0),
            "totalQuestions" to questions.size,
            "questions" to review
        )
    }

}
