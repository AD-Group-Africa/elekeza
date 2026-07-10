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
    private val aiClient: AiClient,
    private val objectMapper: ObjectMapper
) {
    private val log = LoggerFactory.getLogger(javaClass)

    data class UploadTextRequest(
        val title: String? = null,
        val subject: String? = null,
        val text: String,
        val sneType: String? = null
    )

    // ── POST /api/content/upload/text ─────────────────────────────────────────

    @PostMapping("/upload/text")
    fun uploadText(
        @RequestBody req: UploadTextRequest,
        @AuthenticationPrincipal user: User
    ): Map<String, Any> {
        if (req.text.isBlank()) throw ResponseStatusException(HttpStatus.BAD_REQUEST, "Text is required")

        val title     = req.title?.takeIf { it.isNotBlank() } ?: req.text.lines().first().take(60).trim()
        val aiOutput  = runCatching {
            val lesson = aiClient.simplifyText(SimplifyTextRequest(text = req.text, level = req.sneType ?: "standard"))
            val quiz   = aiClient.generateQuiz(GenerateQuizRequest(content = req.text))
            objectMapper.writeValueAsString(mapOf("lesson" to lesson, "quiz" to quiz))
        }.onFailure { log.warn("AI failed for text upload: {}", it.message) }
         .getOrElse  { req.text }

        val content = contentRepository.save(Content(
            userId = user.id, title = title,
            status = ContentStatus.READY, simplifiedText = aiOutput,
            wordCount = req.text.split(Regex("\\s+")).size
        ))
        return mapOf("lessonId" to content.id, "title" to title, "status" to "READY")
    }

    // ── POST /api/content/upload/file ─────────────────────────────────────────

    @PostMapping("/upload/file")
    fun uploadFile(
        @RequestPart("file") file: MultipartFile,
        @RequestPart("title", required = false) titlePart: String?,
        @RequestPart("sneType", required = false) sneType: String?,
        @AuthenticationPrincipal user: User
    ): Map<String, Any> {
        val originalName = file.originalFilename ?: "upload"
        val ext   = originalName.substringAfterLast('.', "").lowercase()
        val title = titlePart?.takeIf { it.isNotBlank() }
            ?: originalName.substringBeforeLast('.')

        val extractedText = when (ext) {
            "txt"  -> String(file.bytes)
            "pdf"  -> Loader.loadPDF(file.bytes).use { PDFTextStripper().getText(it) }
            "docx" -> XWPFDocument(file.inputStream).use { doc ->
                           doc.paragraphs.joinToString("\n") { it.text }
                       }
            else   -> throw ResponseStatusException(HttpStatus.BAD_REQUEST, "Unsupported: .$ext")
        }
        if (extractedText.isBlank())
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, "No readable text found in file")

        val aiOutput = runCatching {
            val lesson = aiClient.simplifyText(SimplifyTextRequest(text = extractedText, level = sneType ?: "standard"))
            val quiz   = aiClient.generateQuiz(GenerateQuizRequest(content = extractedText))
            objectMapper.writeValueAsString(mapOf("lesson" to lesson, "quiz" to quiz))
        }.onFailure { log.warn("AI failed for file upload {}: {}", originalName, it.message) }
         .getOrElse  { extractedText }

        val content = contentRepository.save(Content(
            userId = user.id, title = title,
            originalFilename = originalName, sneType = sneType,
            status = ContentStatus.READY, simplifiedText = aiOutput,
            wordCount = extractedText.split(Regex("\\s+")).size
        ))
        return mapOf("lessonId" to content.id, "title" to title, "status" to "READY")
    }

    // ── GET /api/content/lessons/{id} ─────────────────────────────────────────

    @GetMapping("/lessons/{lessonId}")
    fun getLesson(@PathVariable lessonId: Long): Map<String, Any> {
        val c    = contentRepository.findById(lessonId)
            .orElseThrow { ResponseStatusException(HttpStatus.NOT_FOUND, "Lesson not found") }
        val text = c.simplifiedText ?: ""

        val (sections, keyTerms) = parseLessonJson(text)

        return mapOf(
            "id"       to c.id,
            "title"    to (c.title ?: "Untitled"),
            "status"   to c.status.name,
            "sections" to sections,
            "keyTerms" to keyTerms
        )
    }

    // ── GET /api/content/list ─────────────────────────────────────────────────

    @GetMapping("/list")
    fun listAll(@AuthenticationPrincipal user: User): List<Map<String, Any>> =
        contentRepository.findAll()
            // Teachers see only their own; admins see all
            .filter { user.role.name == "ADMIN" || it.userId == user.id }
            .sortedByDescending { it.createdAt }
            .map { c -> mapOf(
                "id"     to c.id,
                "title"  to (c.title ?: "Untitled"),
                "status" to c.status.name,
                "sneType" to (c.sneType ?: "NONE")
            )}

    // ── GET /api/content/status/{id} ──────────────────────────────────────────

    @GetMapping("/status/{id}")
    fun getStatus(@PathVariable id: Long): Map<String, Any> {
        val c = contentRepository.findById(id)
            .orElseThrow { ResponseStatusException(HttpStatus.NOT_FOUND, "Not found") }
        return mapOf("id" to c.id, "status" to c.status.name)
    }

    // ── Private ───────────────────────────────────────────────────────────────

    private fun parseLessonJson(text: String): Pair<List<Map<String, Any>>, List<Map<String, Any>>> {
        if (!text.trimStart().startsWith("{"))
            return fallbackSections(text) to emptyList()

        return runCatching {
            val tree   = objectMapper.readTree(text)
            val lesson = tree["lesson"] ?: tree

            val sections = lesson["sections"]?.map { s ->
                mapOf(
                    "heading" to (s["header"]?.asText() ?: s["heading"]?.asText() ?: ""),
                    "body"    to (s["content"]?.asText() ?: s["body"]?.asText() ?: "")
                )
            } ?: emptyList()

            val keyTerms = lesson["terms"]?.map { t ->
                mapOf("term" to (t["term"]?.asText() ?: ""), "definition" to (t["definition"]?.asText() ?: ""))
            } ?: emptyList()

            (sections.ifEmpty { fallbackSections(lesson["rawText"]?.asText() ?: text) }) to keyTerms
        }.getOrElse { fallbackSections(text) to emptyList() }
    }

    private fun fallbackSections(text: String): List<Map<String, Any>> =
        text.split(Regex("(?<=[.!?])\\s+"))
            .filter { it.isNotBlank() }
            .mapIndexed { i, p -> mapOf("heading" to "Part ${i + 1}", "body" to p.trim()) }
}
