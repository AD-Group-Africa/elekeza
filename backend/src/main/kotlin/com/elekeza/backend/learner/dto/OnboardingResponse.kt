package com.elekeza.backend.learner.dto

data class OnboardingResponse(
    val learnerId: Long,
    val onboardingComplete: Boolean,
    val message: String
)
