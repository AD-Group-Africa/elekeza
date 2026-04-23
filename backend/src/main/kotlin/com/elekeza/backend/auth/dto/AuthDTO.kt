package com.elekeza.backend.auth.dto

import com.elekeza.backend.auth.User
import com.elekeza.backend.auth.UserRole
import jakarta.validation.constraints.Email
import jakarta.validation.constraints.NotBlank
import jakarta.validation.constraints.Size

data class RegisterRequest(
    @field:NotBlank val name: String,
    @field:Email @field:NotBlank val email: String,
    @field:Size(min = 8) val password: String,
    val role: UserRole = UserRole.STUDENT
)

data class LoginRequest(
    @field:Email @field:NotBlank val email: String,
    @field:NotBlank val password: String
)

data class ForgotPasswordRequest(@field:Email @field:NotBlank val email: String)

data class ResetPasswordRequest(
    @field:NotBlank val token: String,
    @field:Size(min = 8) val newPassword: String
)

data class UserDto(val id: Long, val name: String, val email: String, val role: String)

fun User.toDto() = UserDto(id = id, name = name, email = email, role = role.name)