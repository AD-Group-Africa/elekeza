package com.elewa.backend.dto

import jakarta.validation.constraints.Email
import jakarta.validation.constraints.NotBlank
import jakarta.validation.constraints.Size
import java.util.UUID

data class RegisterRequest(
    @field:NotBlank @field:Email
    val email: String,

    @field:NotBlank @field:Size(min = 8, message = "Password must be at least 8 characters")
    val password: String,

    val fullName: String? = null
)

data class LoginRequest(
    @field:NotBlank @field:Email
    val email: String,

    @field:NotBlank
    val password: String
)

data class AuthResponse(
    val learnerId: UUID,
    val email: String,
    val fullName: String? = null,
    val onboardingComplete: Boolean = false,
    val message: String
)