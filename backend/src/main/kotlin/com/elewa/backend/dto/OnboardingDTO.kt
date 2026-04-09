package com.elewa.backend.dto

import com.elewa.backend.model.AgeGroup
import com.elewa.backend.model.LiteracyLevel
import java.util.UUID

// ── Requests ──────────────────────────────────────────────────

data class ProfileRequest(
    val preferredLanguage: String,
    val ageGroup: AgeGroup,
    val learningGoal: String? = null,
    val cognitiveProfiles: List<String>? = null
)

data class PlacementRequest(
    val score: Int,
    val totalQuestions: Int
)

data class GuardianLinkRequest(
    val fullName: String,
    val relationship: String,
    val phone: String? = null,
    val email: String? = null
)

// ── Responses ─────────────────────────────────────────────────

data class OnboardingResponse(
    val learnerId: UUID,
    val message: String,
    val onboardingComplete: Boolean = false
)

data class PlacementResponse(
    val learnerId: UUID,
    val literacyLevel: LiteracyLevel,
    val message: String
)

data class GuardianLinkResponse(
    val guardianId: UUID,
    val learnerId: UUID,
    val message: String
)
