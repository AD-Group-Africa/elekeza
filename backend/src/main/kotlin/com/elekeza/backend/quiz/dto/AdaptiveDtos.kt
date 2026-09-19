package com.elekeza.quiz.dto

data class AdaptiveRequest(
    val profile: String,
    val languageLevel: Int = 2,
    val isCorrect: Boolean,
    val latencyMs: Long,
    val consecutiveCorrect: Int = 0,
    val consecutiveWrong: Int = 0,
    val currentDifficulty: Int = 2,
    val lessonId: String? = null,
)

data class AdaptiveResponse(
    val directive: String,
    val message: String,
    val adjustedDifficulty: Int,
    val reasoning: String,
    val profileApplied: String,
    val latencyMs: Long,
)