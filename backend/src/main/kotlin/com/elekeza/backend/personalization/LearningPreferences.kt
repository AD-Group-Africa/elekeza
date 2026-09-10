package com.elekeza.backend.personalization

import java.time.Instant

/**
 * Canonical per-student learning-presentation preferences.
 *
 * Design rules (see docs/product/PER_STUDENT_PERSONALIZATION.md):
 *  - every adaptation has a [Source]: EXPLICIT (learner), TEACHER, GUARDIAN,
 *    OBSERVED (behaviour), SYSTEM (defaults);
 *  - resolution precedence is EXPLICIT > TEACHER > GUARDIAN > OBSERVED > SYSTEM;
 *  - observed preferences only change persistent state after enough evidence
 *    (never after a single interaction);
 *  - academic expectations are separate from presentation (this model never
 *    contains ability/diagnosis labels — see [DIAGNOSTIC_PHRASES] guards).
 */
enum class Source { EXPLICIT, TEACHER, GUARDIAN, OBSERVED, SYSTEM }

enum class ContentDensity { COMPACT, STANDARD, SPACIOUS }
enum class ExplanationStyle { CONCISE, STEP_BY_STEP, EXAMPLE_FIRST, DETAILED }
enum class ExampleFrequency { LOW, MEDIUM, HIGH }
enum class TextSize { SMALL, MEDIUM, LARGE }
enum class Contrast { STANDARD, HIGH }

/** Adaptation presentation codes (human names are shown to learners instead). */
enum class AdaptationCode(val code: String) {
    ORIGINAL("original"),
    CLEARER("clearer"),          // chunked, key terms emphasized, duplicates removed
    STEP_BY_STEP("step_by_step"), // numbered one-idea-at-a-time steps
    SPACED("spaced"),            // same content, one concept per section
    DETAILED("detailed")         // structured original — no invented content
}

/**
 * One resolved preference value. Immutable; copy with [withSource].
 */
data class PreferenceEntry(
    val value: String,
    val source: Source,
    val confidence: Double = 0.0,
    val evidenceCount: Int = 0,
    val lastUpdatedEpochMs: Long = Instant.now().toEpochMilli()
) {
    fun withSource(newSource: Source) = copy(source = newSource, lastUpdatedEpochMs = Instant.now().toEpochMilli())
}

/**
 * A learning-support signal inferred from behaviour (never a diagnosis).
 * e.g. "benefits from step-by-step explanations" — stored as recommendation
 * data with confidence + evidence, NOT as a label about the learner.
 */
data class LearningSignal(
    val preferenceKey: String,
    val direction: String,           // e.g. explanationStyle=STEP_BY_STEP
    val confidence: Double,
    val evidenceCount: Int,
    val lastUpdatedEpochMs: Long
)

/** Pure helpers for the JSONB `preferences["learning"]` document. */
object LearningPreferences {

    const val DENSITY = "density"
    const val EXPLANATION_STYLE = "explanationStyle"
    const val EXAMPLE_FREQUENCY = "exampleFrequency"
    const val TEXT_SIZE = "textSize"
    const val CONTRAST = "contrast"
    const val VISUAL_SUPPORT = "visualSupport"
    const val READ_ALOUD = "readAloud"

    val KEYS = listOf(DENSITY, EXPLANATION_STYLE, EXAMPLE_FREQUENCY, TEXT_SIZE, CONTRAST, VISUAL_SUPPORT, READ_ALOUD)

    val ENUM_BY_KEY: Map<String, List<Enum<*>>> = mapOf(
        DENSITY to ContentDensity.entries.toList(),
        EXPLANATION_STYLE to ExplanationStyle.entries.toList(),
        EXAMPLE_FREQUENCY to ExampleFrequency.entries.toList(),
        TEXT_SIZE to TextSize.entries.toList(),
        CONTRAST to Contrast.entries.toList()
    )

    const val LEARNING_NS = "learning"

    fun parseEntry(raw: Any?): PreferenceEntry? {
        if (raw !is Map<*, *>) return null
        val value = raw["v"] as? String ?: return null
        val source = when (raw["s"] as? String) {
            "EXPLICIT" -> Source.EXPLICIT
            "TEACHER" -> Source.TEACHER
            "GUARDIAN" -> Source.GUARDIAN
            "OBSERVED" -> Source.OBSERVED
            else -> Source.SYSTEM
        }
        val confidence = (raw["c"] as? Number)?.toDouble() ?: 0.0
        val evidence = (raw["e"] as? Number)?.toInt() ?: 0
        return PreferenceEntry(value, source, confidence, evidence, System.currentTimeMillis())
    }

    fun entryToMap(e: PreferenceEntry): Map<String, Any> = mapOf(
        "v" to e.value, "s" to e.source.name, "c" to e.confidence, "e" to e.evidenceCount
    )
}

