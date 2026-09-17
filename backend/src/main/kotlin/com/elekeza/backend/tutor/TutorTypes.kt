package com.elekeza.backend.tutor

/**
 * AI Tutor V1 — request/response contract.
 *
 * The tutor is a learning-support layer grounded in the learner's CURRENT
 * lesson, never a generic chatbot. Requests carry only the minimum
 * educational context (lesson id + action + language); responses are
 * structured per action so the UI renders learning cards, not chat blobs.
 *
 * Privacy: no tokens, no guardian data, no other learners' records, no
 * institution details travel with a tutor request. The service resolves
 * everything else server-side from the authenticated principal.
 */

enum class TutorAction {
    EXPLAIN,
    PRACTICE,
    TRANSLATE,
    SUMMARY,
    DIAGRAM
}

data class TutorRequest(
    val action: TutorAction,
    /** The lesson the learner is currently studying. Required EXCEPT for read-aloud, which is browser-local. */
    val lessonId: Long? = null,
    /** Target language for TRANSLATE (e.g. "sw" — architecture supports more later). */
    val language: String? = null,
    /** The exact sentence/paragraph to translate, kept short by design. */
    val text: String? = null,
    /** PRACTICE: id of the question being answered. */
    val practiceId: String? = null,
    /** PRACTICE: index of the option the learner chose. */
    val answerIndex: Int? = null,
    /** EXPLAIN variant: "simpler" → step-by-step second explanation. */
    val variant: String? = null
)

data class PracticeQuestion(
    val question: String,
    val options: List<String> = emptyList(),
    /** Answer key stays server-side: the DTO the learner receives never carries it. */
    val correctIndex: Int = 0,
    /** Short educational explanation revealed only after the learner answers. */
    val explanation: String = ""
)

data class DiagramNode(val id: String, val label: String)
data class DiagramEdge(val from: String, val to: String, val label: String)

data class TutorDiagram(
    val title: String,
    val altText: String,
    val nodes: List<DiagramNode>,
    val edges: List<DiagramEdge>
)

data class TutorResponse(
    val action: TutorAction,
    /** Main learning card body (explanation / summary / translation). */
    val content: String? = null,
    /** Optional encouraging opener, e.g. mastery-aware greeting. */
    val intro: String? = null,
    /** PRACTICE: current question to answer (answers are submitted back via /answer). */
    val practice: PracticeQuestionDto? = null,
    /** PRACTICE after answering: feedback for the submitted attempt. */
    val feedback: PracticeFeedbackDto? = null,
    /** TRANSLATE: original text echoed back so the learner can switch. */
    val originalText: String? = null,
    /** TRANSLATE: provider name so the UI can honestly label the source. */
    val translatedBy: String = "offline dictionary",
    /** DIAGRAM: structured, accessible representation (never the only channel). */
    val diagram: TutorDiagram? = null,
    /** True when served by the deterministic fallback rather than a live AI provider. */
    val source: String = "deterministic"
)

data class PracticeQuestionDto(
    val practiceId: String,
    val question: String,
    val options: List<String>,
    val lessonTitle: String
)

data class PracticeFeedbackDto(
    val correct: Boolean,
    val explanation: String,
    val canRetry: Boolean = true
)
