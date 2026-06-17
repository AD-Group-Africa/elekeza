package com.elekeza.backend.content

import com.elekeza.backend.auth.User
import com.elekeza.backend.auth.UserRepository
import com.elekeza.backend.common.AuditLogService
import com.elekeza.backend.common.CircuitBreakerRegistry
import com.elekeza.backend.common.CircuitOpenException
import com.elekeza.backend.common.RetryUtil
import org.slf4j.LoggerFactory
import org.springframework.beans.factory.annotation.Value
import org.springframework.data.domain.Page
import org.springframework.data.domain.PageRequest
import org.springframework.http.*
import org.springframework.scheduling.annotation.Async
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.client.ResourceAccessException
import org.springframework.web.client.RestTemplate
import org.springframework.web.multipart.MultipartFile
import org.springframework.web.server.ResponseStatusException
import java.nio.file.Files
import java.nio.file.Paths
import java.time.LocalDateTime
import java.util.UUID

@Service
class ContentService(
    private val contentRepository:      ContentRepository,
    private val restTemplate:           RestTemplate,
    private val circuitBreakerRegistry: CircuitBreakerRegistry,
    private val auditLogService:        AuditLogService,
    @Value("\${ai.base-url:http://localhost:8000}") private val aiServiceUrl: String,
    @Value("\${ai.internal-secret}") private val internalSecret: String
) {
    private val log = LoggerFactory.getLogger(ContentService::class.java)

    private val ALLOWED_TYPES = setOf(
        "application/pdf",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "text/plain"
    )
    private val MAX_SIZE_BYTES = 10 * 1024 * 1024L

    fun upload(userId: Long, file: MultipartFile, sneType: String?): Content {
        if (file.size > MAX_SIZE_BYTES)
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, "File too large. Maximum size is 10 MB.")
        if (file.contentType !in ALLOWED_TYPES)
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, "Only PDF, DOCX, and TXT files are accepted.")

        val uploadDir = Paths.get("uploads").also { Files.createDirectories(it) }
        val filename  = "${UUID.randomUUID()}_${file.originalFilename?.replace("[^a-zA-Z0-9._-]".toRegex(), "_")}"
        val filePath  = uploadDir.resolve(filename)
        file.transferTo(filePath)

        val content = contentRepository.save(Content(
            userId           = userId,
            title            = file.originalFilename,
            originalFilename = file.originalFilename,
            filePath         = filePath.toString(),
            sneType          = sneType,
            status           = ContentStatus.UPLOADING
        ))

        auditLogService.log(
            action   = "CONTENT_UPLOAD",
            category = "CONTENT",
            userId   = userId,
            detail   = "contentId=${content.id} file=${file.originalFilename} sneType=$sneType"
        )

        processWithAI(content.id, filePath.toString(), sneType ?: "NONE")
        return content
    }

    // Add this method to ContentService.kt
// Place it after the existing upload() method

    /**
     * FIX: Text upload from frontend — accepts plain text string instead of MultipartFile.
     * The frontend sends { text, title, language, sneType } as JSON.
     * We save the text directly to the Content entity and trigger AI processing.
     *
     * No file is written to disk for text uploads — text is stored in the DB directly.
     * This is simpler, safer (no disk management), and works correctly on Render's ephemeral filesystem.
     */
    fun uploadText(userId: Long, text: String, title: String, sneType: String?): Content {
        if (text.isBlank()) throw ResponseStatusException(HttpStatus.BAD_REQUEST, "Text cannot be empty")
        if (text.length > 50_000) throw ResponseStatusException(HttpStatus.BAD_REQUEST, "Text too long. Maximum 50,000 characters.")

        val content = contentRepository.save(Content(
            userId           = userId,
            title            = title.ifBlank { "Untitled — ${LocalDateTime.now()}" },
            originalFilename = null,
            filePath         = null,   // No file for text uploads
            text = text,   // Store text directly
            sneType          = sneType,
            status           = ContentStatus.UPLOADING
        ))

        auditLogService.log(
            action   = "CONTENT_TEXT_UPLOAD",
            category = "CONTENT",
            userId   = userId,
            detail   = "contentId=${content.id} chars=${text.length} sneType=$sneType"
        )

        processTextWithAI(content.id, text, sneType ?: "NONE")
        return content
    }

    @Async
    @Transactional
    fun processTextWithAI(contentId: Long, text: String, sneType: String) {
        log.info("AI text processing started: contentId={} sneType={}", contentId, sneType)
        contentRepository.updateStatus(contentId, ContentStatus.PROCESSING)

        val circuit = circuitBreakerRegistry.get("ai-service")
        try {
            @Suppress("UNCHECKED_CAST")
            val result = circuit.execute(
                call = {
                    RetryUtil.withRetry(maxAttempts = 2, initialDelayMs = 1000,
                        retryOn = { e -> e is ResourceAccessException }) {
                        val headers = HttpHeaders().apply {
                            contentType = MediaType.APPLICATION_JSON
                            set("X-Internal-Secret", internalSecret)
                        }
                        // Send text directly — AI service doesn't need a file path
                        val response = restTemplate.postForEntity(
                            "$aiServiceUrl/ai/simplify/text",
                            HttpEntity(mapOf(
                                "learner_context" to mapOf(
                                    "learner_id"       to contentId.toString(),
                                    "cognitive_profiles" to listOf(sneType.lowercase().takeIf { it != "none" } ?: "dyslexia"),
                                    "language_level"   to 2,
                                    "content_difficulty" to 2,
                                    "pathway_stage"    to "Foundation"
                                ),
                                "raw_text" to text
                            ), headers),
                            Map::class.java
                        )
                        response.body ?: throw IllegalStateException("AI service returned empty response")
                    }
                },
                fallback = null
            ) as Map<String, Any>

            val simplified = result["simplified_text"] as? String
                ?: (result["sections"] as? List<*>)?.joinToString("\n") { it.toString() }
                ?: ""
            val wordCount = simplified.split("\\s+".toRegex()).filter { it.isNotBlank() }.size

            contentRepository.updateSimplified(contentId, simplified, wordCount, ContentStatus.READY)
            auditLogService.log("CONTENT_TEXT_PROCESSED", "CONTENT", detail = "contentId=$contentId words=$wordCount")

        } catch (e: CircuitOpenException) {
            log.warn("AI circuit OPEN — fast-failing contentId={}", contentId)
            contentRepository.updateStatus(contentId, ContentStatus.FAILED)
        } catch (e: Exception) {
            log.error("AI text processing failed: contentId={}", contentId, e)
            contentRepository.updateStatus(contentId, ContentStatus.FAILED)
        }
    }