/**
 * Pure deterministic adaptation engine (local + offline safe).
 *
 * These transforms NEVER invent facts, examples or curriculum content: every
 * content sentence survives (duplicates may be dropped for CLEARER; steps are
 * re-ordered only by original order). Heading/step structure is presentation,
 * not semantics, so curriculum integrity is preserved by construction.
 * Real-AI variants (when `ai.client.type=real`) are run through
 * [AdaptationSafety.validate] before being cached.
 */
object TextAdaptation {

    private val SENTENCE_SPLIT = Regex("(?<=[.!?])\\s+")

    fun adapt(rawText: String, code: AdaptationCode): String {
        if (code == AdaptationCode.ORIGINAL) return rawText.trim()
        val sentences = rawText.trim().split(SENTENCE_SPLIT).map { it.trim() }.filter { it.isNotEmpty() }
        if (sentences.isEmpty()) return rawText.trim()
        return when (code) {
            AdaptationCode.ORIGINAL -> rawText.trim()
            AdaptationCode.CLEARER -> {
                val seen = mutableSetOf<String>()
                val body = sentences.filter { seen.add(it.lowercase()) }.joinToString(" ") { it }
                "Key idea\n$body"
            }
            AdaptationCode.STEP_BY_STEP -> sentences.withIndex()
                .joinToString("\n\n") { (i, s) -> "Step ${i + 1}\n$s" }
            AdaptationCode.SPACED -> sentences.joinToString("\n\n") { s -> "$s\n" }
            AdaptationCode.DETAILED -> sentences.withIndex()
                .joinToString("\n\n") { (i, s) -> "Part ${i + 1}\n$s" }
        }
    }

    /**
     * Curriculum-safety validation for AI-generated variants: reject invented
     * content (dropped key terms, no source sentences left), output far
     * shorter than the original, or diagnostic claims.
     */
    object AdaptationSafety {
        val DIAGNOSTIC_PHRASES = listOf(
            "you have dyslexia", "you have adhd", "you are autistic",
            "you have an intellectual disability", "you are dyslexic", "diagnosed with"
        )

        fun validate(original: String, adapted: String): List<String> {
            val issues = mutableListOf<String>()
            val lower = adapted.lowercase()
            DIAGNOSTIC_PHRASES.forEach { if (lower.contains(it)) issues += "contains diagnostic phrasing" }
            val originalTerms = original.lowercase().split(Regex("\\W+")).filter { it.length > 4 }.toSet()
            val missing = originalTerms - adapted.lowercase().split(Regex("\\W+")).toSet()
            if (missing.size > originalTerms.size / 2) issues += "adapted output loses too many key terms"
            if (adapted.length < original.length / 4) issues += "adapted output implausibly short"
            return issues
        }
    }
}

/**
 * Learning-signal accumulator with confidence and decay. A single interaction
 * never flips a preference: persistent changes require [MIN_EVIDENCE] events
 * and confidence >= [MIN_CONFIDENCE]. Confidence decays with time so stale
 * inferences re-evaluate instead of permanently labelling the learner.
 */
class SignalAccumulator(
    private val minEvidence: Int = 3,
    private val minConfidence: Double = 0.6
) {
    fun record(existing: Map<String, LearningSignal>, key: String, direction: String, helpful: Boolean): LearningSignal {
        val base = existing[key]
        val evidence = (base?.evidenceCount ?: 0) + 1
        val confidence = if (helpful) {
            ((base?.confidence ?: 0.0) * (evidence - 1) + 1.0) / evidence
        } else {
            // Negative evidence halves the confidence each time.
            (base?.confidence ?: 0.0) / 2.0
        }
        return LearningSignal(key, direction, confidence, evidence, Instant.now().toEpochMilli())
    }

    /** A signal becomes a persistent OBSERVED preference only with enough evidence. */
    fun asObservedPreference(signal: LearningSignal): PreferenceEntry? {
        if (signal.evidenceCount < minEvidence || signal.confidence < minConfidence) return null
        return PreferenceEntry(
            value = signal.direction,
            source = Source.OBSERVED,
            confidence = signal.confidence,
            evidenceCount = signal.evidenceCount,
            lastUpdatedEpochMs = signal.lastUpdatedEpochMs
        )
    }

    fun decay(signal: LearningSignal, halfLifeDays: Double = 30.0): LearningSignal {
        val ageDays = (Instant.now().toEpochMilli() - signal.lastUpdatedEpochMs) / 86_400_000.0
        if (ageDays <= 0) return signal
        val factor = Math.pow(0.5, ageDays / halfLifeDays)
        return signal.copy(confidence = signal.confidence * factor)
    }
}
