package com.elekeza.backend.content

import com.elekeza.backend.auth.User
import com.elekeza.backend.common.ai.AiClient
import com.elekeza.backend.common.ai.SimplifyTextRequest
import com.elekeza.backend.common.ai.GenerateQuizRequest
import com.fasterxml.jackson.databind.ObjectMapper
import org.apache.pdfbox.Loader
import org.apache.pdfbox.text.PDFTextStripper
import org.apache.poi.xwpf.usermodel.XWPFDocument
import org.slf4j.LoggerFactory
import org.springframework.http.HttpStatus
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.web.bind.annotation.*
import org.springframework.web.multipart.MultipartFile
import org.springframework.web.server.ResponseStatusException
import java.time.LocalDateTime

@RestController
@RequestMapping("/api/content")
class ContentController(
    private val contentRepository: ContentRepository,
    private val aiClient: AiClient
) {
    private val log = LoggerFactory.getLogger(ContentController::class.java)
    private val objectMapper = ObjectMapper()

    data class UploadTextRequest(
        val title: String?,
        val subject: String?,
        val text: String,
        val sneType: String? = "NONE"
    )

    @PostMapping("/upload/text")
    fun uploadText(
        @RequestBody req: UploadTextRequest,
        @AuthenticationPrincipal user: User
    ): Map<String, Any> {
        val title = req.title ?: "Untitled"
        val extractedText = req.text

        val aiOutput = runCatching {
            val lessonJson = aiClient.simplifyText(SimplifyTextRequest(text = extractedText))
            val quizJson   = aiClient.generateQuiz(GenerateQuizRequest(content = extractedText))
            objectMapper.writeValueAsString(mapOf("lesson" to lessonJson, "quiz" to quizJson))
        }.getOrElse {
            log.warn("AI processing failed – storing raw text instead", it)
            extractedText
        }

        val content = contentRepository.save(Content(
            userId = user.id, title = title, status = ContentStatus.READY,
            simplifiedText = aiOutput,
            wordCount = extractedText.split(Regex("\\s+")).size,
            createdAt = LocalDateTime.now(), updatedAt = LocalDateTime.now()
        ))
        return mapOf("lessonId" to content.id, "title" to title, "status" to "READY")
    }

    @PostMapping("/upload/file")
    fun uploadFile(
        @RequestPart("file") file: MultipartFile,
        @RequestPart("title", required = false) titlePart: String?,
        @AuthenticationPrincipal user: User
    ): Map<String, Any> {
        val originalName = file.originalFilename ?: "unknown"
        val extension = originalName.substringAfterLast('.', "").lowercase()
        val title = titlePart ?: originalName.substringBeforeLast('.')

        val extractedText = when (extension) {
            "txt"  -> String(file.bytes)
            "pdf"  -> Loader.loadPDF(file.bytes).use { PDFTextStripper().getText(it) }
            "docx" -> XWPFDocument(file.inputStream).use { doc -> doc.paragraphs.joinToString("\n") { it.text } }
            else   -> throw ResponseStatusException(HttpStatus.BAD_REQUEST, "Unsupported file type: .$extension")
        }
        if (extractedText.isBlank()) throw ResponseStatusException(HttpStatus.BAD_REQUEST, "No readable text found")

        val aiOutput = runCatching {
            val lessonJson = aiClient.simplifyText(SimplifyTextRequest(text = extractedText))
            val quizJson   = aiClient.generateQuiz(GenerateQuizRequest(content = extractedText))
            objectMapper.writeValueAsString(mapOf("lesson" to lessonJson, "quiz" to quizJson))
        }.getOrElse {
            log.warn("AI processing failed – storing raw text instead", it)
            extractedText
        }

        val content = contentRepository.save(Content(
            userId = user.id, title = title, originalFilename = originalName,
            status = ContentStatus.READY, simplifiedText = aiOutput,
            wordCount = extractedText.split(Regex("\\s+")).size,
            createdAt = LocalDateTime.now(), updatedAt = LocalDateTime.now()
        ))
        return mapOf("lessonId" to content.id, "title" to title, "originalFilename" to originalName, "status" to "READY")
    }

    @GetMapping("/lessons/{lessonId}")
    fun getLesson(@PathVariable lessonId: Long): Map<String, Any> {
        val c = contentRepository.findById(lessonId)
            .orElseThrow { ResponseStatusException(HttpStatus.NOT_FOUND, "Lesson not found") }
        val text = c.simplifiedText ?: ""

        val sections = try {
            if (text.startsWith("{")) {
                val json = objectMapper.readTree(text)
                if (json.has("lesson") && json.get("lesson").has("sections")) {
                    json.get("lesson").get("sections").map { section ->
                        mapOf(
                            "heading" to (section.get("header")?.asText() ?: section.get("heading")?.asText() ?: "Section"),
                            "body" to (section.get("content")?.asText() ?: section.get("body")?.asText() ?: "")
                        )
                    }
                } else emptyList()
            } else emptyList()
        } catch (e: Exception) { emptyList() }

        val displaySections = if (sections.isNotEmpty()) sections else {
            text.split(Regex("(?<=[.!?])\\s+"))
                .filter { it.isNotBlank() }
                .mapIndexed { i, p -> mapOf("heading" to "Section ${i+1}", "body" to p.trim()) }
        }
        return mapOf("id" to c.id, "title" to (c.title ?: "Untitled"), "status" to c.status.name, "sections" to displaySections)
    }

    @GetMapping("/list")
    fun listAll(): List<Map<String, Any>> {
        return contentRepository.findAll().map { c ->
            mapOf("id" to c.id, "title" to (c.title ?: "Untitled"), "status" to c.status.name)
        }
    }
}