// NOTE: Also update Content entity to add rawText field if not present:
// @Column(columnDefinition = "TEXT") var rawText: String? = null

    @Async
    @Transactional
    fun processWithAI(contentId: Long, filePath: String, sneType: String) {
        log.info("AI processing started: contentId={} sneType={}", contentId, sneType)
        contentRepository.updateStatus(contentId, ContentStatus.PROCESSING)

        val circuit = circuitBreakerRegistry.get("ai-service")
        try {
            @Suppress("UNCHECKED_CAST")
            val result = circuit.execute(
                call = {
                    RetryUtil.withRetry(
                        maxAttempts    = 2,
                        initialDelayMs = 1000,
                        retryOn        = { e -> e is ResourceAccessException }
                    ) {
                        val headers = HttpHeaders().apply {
                            contentType = MediaType.APPLICATION_JSON
                            set("X-Internal-Secret", internalSecret)
                        }
                        val response = restTemplate.postForEntity(
                            "$aiServiceUrl/process",
                            HttpEntity(mapOf("file_path" to filePath, "sne_type" to sneType), headers),
                            Map::class.java
                        )
                        response.body ?: throw IllegalStateException("AI service returned empty response")
                    }
                },
                fallback = null
            ) as Map<String, Any>

            val simplified = result["simplified_text"] as? String ?: ""
            val wordCount  = (result["word_count"] as? Number)?.toInt()
                ?: simplified.split("\\s+".toRegex()).filter { it.isNotBlank() }.size

            contentRepository.updateSimplified(contentId, simplified, wordCount, ContentStatus.READY)
            auditLogService.log("CONTENT_PROCESSED", "CONTENT", detail = "contentId=$contentId words=$wordCount")

        } catch (e: CircuitOpenException) {
            log.warn("AI circuit OPEN â€” fast-failing contentId={}", contentId)
            contentRepository.updateStatus(contentId, ContentStatus.FAILED)
        } catch (e: Exception) {
            log.error("AI processing failed: contentId={}", contentId, e)
            contentRepository.updateStatus(contentId, ContentStatus.FAILED)
        }
    }

    fun getContent(contentId: Long, userId: Long): Content =
        contentRepository.findByIdAndUserId(contentId, userId)
            ?: throw ResponseStatusException(HttpStatus.NOT_FOUND, "Content not found")

    fun list(userId: Long, page: Int, size: Int): Page<Content> =
        contentRepository.findByUserIdOrderByCreatedAtDesc(userId, PageRequest.of(page, size.coerceAtMost(50)))

    fun deleteContent(contentId: Long, userId: Long) {
        val content = getContent(contentId, userId)
        content.filePath?.let { path ->
            try { Files.deleteIfExists(Paths.get(path)) }
            catch (e: Exception) { log.warn("Could not delete file {}: {}", path, e.message) }
        }
        contentRepository.delete(content)
        auditLogService.log("CONTENT_DELETED", "CONTENT", userId = userId, detail = "contentId=$contentId")
    }
}
