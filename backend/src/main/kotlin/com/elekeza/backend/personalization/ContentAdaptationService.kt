package com.elekeza.backend.personalization

import com.elekeza.backend.auth.User
import com.elekeza.backend.common.ai.AiClient
import com.elekeza.backend.common.ai.LearnerContext
import com.elekeza.backend.common.ai.LessonJSON
import com.elekeza.backend.common.ai.SimplifyTextRequest
import com.elekeza.backend.content.Content
import com.elekeza.backend.content.ContentRepository
import com.elekeza.backend.content.LessonView
import com.fasterxml.jackson.databind.ObjectMapper
import org.slf4j.LoggerFactory
import org.springframework.beans.factory.annotation.Value
import org.springframework.http.HttpStatus
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.server.ResponseStatusException
import java.security.MessageDigest

/**
 * Per-student content adaptation with caching and safe fallback.
 *
 * Pipeline: profile-derived (or requested) [AdaptationCode] → cache lookup on
 * (learner, content, code) → generate: when `ai.client.type=real` the AI is
 * asked for a student-aware simplification and its output is validated
 * ([TextAdaptation.AdaptationSafety]); any AI failure or invalid output falls
 * back to the deterministic local transform (subset-preserving, offline-safe).
 * The generated variant is persisted so identical requests never re-invoke AI
 * and offline clients reuse it. The original is always available.
 */
