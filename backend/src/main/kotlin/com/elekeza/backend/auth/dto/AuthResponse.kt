package com.elekeza.backend.auth.dto

// Ensure this import matches the class name in AuthDTO.kt exactly
import com.elekeza.backend.auth.dto.UserDto

data class AuthResponse(
    val user: UserDto,
    val learnerId: Any
)