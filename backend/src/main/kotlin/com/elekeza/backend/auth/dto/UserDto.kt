package com.elekeza.backend.auth.dto

data class UserDto(
    val id: Long,
    val email: String,
    val name: String,
    val role: String
) {
    fun toAuthResponse() = AuthResponse(
        learnerId = id,
        email = email,
        name = name
    )
}
