package com.elewa.backend.dto.ai

import com.fasterxml.jackson.annotation.JsonProperty

data class LessonJSON(
    val title: String,
    val sections: List<Section>,
    @JsonProperty("key_terms") val keyTerms: List<String>,
    @JsonProperty("estimated_minutes") val estimatedMinutes: Int,
    val quiz: List<QuizQuestion>,
    @JsonProperty("profile_applied") val profileApplied: String,
    @JsonProperty("pathway_stage") val pathwayStage: String
)

data class Section(
    val title: String,
    val content: String
)

data class QuizQuestion(
    val question: String,
    val options: List<String>,
    @JsonProperty("correct_index") val correctIndex: Int,
    val explanation: String
)