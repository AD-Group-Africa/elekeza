package com.elekeza.backend.learner.dto

import com.elekeza.backend.auth.SneType
import com.elekeza.backend.learner.LearnerProfile
import com.elekeza.backend.learner.LessonProgress
import java.time.LocalDate
import java.time.LocalDateTime

data class LearnerProfileDto(
    val id: Long,
    val sneType: SneType?,
    val preferences: Map<String, Any>,
    val createdAt: LocalDateTime,
    val updatedAt: LocalDateTime
)

data class UpdateProfileRequest(
    val sneType: String? = null,
    val preferences: Map<String, Any>? = null
)

data class LessonProgressDto(
    val id: Long,
    val contentId: Long,
    val quizScore: Double?,
    val completed: Boolean,
    val completedAt: LocalDateTime?,
    val createdAt: LocalDateTime
)

data class CompleteProgressRequest(val quizScore: Double? = null)

data class LearnerStatsDto(
    val lessonsCompleted: Long,
    val avgQuizScore: Double?,
    val recentActivity: Int,
    val streak: Int,
    val lastActive: LocalDate?
)

fun LearnerProfile.toDto() = LearnerProfileDto(
    id          = id,
    sneType     = sneType,
    preferences = preferences,
    createdAt   = createdAt,
    updatedAt   = updatedAt
)

fun LessonProgress.toDto() = LessonProgressDto(
    id          = id,
    contentId   = contentId,
    quizScore   = quizScore,
    completed   = completed,
    completedAt = completedAt,
    createdAt   = createdAt
)