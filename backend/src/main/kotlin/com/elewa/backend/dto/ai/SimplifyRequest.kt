package com.elewa.backend.dto.ai

data class SimplifyRequest(
    val rawText: String,
    val profiles: List<String>,
    val learnerId: String,
    val pathwayStage: String,
    val subject: String,
    val gradeEquivalent: String
)