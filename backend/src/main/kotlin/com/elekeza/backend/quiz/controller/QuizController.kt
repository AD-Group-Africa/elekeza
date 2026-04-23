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
    private val quizService:    QuizService,
    private val quizRepository: QuizRepository,
    private val userRepository: UserRepository
) {
    private fun resolveUserId(principal: UserDetails): Long =
        userRepository.findByEmail(principal.username)?.id
            ?: throw ResponseStatusException(HttpStatus.UNAUTHORIZED, "User not found")

    @PostMapping("/generate/{contentId}")
    fun generate(@AuthenticationPrincipal p: UserDetails, @PathVariable contentId: Long): ResponseEntity<QuizDto> {
        val userId = resolveUserId(p)
        val quiz   = quizService.generateQuiz(contentId, userId)
        return ResponseEntity.status(201).body(
            QuizDto(quizId = quiz.quizId, lessonId = quiz.lessonId, questions = quiz.questions)
        )
    }

    @GetMapping("/{quizId}")
    fun getQuiz(@AuthenticationPrincipal p: UserDetails, @PathVariable quizId: Long): ResponseEntity<QuizDto> {
        val quiz      = quizRepository.findById(quizId).orElseThrow { ResponseStatusException(HttpStatus.NOT_FOUND, "Quiz not found") }
        val questions = emptyList<QuizQuestionDto>()
        return ResponseEntity.ok(QuizDto(quizId = quiz.id, lessonId = quiz.contentId, questions = questions))
    }

    @PostMapping("/{quizId}/submit")
    fun submit(@AuthenticationPrincipal p: UserDetails, @PathVariable quizId: Long, @RequestBody submission: AnswerSubmission): ResponseEntity<QuizResult> {
        val userId = resolveUserId(p)
        return ResponseEntity.ok(quizService.submitQuiz(quizId, userId, submission))
    }
}