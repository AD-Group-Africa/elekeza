package com.elekeza.backend.quiz.controller

import com.elekeza.backend.auth.UserRepository
import com.elekeza.backend.learner.LessonProgress
import com.elekeza.backend.learner.LessonProgressRepository
import com.elekeza.backend.quiz.*
import org.springframework.http.HttpStatus
import org.springframework.web.bind.annotation.*
import org.springframework.web.server.ResponseStatusException

@RestController
@RequestMapping("/api/quiz")
class QuizController(
    private val quizRepo: QuizRepository,
    private val questionRepo: QuizQuestionRepository,
    private val attemptRepo: QuizAttemptRepository,
    private val progressRepo: LessonProgressRepository,
    private val userRepo: UserRepository
) {
    @GetMapping("/{lessonId}/start")
    fun startQuiz(@PathVariable lessonId: Long): Map<String, Any> {
        val quiz = quizRepo.findByContentId(lessonId)
            ?: throw ResponseStatusException(HttpStatus.NOT_FOUND, "No quiz for this lesson")
        val questions = questionRepo.findByQuizId(quiz.id)
        if (questions.isEmpty()) throw ResponseStatusException(HttpStatus.NOT_FOUND, "No questions")
        return mapOf(
            "quizId" to quiz.id,
            "questions" to questions.map { q ->
                mapOf(
                    "id" to q.id,
                    "questionText" to q.question,
                    "options" to listOf(q.optionA, q.optionB, q.optionC, q.optionD),
                    "correctOptionId" to q.correctOption
                )
            }
        )
    }

    @PostMapping("/{quizId}/answer")
    fun submitAnswer(@PathVariable quizId: Long, @RequestBody req: Map<String, Any>): Map<String, Any> {
        val questionId = (req["questionId"] as? Number)?.toLong()
            ?: throw ResponseStatusException(HttpStatus.BAD_REQUEST, "Missing questionId")
        val selected = req["selectedOptionId"] as? String
            ?: throw ResponseStatusException(HttpStatus.BAD_REQUEST, "Missing selectedOptionId")
        val question = questionRepo.findById(questionId)
            .orElseThrow { ResponseStatusException(HttpStatus.NOT_FOUND, "Question not found") }
        val correct = selected == question.correctOption
        return mapOf("correct" to correct, "correctOption" to question.correctOption, "explanation" to (question.explanation ?: ""))
    }

    @GetMapping("/{quizId}/complete")
    fun completeQuiz(@PathVariable quizId: Long): Map<String, Any> {
        val quiz = quizRepo.findById(quizId)
            .orElseThrow { ResponseStatusException(HttpStatus.NOT_FOUND, "Quiz not found") }
        val student = userRepo.findByEmail("student@elekeza.app")
            ?: throw ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Demo student not found")

        val attempts = attemptRepo.findByQuizIdAndUserId(quizId, student.id)
        val correctCount = attempts?.score?.times(attempts.totalQuestions)?.toInt() ?: 1
        val totalQuestions = attempts?.totalQuestions ?: 2
        val score = if (totalQuestions > 0) (correctCount.toDouble() / totalQuestions) * 100 else 0.0

        // Save progress for the demo student
        val existing = progressRepo.findByUserIdAndContentId(student.id, quiz.contentId)
        val progress = existing ?: LessonProgress(user = student, contentId = quiz.contentId)
        progress.quizScore = score
        progress.completed = true
        progressRepo.save(progress)

        return mapOf("score" to score, "correctCount" to correctCount, "totalQuestions" to totalQuestions)
    }
}
