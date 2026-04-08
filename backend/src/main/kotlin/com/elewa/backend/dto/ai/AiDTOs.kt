package com.elewa.backend.dto.ai

import com.fasterxml.jackson.annotation.JsonProperty

data class LearnerContext(
    @JsonProperty("learner_id")         val learnerId: String,
    @JsonProperty("cognitive_profiles") val cognitiveProfiles: List<String>,
    @JsonProperty("language_level")     val languageLevel: Int,
    @JsonProperty("content_difficulty") val contentDifficulty: Int,
    @JsonProperty("pathway_stage")      val pathwayStage: String
)

data class SimplifyTextRequest(
    @JsonProperty("learner_context") val learnerContext: LearnerContext,
    @JsonProperty("raw_text")        val rawText: String
)

data class SimplifyImageRequest(
    @JsonProperty("learner_context") val learnerContext: LearnerContext,
    @JsonProperty("base64_image")    val base64Image: String,
    @JsonProperty("media_type")      val mediaType: String
)

data class GenerateQuizRequest(
    @JsonProperty("learner_context") val learnerContext: LearnerContext,
    @JsonProperty("lesson_json")     val lessonJson: LessonJSON,
    @JsonProperty("num_questions")   val numQuestions: Int = 5
)

data class AdaptiveResponseRequest(
    @JsonProperty("learner_context") val learnerContext: LearnerContext,
    @JsonProperty("question")        val question: String,
    @JsonProperty("selected_option") val selectedOption: String,
    @JsonProperty("is_correct")      val isCorrect: Boolean,
    @JsonProperty("latency_ms")      val latencyMs: Long
)

data class WrongAnswerFlowRequest(
    @JsonProperty("learner_context") val learnerContext: LearnerContext,
    @JsonProperty("question")        val question: String,
    @JsonProperty("section_content") val sectionContent: String
)

data class LessonJSON(
    val title: String,
    val sections: List<AiSection>,
    @JsonProperty("key_terms")         val keyTerms: List<AiKeyTerm>,
    @JsonProperty("estimated_minutes") val estimatedMinutes: Int,
    val profile: String,
    @JsonProperty("stage_flags")       val stageFlags: StageFlags
)

data class AiSection(
    val heading: String,
    val body: String,
    @JsonProperty("visual_hint")   val visualHint: String? = null,
    @JsonProperty("reading_level") val readingLevel: Int? = null
)

data class AiKeyTerm(
    val term: String,
    val definition: String
)

data class StageFlags(
    @JsonProperty("verification_triggered") val verificationTriggered: Boolean,
    @JsonProperty("correction_applied")     val correctionApplied: Boolean,
    @JsonProperty("profile_merged")         val profileMerged: Boolean
)

data class QuizJSON(
    val questions: List<AiQuizQuestion>
)

data class AiQuizQuestion(
    val id: String,
    val text: String,
    val options: List<AiQuizOption>,
    @JsonProperty("correct_id") val correctId: String,
    val explanation: String
)

data class AiQuizOption(
    val id: String,
    val text: String
)

data class AdaptiveResponseJSON(
    @JsonProperty("learner_message") val learnerMessage: String,
    val directive: String
)

data class WrongAnswerFlowJSON(
    @JsonProperty("re_explanation")     val reExplanation: String,
    @JsonProperty("reattempt_question") val reattemptQuestion: String
)

data class AiErrorResponse(
    @JsonProperty("error_code") val errorCode: String,
    val message: String,
    val stage: String,
    val retried: Boolean
)