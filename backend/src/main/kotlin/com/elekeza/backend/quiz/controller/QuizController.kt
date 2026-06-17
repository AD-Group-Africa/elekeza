package com.elekeza.backend.quiz.controller

import org.springframework.web.bind.annotation.*

@RestController
@RequestMapping("/api/quiz")
class QuizController {

    @GetMapping("/{lessonId}/start")
    fun startQuiz(@PathVariable lessonId: Long): Map<String, Any> {
        return mapOf(
            "questions" to listOf(
                mapOf("id" to "q1", "questionText" to "What makes the water cycle happen?", "options" to listOf("The moon", "The sun", "The wind", "The rain"), "correctOptionId" to "1"),
                mapOf("id" to "q2", "questionText" to "What is evaporation?", "options" to listOf("Condensation", "Evaporation", "Precipitation", "Collection"), "correctOptionId" to "1")
            )
        )
    }

    @PostMapping("/{quizId}/answer")
    fun submitAnswer(@PathVariable quizId: Long): Map<String, Any> {
        return mapOf("correct" to true)
    }

    @GetMapping("/{quizId}/complete")
    fun completeQuiz(@PathVariable quizId: Long): Map<String, Any> {
        return mapOf("score" to 80)
    }
}
