package com.elekeza.backend.quiz

import com.elekeza.backend.auth.UserRepository
import com.elekeza.backend.learner.LessonProgress
import com.elekeza.backend.learner.LessonProgressRepository
import org.slf4j.LoggerFactory
import org.springframework.http.HttpStatus
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.server.ResponseStatusException
import java.time.LocalDateTime

@Service
class QuizService(
    private val quizRepository:     QuizRepository,
    private val questionRepository: QuizQuestionRepository,
    private val attemptRepository:  QuizAttemptRepository,
    private val progressRepository: LessonProgressRepository,
    private val userRepository:     UserRepository
) {
    private val log = LoggerFactory.getLogger(QuizService::class.java)

    fun generateQuiz(contentId: Long, userId: Long): QuizWithQuestions {
        val quiz = quizRepository.findByContentIdAndUserId(contentId, userId)
            ?: quizRepository.save(Quiz(contentId = contentId, userId = userId))
        val questions = questionRepository.findByQuizId(quiz.id)
        return QuizWithQuestions(
            quizId    = quiz.id,
            lessonId  = contentId,
            questions = questions.map { q ->
                QuizQuestionDto(
                    questionId = q.id,
                    question   = q.question,
                    options    = mapOf("A" to q.optionA, "B" to q.optionB, "C" to q.optionC, "D" to q.optionD)
                )
            }
        )
    }

    // alias used by QuizController
    fun getOrCreateQuiz(contentId: Long, userId: Long) = generateQuiz(contentId, userId)

    fun scoreAnswer(quizId: Long, questionId: Long, selectedOption: String): AnswerResult {
        val question = questionRepository.findById(questionId).orElseThrow {
            ResponseStatusException(HttpStatus.NOT_FOUND, "Question not found")
        }
        return AnswerResult(
            correct       = question.correctOption.equals(selectedOption.trim(), ignoreCase = true),
            correctOption = question.correctOption,
            explanation   = question.explanation
        )
    }

    @Transactional
    fun submitQuiz(quizId: Long, userId: Long, submission: AnswerSubmission): QuizResult {
        return completeQuiz(quizId, userId)
    }

    @Transactional
    fun completeQuiz(quizId: Long, userId: Long): QuizResult {
        val quiz      = quizRepository.findById(quizId).orElseThrow { ResponseStatusException(HttpStatus.NOT_FOUND, "Quiz not found") }
        val questions = questionRepository.findByQuizId(quizId)
        val attempt   = attemptRepository.findByQuizIdAndUserId(quizId, userId)
        val score     = attempt?.score ?: 0.0

        val user     = userRepository.findById(userId).orElseThrow { ResponseStatusException(HttpStatus.NOT_FOUND, "User not found") }
        val existing = progressRepository.findByUserIdAndContentId(user, quiz.contentId)
        val progress = (existing ?: LessonProgress(user = user, contentId = quiz.contentId)).copy(
            quizScore   = score,
            completed   = true,
            completedAt = LocalDateTime.now()
        )
        progressRepository.save(progress)

        return QuizResult(quizId = quizId, score = score, totalQuestions = questions.size, feedback = emptyList())
    }
}

data class QuizWithQuestions(val quizId: Long, val lessonId: Long, val questions: List<QuizQuestionDto>)
