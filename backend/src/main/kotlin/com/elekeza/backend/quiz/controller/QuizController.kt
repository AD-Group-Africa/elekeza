package com.elekeza.backend.quiz.controller

import com.elekeza.backend.auth.User
import com.elekeza.backend.auth.UserRepository
import com.elekeza.backend.learner.LessonProgress
import com.elekeza.backend.learner.LessonProgressRepository
import com.elekeza.backend.quiz.*
import org.springframework.http.HttpStatus
import org.springframework.security.core.annotation.AuthenticationPrincipal
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
    fun startQuiz(@PathVariable lessonId: Long, @AuthenticationPrincipal user: User): Map<String, Any> {
        // Auto-create quiz if it doesn't exist
        var quiz = quizRepo.findByContentId(lessonId)
        if (quiz == null) {
            // Create a default quiz for this lesson
            quiz = quizRepo.save(Quiz(contentId = lessonId, userId = user.id))
            // Seed two default questions
            questionRepo.save(QuizQuestion(quizId = quiz.id, question = "What is the main idea of this lesson?", optionA = "Option A", optionB = "Option B", optionC = "Option C", optionD = "Option D", correctOption = "A", explanation = "Review the lesson content"))
            questionRepo.save(QuizQuestion(quizId = quiz.id, question = "What is a key concept from this lesson?", optionA = "Option A", optionB = "Option B", optionC = "Option C", optionD = "Option D", correctOption = "B", explanation = "Check the lesson for details"))
        }
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
    fun submitAnswer(@PathVariable quizId: Long, @RequestBody req: Map<String, Any>, @AuthenticationPrincipal user: User): Map<String, Any> {
        val questionId = (req["questionId"] as? Number)?.toLong()
            ?: throw ResponseStatusException(HttpStatus.BAD_REQUEST, "Missing questionId")
        val selected = req["selectedOptionId"] as? String
            ?: throw ResponseStatusException(HttpStatus.BAD_REQUEST, "Missing selectedOptionId")
        val question = questionRepo.findById(questionId)
            .orElseThrow { ResponseStatusException(HttpStatus.NOT_FOUND, "Question not found") }
        val correct = selected == question.correctOption
        return mapOf("correct" to correct, "correctOption" to question.correctOption, "explanation" to (question.explanation ?: ""))
    }

    @PostMapping("/{quizId}/complete")
    fun completeQuiz(@PathVariable quizId: Long, @AuthenticationPrincipal user: User): Map<String, Any> {
        val quiz = quizRepo.findById(quizId)
            .orElseThrow { ResponseStatusException(HttpStatus.NOT_FOUND, "Quiz not found") }

        // Look up attempts for the authenticated user
        val attempts = attemptRepo.findByQuizIdAndUserId(quizId, user.id)
        val correctCount = attempts?.score?.times(attempts.totalQuestions)?.toInt() ?: 1
        val totalQuestions = attempts?.totalQuestions ?: 2
        val score = if (totalQuestions > 0) (correctCount.toDouble() / totalQuestions) * 100 else 0.0

        // Save progress for the authenticated user
        val existing = progressRepo.findByUserIdAndContentId(user.id, quiz.contentId)
        val progress = existing ?: LessonProgress(user = user, contentId = quiz.contentId)
        progress.quizScore = score
        progress.completed = true
        progressRepo.save(progress)

        return mapOf("score" to score, "correctCount" to correctCount, "totalQuestions" to totalQuestions)
    }
}
