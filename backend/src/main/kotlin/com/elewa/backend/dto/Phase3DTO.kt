package com.elewa.backend.dto

import java.util.UUID

// ── AI Internal Types (FastAPI contract) ──────────────────────

data class LearnerContext(
    val learnerId: UUID,
    val literacyLevel: String,      // BEGINNER | INTERMEDIATE | ADVANCED
    val preferredLanguage: String
)

data class SimplifyTextRequest(
    val learnerContext: LearnerContext,
    val rawText: String
)

data class SimplifyImageRequest(
    val learnerContext: LearnerContext,
    val base64Image: String,
    val mediaType: String
)

data class LessonSectionJson(
    val content: String
)

data class KeyTermJson(
    val term: String,
    val definition: String
)

data class LessonJson(
    val title: String,
    val sections: List<LessonSectionJson>,
    val keyTerms: List<KeyTermJson>,
    val estimatedMinutes: Int
)

data class QuizOption(
    val id: String,
    val text: String
)

data class QuizQuestionJson(
    val id: String,
    val text: String,
    val options: List<QuizOption>,
    val correctId: String,
    val explanation: String?
)

data class GenerateQuizRequest(
    val learnerContext: LearnerContext,
    val lessonJson: LessonJson,
    val numQuestions: Int = 5
)

data class GenerateQuizResponse(
    val questions: List<QuizQuestionJson>
)

data class AdaptiveResponseRequest(
    val learnerContext: LearnerContext,
    val question: String,
    val selectedOption: String,
    val isCorrect: Boolean,
    val latencyMs: Int
)

data class AdaptiveResponseResult(
    val learnerMessage: String,
    val directive: String       // easier | same | harder | revisit
)

data class WrongAnswerFlowRequest(
    val learnerContext: LearnerContext,
    val question: String,
    val sectionContent: String
)

data class WrongAnswerFlowResult(
    val reExplanation: String,
    val reattemptQuestion: QuizQuestionJson
)

// ── Content Upload ─────────────────────────────────────────────


data class UploadResponse(
    val lessonId: UUID,
    val firstSection: SectionResponse,
    val totalSections: Int,
    val keyTerms: List<KeyTermResponse>
)

data class ProgressPatchRequest(
    val timeSpentSeconds: Int
)

// ── Quiz ───────────────────────────────────────────────────────

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

// ── Dashboard ──────────────────────────────────────────────────

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