package com.elekeza.backend.auth.dto

import com.elekeza.backend.auth.User

data class ForgotPasswordRequest(val email: String)

data class ResetPasswordRequest(val token: String, val newPassword: String)

data class UserDto(
    val id: Long,
    val email: String,
    val name: String,
    val role: String,
    val sneType: String?,
    val onboardingComplete: Boolean
)

fun User.toDto(): UserDto {
    return UserDto(
        id = this.id,
        email = this.email,
        name = this.name,
        role = this.role.name,
        sneType = this.sneType?.name,
        onboardingComplete = this.onboardingComplete
    )
}