package com.elekeza.backend.auth.dto

data class ResetPasswordRequest(
    val token: String,
    val newPassword: String
)