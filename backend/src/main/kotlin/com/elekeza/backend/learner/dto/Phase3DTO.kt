package com.elekeza.backend.learner.dto

import com.elekeza.backend.common.ai.KeyTermResponse
import com.elekeza.backend.common.ai.SectionResponse
import java.util.UUID

data class UploadResponse(
    val lessonId: UUID,
    val firstSection: SectionResponse,
    val totalSections: Int,
    val keyTerms: List<KeyTermResponse>
)

data class ProgressPatchRequest(val timeSpentSeconds: Int)

data class QuizOption(val id: String, val text: String)

data class QuizStartResponse(val quizId: UUID, val totalQuestions: Int, val firstQuestion: QuizQuestionResponse)

data class QuizQuestionResponse(val id: UUID, val sequenceNumber: Int, val text: String, val options: List<QuizOption>)

data class AnswerRequest(val questionId: UUID, val selectedOptionId: String, val latencyMs: Int = 0)

data class AnswerResponse(
    val isCorrect: Boolean, val learnerMessage: String,
    val explanation: String?, val directive: String?,
    val nextQuestion: QuizQuestionResponse?, val quizComplete: Boolean
)

data class QuizCompleteResponse(
    val quizId: UUID, val scorePercentage: Double,
    val correctCount: Int, val totalQuestions: Int,
    val summaryMessage: String, val failedQuestions: List<FailedQuestionReview> = emptyList()
)

data class FailedQuestionReview(
    val questionId: UUID, val questionText: String,
    val selectedOptionId: String?, val selectedAnswerText: String?,
    val correctOptionId: String, val correctAnswerText: String?
)

data class DashboardResponse(
    val lessonsCompleted: Long,
    val avgQuizScore: Double?,
    val recentLessons: List<Map<String, Any>>,
    val quizHistory: List<Map<String, Any>>
)