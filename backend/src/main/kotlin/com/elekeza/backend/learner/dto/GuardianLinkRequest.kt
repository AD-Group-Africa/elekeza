package com.elekeza.backend.learner.dto

data class GuardianLinkRequest(
    val fullName: String,
    val relationship: String,
    val phone: String?,
    val email: String?
)
