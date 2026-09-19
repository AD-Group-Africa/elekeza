package com.elekeza.backend.auth.dto

data class LoginRequest(
    val email: String,
    val password: String
)