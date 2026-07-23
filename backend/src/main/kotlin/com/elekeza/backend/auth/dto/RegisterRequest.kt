package com.elekeza.backend.auth.dto

data class RegisterRequest(
    val email: String,
    val password: String,
    val name: String,
    val role: String? = "STUDENT",
    val gender: String? = null,
    val phone: String? = null,
    val termsAccepted: Boolean = false,
    val cognitiveProfiles: List<String>? = null
)
