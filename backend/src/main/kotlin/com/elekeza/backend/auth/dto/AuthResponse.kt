package com.elekeza.backend.auth.dto

import java.util.UUID

data class AuthResponse(
    val learnerId: Long,
    val email: String,
    val name: String? = null,
    val onboardingComplete: Boolean = false,
    val message: String? = null,
    val cognitiveProfiles: List<String>? = null
)