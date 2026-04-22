package com.elekeza.backend.common

import com.fasterxml.jackson.annotation.JsonInclude
import java.time.OffsetDateTime

@JsonInclude(JsonInclude.Include.NON_NULL)
data class ErrorResponse(
    val status: Int,
    val error: String,
    val details: Map<String, String>? = null,
    val timestamp: OffsetDateTime = OffsetDateTime.now()
)