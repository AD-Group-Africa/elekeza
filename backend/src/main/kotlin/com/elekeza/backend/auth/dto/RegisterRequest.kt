package com.elekeza.backend.auth.dto

data class RegisterRequest(
    val email: String,
    val password: String,
    val name: String,   // Changed from fullName to name
    val role: String? = "STUDENT", // Added so AuthService can access it
    val cognitiveProfiles: List<String>? = null
)