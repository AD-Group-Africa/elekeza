package com.elekeza.backend.quiz.controller

import com.elekeza.backend.auth.UserRepository
import com.elekeza.backend.quiz.*
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.*
import org.springframework.web.server.ResponseStatusException

@RestController
@RequestMapping("/api/quiz")
class QuizController(
    private val quizService: QuizService
) {
    @GetMapping("/{lessonId}/start")
    fun startQuiz(@PathVariable lessonId: Long) = quizService.startQuiz(lessonId)

    @PostMapping("/{quizId}/answer")
    fun submitAnswer(@PathVariable quizId: Long, @RequestBody req: AnswerRequest) =
        quizService.submitAnswer(quizId, req)

    @GetMapping("/{quizId}/complete")
    fun completeQuiz(@PathVariable quizId: Long) = quizService.completeQuiz(quizId)
}
