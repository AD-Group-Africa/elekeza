package com.elekeza.backend.auth.dto

import java.util.UUID

data class UserDto(
    val id: UUID,
    val email: String,
    val name: String,
    val role: String
) {
    fun toAuthResponse() = AuthResponse(
        learnerId = id,
        email = email,
        name = name,
        role = role
    )
}