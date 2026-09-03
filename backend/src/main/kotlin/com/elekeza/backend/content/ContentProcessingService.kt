package com.elekeza.backend.content

import com.elekeza.backend.common.ai.AiClient
import com.elekeza.backend.common.ai.GenerateQuizRequest
import com.elekeza.backend.common.ai.LearnerContext
import com.elekeza.backend.common.ai.LessonJSON
import com.elekeza.backend.common.ai.SimplifyTextRequest
import com.fasterxml.jackson.core.type.TypeReference
import com.fasterxml.jackson.databind.ObjectMapper
import org.slf4j.LoggerFactory
import org.springframework.beans.factory.annotation.Value
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

/**
 * Runs the AI adaptation pipeline for stored content.
 *
 * Contract: content is always left in a readable state.
 *  - No AI configured (`ai.client.type=mock` or unset): content stays as raw
 *    text and is marked READY — the response says adaptation was skipped.
 *  - Real AI reachable: simplified lesson + generated quiz are persisted as a
 *    single JSON document in `simplified_text` (shape `{"lesson":{...},
 *    "quiz":{"questions":[...]}}` — the same document AiQuizParser reads).
 *  - Real AI unavailable/failed: content is still marked READY with the raw
 *    text, and the failure reason is returned for the caller to surface.
 */
@Service
class ContentProcessingService(
    private val contentRepository: ContentRepository,
    private val aiClient: AiClient,
    private val objectMapper: ObjectMapper,
    @Value("\${ai.client.type:mock}") private val aiClientType: String
) {
    private val log = LoggerFactory.getLogger(javaClass)

    data class ProcessResult(val adapted: Boolean, val message: String)

    @Transactional
    fun process(contentId: Long, sneType: String?): ProcessResult {
        val content = contentRepository.findById(contentId)
            .orElseThrow { IllegalArgumentException("Content $contentId not found") }

        val raw = content.rawText?.trim()
        if (raw.isNullOrEmpty()) {
            contentRepository.save(content.withSimplified(null, newStatus = ContentStatus.READY))
            return ProcessResult(false, "No readable text to simplify — content stored as-is")
        }

        if (!aiClientType.equals("real", ignoreCase = true)) {
            contentRepository.save(content.withSimplified(null, newStatus = ContentStatus.READY))
            return ProcessResult(
                false,
                "AI service not enabled (ai.client.type=$aiClientType) — content stored as-is. " +
                    "Set AI_CLIENT_TYPE=real to auto-simplify and generate quizzes."
            )
        }

        return runCatching {
            val context = LearnerContext.fromSneType(content.userId, sneType)
            val lesson = aiClient.simplifyText(SimplifyTextRequest(learnerContext = context, rawText = raw))
            val lessonMap = objectMapper.convertValue(lesson, object : TypeReference<Map<String, Any>>() {})
            val quiz = aiClient.generateQuiz(
                GenerateQuizRequest(
                    learnerContext = context,
                    lessonJson = lessonMap,
                    numQuestions = 5
                )
            )
            persist(content, raw, lesson, quiz)
        }.getOrElse { e ->
            log.warn("AI adaptation failed for content {}: {}", content.id, e.message)
            contentRepository.save(content.withSimplified(null, newStatus = ContentStatus.READY))
            ProcessResult(false, "AI service unavailable (${e.message ?: "unknown error"}) — content stored as-is")
        }
    }

    private fun persist(content: Content, raw: String, lesson: LessonJSON, quiz: Any): ProcessResult {
        val doc = mapOf(
            "lesson" to lesson,
            "quiz" to quiz,
            "adapted_at" to java.time.LocalDateTime.now().toString()
        )
        val title = lesson.title.takeIf { it.isNotBlank() } ?: content.title
        val saved = contentRepository.save(
            content.withSimplified(
                newSimplifiedText = objectMapper.writeValueAsString(doc),
                newTitle = title,
                newStatus = ContentStatus.READY,
                newWordCount = raw.split(Regex("\\s+")).size
            )
        )
        log.info("Content {} adapted — {} sections, quiz stored, status READY", saved.id, lesson.sections.size)
        return ProcessResult(true, "Lesson simplified and quiz generated")
    }
}
