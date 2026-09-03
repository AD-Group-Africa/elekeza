package com.elekeza.backend.common.ai

import com.fasterxml.jackson.annotation.JsonIgnoreProperties
import com.fasterxml.jackson.annotation.JsonInclude
import com.fasterxml.jackson.annotation.JsonProperty

// ---------------------------------------------------------------------------
// Learner context — sent on every request. Wire names match FastAPI
// models/requests.py LearnerContext exactly.
// ---------------------------------------------------------------------------

data class LearnerContext(
    @JsonProperty("learner_id") val learnerId: String,
    @JsonProperty("cognitive_profiles") val cognitiveProfiles: List<String>,
    @JsonProperty("language_level") val languageLevel: Int = 2,
    @JsonProperty("content_difficulty") val contentDifficulty: Int = 2,
    @JsonProperty("pathway_stage") val pathwayStage: String = "Foundation"
) {
    companion object {
        /**
         * Maps an SNE type to the FastAPI CognitiveProfile literal.
         * Only exact supported profiles are mapped. NONE, DYSCALCULIA (no
         * dedicated literal) and unset values use the neutral "none" pathway
         * — a learner is never silently classified as a supported SNE profile.
         */
        fun fromSneType(learnerId: Long, sneType: String?): LearnerContext {
            val profile = when (sneType?.uppercase()) {
                "DYSLEXIA" -> "dyslexia"
                "ADHD"     -> "adhd"
                "AUTISM"   -> "autism"
                "INTELLECTUAL_DISABILITY", "INTELLECTUAL" -> "intellectual_disability"
                else       -> "none"
            }
            return LearnerContext(
                learnerId = learnerId.toString(),
                cognitiveProfiles = listOf(profile)
            )
        }
    }
}

// ---------------------------------------------------------------------------
// Requests — wire names must match FastAPI models/requests.py exactly.
// ---------------------------------------------------------------------------

data class SimplifyTextRequest(
    @JsonProperty("learner_context") val learnerContext: LearnerContext,
    @JsonProperty("raw_text") val rawText: String
)

data class SimplifyImageRequest(
    @JsonProperty("learner_context") val learnerContext: LearnerContext,
    @JsonProperty("base64_image") val base64Image: String,
    @JsonProperty("media_type") val mediaType: String = "image/jpeg"
)

data class GenerateQuizRequest(
    @JsonProperty("learner_context") val learnerContext: LearnerContext,
    @JsonProperty("lesson_json") val lessonJson: Map<String, Any>,
    @JsonProperty("num_questions") val numQuestions: Int = 5
)

data class AdaptiveResponseRequest(
    @JsonProperty("learner_context") val learnerContext: LearnerContext,
    val question: String,
    @JsonProperty("selected_option") val selectedOption: String,
    @JsonProperty("is_correct") val isCorrect: Boolean,
    @JsonProperty("latency_ms") val latencyMs: Int
)

data class WrongAnswerFlowRequest(
    @JsonProperty("learner_context") val learnerContext: LearnerContext,
    val question: String,
    @JsonProperty("section_content") val sectionContent: String
)

// ---------------------------------------------------------------------------
// Responses — parsed from FastAPI models/responses.py.
// ---------------------------------------------------------------------------

@JsonInclude(JsonInclude.Include.NON_NULL)
@JsonIgnoreProperties(ignoreUnknown = true)
data class LessonJSON(
    val title: String = "",
    val sections: List<AiSection> = emptyList(),
    @JsonProperty("key_terms") val keyTerms: List<AiKeyTerm> = emptyList(),
    @JsonProperty("estimated_minutes") val estimatedMinutes: Int = 5,
    val profile: String = "",
    @JsonProperty("stage_flags") val stageFlags: StageFlags = StageFlags()
)

data class AiSection(
    val heading: String = "",
    val body: String = "",
    @JsonProperty("visual_hint") val visualHint: String? = null,
    @JsonProperty("reading_level") val readingLevel: Int = 1,
    val mermaid: String = ""
)

data class AiKeyTerm(val term: String = "", val definition: String = "")

data class StageFlags(
    @JsonProperty("verification_triggered") val verificationTriggered: Boolean = false,
    @JsonProperty("correction_applied") val correctionApplied: Boolean = false,
    @JsonProperty("profile_merged") val profileMerged: Boolean = false
)

@JsonInclude(JsonInclude.Include.NON_NULL)
@JsonIgnoreProperties(ignoreUnknown = true)
data class QuizJSON(val questions: List<AiQuizQuestion> = emptyList())

data class AiQuizQuestion(
    val id: String = "",
    val text: String = "",
    val options: List<AiQuizOption> = emptyList(),
    @JsonProperty("correct_id") val correctId: String = "a",
    val explanation: String = ""
)

data class AiQuizOption(val id: String = "", val text: String = "")

@JsonInclude(JsonInclude.Include.NON_NULL)
@JsonIgnoreProperties(ignoreUnknown = true)
data class AdaptiveResponseJSON(
    @JsonProperty("learner_message") val learnerMessage: String = "",
    val directive: String = ""
)

@JsonInclude(JsonInclude.Include.NON_NULL)
@JsonIgnoreProperties(ignoreUnknown = true)
data class WrongAnswerFlowJSON(
    @JsonProperty("re_explanation") val reExplanation: String = "",
    @JsonProperty("reattempt_question") val reattemptQuestion: String = ""
)

// ---------------------------------------------------------------------------
// Response types used by LessonPersistenceService / legacy paths.
// ---------------------------------------------------------------------------

data class SectionResponse(val id: Long = 0, val header: String = "", val content: String = "")
data class KeyTermResponse(val id: Long = 0, val term: String = "", val definition: String = "")
data class LessonResponse(
    val id: Long = 0,
    val title: String = "",
    val sections: List<SectionResponse> = emptyList(),
    val terms: List<KeyTermResponse> = emptyList()
)
data class TextUploadRequest(val text: String, val title: String? = null, val language: String = "sw", val sneType: String? = null)
