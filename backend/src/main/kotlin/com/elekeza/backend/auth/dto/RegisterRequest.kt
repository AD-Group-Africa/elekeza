package com.elekeza.backend.auth.dto

data class RegisterRequest(
    val email: String,
    val password: String,
    val name: String,
    val role: String? = "STUDENT",
    val cognitiveProfiles: List<String>? = null
)