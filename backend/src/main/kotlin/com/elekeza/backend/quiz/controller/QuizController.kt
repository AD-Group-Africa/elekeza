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
        var quiz = quizRepo.findByContentId(lessonId)
        if (quiz == null) {
            quiz = quizRepo.save(Quiz(contentId = lessonId, userId = user.id))
            questionRepo.save(QuizQuestion(quizId = quiz.id, question = "What is the main idea of this lesson?", optionA = "Option A", optionB = "Option B", optionC = "Option C", optionD = "Option D", correctOption = "A", explanation = "Review the lesson content"))
            questionRepo.save(QuizQuestion(quizId = quiz.id, question = "What is a key concept from this lesson?", optionA = "Option A", optionB = "Option B", optionC = "Option C", optionD = "Option D", correctOption = "B", explanation = "Check the lesson for details"))
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
                    // NEVER RETURN correctOption
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
    fun completeQuiz(@PathVariable quizId: Long, @RequestBody answers: List<AnswerSubmission>, @AuthenticationPrincipal user: User): Map<String, Any> {
        val quiz = quizRepo.findById(quizId)
            .orElseThrow { ResponseStatusException(HttpStatus.NOT_FOUND, "Quiz not found") }
        val questions = questionRepo.findByQuizId(quizId)

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

        val totalQuestions = questions.size
        val score = if (totalQuestions > 0) (correctCount.toDouble() / totalQuestions) * 100 else 0.0

        // Update attempt
        val attempt = attemptRepo.findByQuizIdAndUserId(quizId, user.id)
        if (attempt != null) {
            attemptRepo.save(attempt.copy(score = score, totalQuestions = totalQuestions, completed = true))
        }

        // Update lesson progress
        val progress = progressRepo.findByUserIdAndContentId(user.id, quiz.contentId)
            ?: LessonProgress(user = user, contentId = quiz.contentId)
        val updated = progress.copy(quizScore = score, completed = true)
        progressRepo.save(updated)

        return mapOf(
            "score" to score,
            "correctCount" to correctCount,
            "totalQuestions" to totalQuestions,
            "feedback" to feedback.map { mapOf("questionId" to it.questionId, "correct" to it.correct, "correctOption" to it.correctOption, "explanation" to (it.explanation ?: "")) }
        )
    }
}
