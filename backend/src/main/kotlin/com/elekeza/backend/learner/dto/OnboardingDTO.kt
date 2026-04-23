package com.elekeza.backend.learner.dto

import com.elekeza.backend.learner.AgeGroup
import com.elekeza.backend.learner.LiteracyLevel
import java.util.UUID

data class ProfileRequest(
    val preferredLanguage: String,
    val ageGroup: AgeGroup,
    val learningGoal: String? = null,
    val cognitiveProfiles: List<String>? = null
)

data class PlacementRequest(val score: Int, val totalQuestions: Int)

data class GuardianLinkRequest(
    val fullName: String,
    val relationship: String,
    val phone: String? = null,
    val email: String? = null
)

data class OnboardingResponse(val learnerId: UUID, val message: String, val onboardingComplete: Boolean = false)

data class PlacementResponse(val learnerId: UUID, val literacyLevel: LiteracyLevel, val message: String)

data class GuardianLinkResponse(val guardianId: UUID, val learnerId: UUID, val message: String)