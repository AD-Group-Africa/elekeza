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
        @AuthenticationPrincipal principal: UserDetails,
        @PathVariable quizId: Long,
        @RequestBody submission: AnswerSubmission
    ): ResponseEntity<AnswerResult> {
        val question = questionRepository.findById(submission.questionId).orElseThrow {
            ResponseStatusException(HttpStatus.NOT_FOUND, "Question not found")
        }
        val isCorrect = question.correctOption.equals(submission.selectedOption.trim(), ignoreCase = true)
        return ResponseEntity.ok(AnswerResult(
            correct = isCorrect,
            correctOption = question.correctOption,
            explanation = question.explanation
        ))
    }

    // GET /api/quiz/{quizId}/complete — Finalise quiz
    @GetMapping("/{quizId}/complete")
    fun completeQuiz(
        @AuthenticationPrincipal principal: UserDetails,
        @PathVariable quizId: Long
    ): ResponseEntity<QuizResult> {
        val userId = resolveUserId(principal)
        val result = quizService.completeQuiz(quizId, userId)
        return ResponseEntity.ok(result)
    }
}