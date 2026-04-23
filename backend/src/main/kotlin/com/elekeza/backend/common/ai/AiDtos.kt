package com.elekeza.backend.common.ai

import com.fasterxml.jackson.annotation.JsonIgnoreProperties
import com.fasterxml.jackson.annotation.JsonInclude

// -- Requests ------------------------------------------------------------------
data class SimplifyTextRequest(val text: String, val level: String = "standard")
data class SimplifyImageRequest(val imageUrl: String, val context: String = "")
data class GenerateQuizRequest(val content: String, val questionCount: Int = 5)
data class AdaptiveResponseRequest(val userContext: String, val query: String)
data class WrongAnswerFlowRequest(val questionId: String, val givenAnswer: String)

// -- Responses -----------------------------------------------------------------
@JsonInclude(JsonInclude.Include.NON_NULL)
@JsonIgnoreProperties(ignoreUnknown = true)
data class LessonJSON(
    val title: String = "",
    val sections: List<AiSection> = emptyList(),
    val terms: List<AiKeyTerm> = emptyList()
)

data class AiSection(val header: String = "", val content: String = "")
data class AiKeyTerm(val term: String = "", val definition: String = "")

@JsonInclude(JsonInclude.Include.NON_NULL)
@JsonIgnoreProperties(ignoreUnknown = true)
data class QuizJSON(val questions: List<AiQuizQuestion> = emptyList())

data class AiQuizQuestion(val question: String = "", val options: List<AiQuizOption> = emptyList())
data class AiQuizOption(val text: String = "", val isCorrect: Boolean = false)

@JsonInclude(JsonInclude.Include.NON_NULL)
@JsonIgnoreProperties(ignoreUnknown = true)
data class AdaptiveResponseJSON(val response: String = "")

@JsonInclude(JsonInclude.Include.NON_NULL)
@JsonIgnoreProperties(ignoreUnknown = true)
data class WrongAnswerFlowJSON(val feedback: String = "", val hint: String = "")

enum class StageFlags { INTRO, CORE, REVIEW }

// -- Response types used by LessonPersistenceService, Phase3DTO, FileUploadService -
data class SectionResponse(val id: Long = 0, val header: String = "", val content: String = "")
data class KeyTermResponse(val id: Long = 0, val term: String = "", val definition: String = "")
data class LessonResponse(
    val id: Long = 0,
    val title: String = "",
    val sections: List<SectionResponse> = emptyList(),
    val terms: List<KeyTermResponse> = emptyList()
)
data class TextUploadRequest(val text: String, val title: String? = null, val language: String = "sw", val sneType: String? = null)