@Service
class ContentAdaptationService(
    private val contentRepo: ContentRepository,
    private val adaptRepo: ContentAdaptationRepository,
    private val eventRepo: AdaptationEventRepository,
    private val personalizationService: PersonalizationService,
    private val aiClient: AiClient,
    @Value("\${ai.client.type:mock}") private val aiClientType: String,
    private val objectMapper: ObjectMapper
) {
    private val log = LoggerFactory.getLogger(javaClass)

    private val CODE_LABELS: Map<String, String> = mapOf(
        "original" to "Original",
        "clearer" to "Clearer",
        "step_by_step" to "Step-by-step",
        "spaced" to "Spaced out",
        "detailed" to "More detail"
    )

    /** Default code derived from the learner's resolved profile. */
    @Transactional
    fun defaultCode(learner: User): String {
        val effective = personalizationService.readEffective(learner)
        return when {
            (effective[LearningPreferences.EXPLANATION_STYLE]?.get("value") as? String) == "STEP_BY_STEP" -> "step_by_step"
            (effective[LearningPreferences.EXPLANATION_STYLE]?.get("value") as? String) == "DETAILED" -> "detailed"
            (effective[LearningPreferences.EXPLANATION_STYLE]?.get("value") as? String) == "EXAMPLE_FIRST" -> "clearer"
            (effective[LearningPreferences.DENSITY]?.get("value") as? String) == "SPACIOUS" -> "spaced"
            else -> "clearer"
        }
    }

    @Transactional
    fun getVariant(learner: User, content: Content, requestedCode: String?): Map<String, Any> {
        val code = requestedCode?.takeIf { it.isNotBlank() }?.lowercase() ?: defaultCode(learner)
        val enumCode = AdaptationCode.entries.firstOrNull { it.code == code }
            ?: throw ResponseStatusException(HttpStatus.BAD_REQUEST, "Unknown adaptation code: $code")

        val sourceText = sourceTextOf(content)
        if (sourceText.isBlank()) {
            throw ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "This lesson has no readable text to adapt")
        }
        if (enumCode == AdaptationCode.ORIGINAL) {
            recordEvent(learner.id, content.id, "ADAPT_VIEW", "code=original")
            return variantResponse(sourceText, "original", "Original", "ORIGINAL", cached = true, content)
        }

        val hash = sha256(sourceText)
        val cached = adaptRepo.findByLearnerIdAndContentIdAndAdaptationCode(learner.id, content.id, code)
        if (cached != null && cached.sourceTextHash == hash) {
            recordEvent(learner.id, content.id, "ADAPT_VIEW", "code=$code cached=true")
            return variantResponse(cached.adaptedText, code, CODE_LABELS[code] ?: code, "CACHE", cached = true, content)
        }

        val generated = generate(learner, content, sourceText, enumCode, hash)
        recordEvent(learner.id, content.id, "ADAPT_GENERATED", "code=$code source=${generated["source"]}")
        return variantResponse(generated["text"] as String, code, CODE_LABELS[code] ?: code, generated["source"] as String, cached = false, content)
    }

    private fun generate(learner: User, content: Content, sourceText: String, code: AdaptationCode, hash: String): Map<String, Any> {
        val local = TextAdaptation.adapt(sourceText, code)
        val fromAi = if (aiClientType.equals("real", ignoreCase = true)) {
            try {
                // The adaptation AI is preference-driven, never label-driven:
                // no SNE/diagnostic information is ever sent to the provider,
                // only the neutral learner context + the content text.
                val lesson: LessonJSON = aiClient.simplifyText(
                    SimplifyTextRequest(learnerContext = LearnerContext.fromSneType(learner.id, null), rawText = sourceText)
                )
                val aiText = lesson.sections.joinToString("\n\n") { s ->
                    (if (s.heading.isNotBlank()) s.heading + "\n" else "") + s.body
                }
                val issues = TextAdaptation.AdaptationSafety.validate(sourceText, aiText)
                if (issues.isEmpty()) aiText else null.also {
                    log.warn("AI adaptation rejected for content {}: {}", content.id, issues.joinToString("; "))
                }
            } catch (e: Exception) {
                log.warn("AI adaptation failed for content {}: {}", content.id, e.message)
                null
            }
        } else null

        val (text, source) = if (fromAi != null) fromAi to "AI" else local to "LOCAL"
        val existing = adaptRepo.findByLearnerIdAndContentIdAndAdaptationCode(learner.id, content.id, code.code)
        if (existing != null) adaptRepo.delete(existing)
        adaptRepo.save(ContentAdaptation(
            learnerId = learner.id,
            contentId = content.id,
            adaptationCode = code.code,
            sourceTextHash = hash,
            adaptedText = text
        ))
        return mapOf("text" to text, "source" to source)
    }

    @Transactional
    fun recordFeedback(learner: User, contentId: Long, helpful: Boolean, code: String?) {
        val content = contentRepo.findById(contentId)
            .orElseThrow { ResponseStatusException(HttpStatus.NOT_FOUND, "Lesson not found") }
        recordEvent(learner.id, contentId, "FEEDBACK", "code=$code helpful=$helpful")
        val (key, direction) = when (code?.lowercase()) {
            "step_by_step" -> LearningPreferences.EXPLANATION_STYLE to "STEP_BY_STEP"
            "spaced" -> LearningPreferences.DENSITY to "SPACIOUS"
            "detailed" -> LearningPreferences.EXPLANATION_STYLE to "DETAILED"
            else -> LearningPreferences.EXPLANATION_STYLE to "CONCISE"
        }
        personalizationService.recordSignal(learner, key, direction, helpful)
    }

    private fun recordEvent(learnerId: Long, contentId: Long, type: String, detail: String?) {
        runCatching { eventRepo.save(AdaptationEvent(learnerId = learnerId, contentId = contentId, eventType = type, detail = detail)) }
    }

    private fun variantResponse(text: String, code: String, label: String, source: String, cached: Boolean, content: Content): Map<String, Any> =
        mapOf(
            "contentId" to content.id,
            "lessonTitle" to (content.title ?: ""),
            "code" to code,
            "label" to label,
            "text" to text,
            "source" to source,
            "cached" to cached,
            "originalAvailable" to (sourceTextOf(content).isNotBlank())
        )

    /**
     * The readable source of a lesson. Prefers the plain `raw_text` used by
     * the AI pipeline; lessons stored as structured JSON (headings, bodies,
     * key terms — the same text the lesson page renders) are reconstructed
     * from that JSON so every READY lesson the learner can see is adaptable.
     */
    private fun sourceTextOf(content: Content): String {
        content.rawText?.trim()?.takeIf { it.isNotBlank() }?.let { return it }
        val parsed = LessonView.parseSimplified(content.simplifiedText, objectMapper)
        if (parsed.sections.isEmpty() && parsed.keyTerms.isEmpty()) return ""
        val builder = StringBuilder()
        parsed.sections.forEach { section ->
            if (section.heading.isNotBlank()) builder.append(section.heading).append("\n")
            builder.append(section.body.trim()).append("\n\n")
        }
        parsed.keyTerms.forEach { (term, definition) ->
            builder.append(term).append(": ").append(definition).append("\n\n")
        }
        return builder.toString().trim()
    }

    private fun sha256(input: String): String {
        val digest = MessageDigest.getInstance("SHA-256").digest(input.toByteArray())
        return digest.joinToString("") { "%02x".format(it) }
    }
}
