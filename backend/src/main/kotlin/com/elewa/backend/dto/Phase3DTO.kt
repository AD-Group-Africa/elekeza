package com.elewa.backend.dto

import java.util.UUID

// ── Content Upload ────────────────────────────────────────────────────────────

data class UploadResponse(
    val lessonId: UUID,
    val firstSection: SectionResponse,
    val totalSections: Int,
    val keyTerms: List<KeyTermResponse>
)

data class ProgressPatchRequest(
    val timeSpentSeconds: Int
)

// ── Quiz ──────────────────────────────────────────────────────────────────────

data class QuizOption(
    val id: String,
    val text: String
)

data class QuizStartResponse(
    val quizId: UUID,
    val totalQuestions: Int,
    val firstQuestion: QuizQuestionResponse
)

data class QuizQuestionResponse(
    val id: UUID,
    val sequenceNumber: Int,
    val text: String,
    val options: List<QuizOption>
)

data class AnswerRequest(
    val questionId: UUID,
    val selectedOptionId: String,
    val latencyMs: Int = 0
)

data class AnswerResponse(
    val isCorrect: Boolean,
    val learnerMessage: String,
    val explanation: String?,
    val directive: String?,
    val nextQuestion: QuizQuestionResponse?,
    val quizComplete: Boolean
)

data class QuizCompleteResponse(
    val quizId: UUID,
    val scorePercentage: Double,
    val correctCount: Int,
    val totalQuestions: Int,
    val summaryMessage: String
)

// ── Dashboard ─────────────────────────────────────────────────────────────────

data class RecentLessonSummary(
    val lessonId: UUID,
    val title: String,
    val estimatedMinutes: Int,
    val createdAt: String
)

data class QuizHistoryItem(
    val quizId: UUID,
    val lessonTitle: String,
    val scorePercentage: Double,
    val completedAt: String?
)

data class DashboardResponse(
    val lessonsCompleted: Long,
    val avgQuizScore: Double?,
    val recentLessons: List<RecentLessonSummary>,
    val quizHistory: List<QuizHistoryItem>
)