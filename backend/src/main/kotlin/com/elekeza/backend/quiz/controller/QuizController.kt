package com.elekeza.backend.quiz.controller

import com.elekeza.backend.auth.UserRepository
import com.elekeza.backend.quiz.*
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.security.core.userdetails.UserDetails
import org.springframework.web.bind.annotation.*
import org.springframework.web.server.ResponseStatusException

@RestController
@RequestMapping("/api/quiz")
class QuizController(
    private val quizService: QuizService,
    private val quizRepository: QuizRepository,
    private val userRepository: UserRepository
) {
    private fun resolveUserId(principal: UserDetails): Long =
        userRepository.findByEmail(principal.username)?.id
            ?: throw ResponseStatusException(HttpStatus.UNAUTHORIZED, "User not found")

    // GET /api/quiz/{lessonId}/start — Start or resume a quiz
    @GetMapping("/{lessonId}/start")
    fun startQuiz(
        @AuthenticationPrincipal principal: UserDetails,
        @PathVariable lessonId: Long
    ): ResponseEntity<QuizDto> {
        val userId = resolveUserId(principal)
        val quiz = quizService.getOrCreateQuiz(lessonId, userId)
        return ResponseEntity.ok(QuizDto(
            quizId = quiz.quizId,
            lessonId = quiz.lessonId,
            questions = quiz.questions
        ))
    }

    // POST /api/quiz/{quizId}/answer — Submit an answer
    @PostMapping("/{quizId}/answer")
    fun submitAnswer(
        @PathVariable quizId: Long,
        @RequestBody request: AnswerRequest,
        @AuthenticationPrincipal user: User,
    ): ResponseEntity<AnswerResultResponse> {
        val result = quizService.scoreAnswer(quizId, request.questionId, request.answer)

        // NEW: Get adaptive directive
        val adaptive = adaptiveService.getAdaptiveDirective(
            userId = user.id,
            isCorrect = result.isCorrect,
            latencyMs = request.latencyMs,
            currentDifficulty = quizService.getCurrentDifficulty(quizId),
            lessonId = quizService.getLessonIdForQuiz(quizId),
        )

        // Update quiz session difficulty
        quizService.updateDifficulty(quizId, adaptive.adjustedDifficulty)

        return ResponseEntity.ok(
            AnswerResultResponse(
                correct = result.isCorrect,
                correctOption = result.correctOption,
                explanation = result.explanation,
                adaptiveDirective = adaptive.directive,
                adaptiveMessage = adaptive.message,
                nextDifficultyLevel = adaptive.adjustedDifficulty,
            )
        )
    }

    data class AnswerRequest(
        val questionId: Long,
        val answer: String,
        val latencyMs: Long,  // NEW: frontend must send this
    )

    data class AnswerResultResponse(
        val correct: Boolean,
        val correctOption: String?,
        val explanation: String?,
        val adaptiveDirective: String?,
        val adaptiveMessage: String?,
        val nextDifficultyLevel: Int?,
    )