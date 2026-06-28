package com.elekeza.backend.content

import com.elekeza.backend.auth.User
import com.elekeza.backend.common.ai.*
import com.elekeza.backend.learner.LessonProgressRepository
import org.slf4j.LoggerFactory
import org.springframework.beans.factory.annotation.Value
import org.springframework.data.domain.PageRequest
import org.springframework.http.HttpStatus
import org.springframework.http.MediaType
import org.springframework.http.ResponseEntity
import org.springframework.scheduling.annotation.Async
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.bind.annotation.*
import org.springframework.web.multipart.MultipartFile
import org.springframework.web.server.ResponseStatusException
import java.nio.file.Files
import java.nio.file.Path
import java.nio.file.Paths
import java.time.LocalDateTime
import java.util.UUID

@RestController
@RequestMapping("/api/content")
class ContentController(
    private val contentRepository: ContentRepository,
    private val lessonRepository: LessonRepository,
    private val lessonSectionRepository: LessonSectionRepository,
    private val keyTermRepository: KeyTermRepository,
    private val lessonProgressRepository: LessonProgressRepository,
    private val aiClient: AiClient,
    @Value("\${app.upload-dir:uploads}") private val uploadDir: String
) {
    private val log = LoggerFactory.getLogger(javaClass)

    // â”€â”€ POST /api/content/upload/text â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    @PostMapping("/upload/text")
    fun uploadText(
        @RequestBody req: TextUploadRequest,
        @AuthenticationPrincipal user: User
    ): ResponseEntity<Map<String, Any>> {
        if (req.text.isBlank()) throw ResponseStatusException(HttpStatus.BAD_REQUEST, "Text is required")

        val title = req.title?.takeIf { it.isNotBlank() } ?: inferTitle(req.text)

        val content = contentRepository.save(Content(
            userId          = user.id,
            title           = title,
            originalFilename = null,
            filePath        = null,
            sneType         = req.sneType,
            status          = ContentStatus.PROCESSING,
            simplifiedText  = req.text,
            wordCount       = req.text.split("\\s+".toRegex()).size
        ))

        // Async: call AI pipeline, persist lesson + quiz
        processTextAsync(content.id, req.text, req.sneType)

        return ResponseEntity.accepted().body(mapOf(
            "contentId" to content.id,
            "status"    to "PROCESSING",
            "message"   to "Content is being processed by AI pipeline"
        ))
    }

    // â”€â”€ POST /api/content/upload/file â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    @PostMapping("/upload/file", consumes = [MediaType.MULTIPART_FORM_DATA_VALUE])
    fun uploadFile(
        @RequestPart("file") file: MultipartFile,
        @RequestPart("sneType", required = false) sneType: String?,
        @RequestPart("title", required = false) title: String?,
        @AuthenticationPrincipal user: User
    ): ResponseEntity<Map<String, Any>> {
        if (file.isEmpty) throw ResponseStatusException(HttpStatus.BAD_REQUEST, "File is empty")

        val ext = file.originalFilename?.substringAfterLast('.', "")?.lowercase() ?: ""
        val allowed = setOf("pdf", "docx", "doc", "txt", "png", "jpg", "jpeg", "webp")
        if (ext !in allowed) throw ResponseStatusException(HttpStatus.BAD_REQUEST, "Unsupported file type: $ext")

        // Save to disk
        val destDir = Paths.get(uploadDir, user.id.toString())
        Files.createDirectories(destDir)
        val filename = "${UUID.randomUUID()}.$ext"
        val dest = destDir.resolve(filename)
        file.transferTo(dest.toFile())

        val resolvedTitle = title?.takeIf { it.isNotBlank() }
            ?: file.originalFilename?.substringBeforeLast('.') ?: "Untitled"

        val content = contentRepository.save(Content(
            userId           = user.id,
            title            = resolvedTitle,
            originalFilename = file.originalFilename,
            filePath         = dest.toString(),
            sneType          = sneType,
            status           = ContentStatus.PROCESSING,
            wordCount        = null
        ))

        processFileAsync(content.id, dest, ext, sneType)

        return ResponseEntity.accepted().body(mapOf(
            "contentId" to content.id,
            "filename"  to (file.originalFilename ?: "unknown"),
            "status"    to "PROCESSING",
            "message"   to "File is being processed"
        ))
    }

    // â”€â”€ GET /api/content/lessons/{lessonId} â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    @GetMapping("/lessons/{lessonId}")
    fun getLesson(
        @PathVariable lessonId: Long,
        @AuthenticationPrincipal user: User
    ): ResponseEntity<LessonDetailDto> {
        val content = contentRepository.findById(lessonId).orElseThrow {
            ResponseStatusException(HttpStatus.NOT_FOUND, "Lesson $lessonId not found")
        }

        // Verify the requesting user has access (teacher who created it, or student assigned it)
        val hasAccess = content.userId == user.id ||
            lessonProgressRepository.findByUserIdAndContentId(user.id, lessonId) != null ||
            user.role.name == "TEACHER" || user.role.name == "ADMIN"

        if (!hasAccess) throw ResponseStatusException(HttpStatus.FORBIDDEN, "Access denied")

        if (content.status != ContentStatus.READY) {
            return ResponseEntity.status(HttpStatus.ACCEPTED).body(
                LessonDetailDto(
                    id     = lessonId,
                    title  = content.title ?: "",
                    status = content.status.name,
                    sections = emptyList(),
                    keyTerms = emptyList()
                )
            )
        }

        // Load lesson + sections + key terms from lesson tables
        val lesson = lessonRepository.findAll().firstOrNull { it.lesson_content_id == lessonId }
        if (lesson != null) {
            val sections = lessonSectionRepository.findAll()
                .filter { it.lesson.id == lesson.id }
                .sortedBy { it.sequenceNumber }
                .map { s -> SectionDto(
                    id      = s.id.toString(),
                    heading = s.content.lines().firstOrNull() ?: "",
                    body    = s.content.lines().drop(1).joinToString("\n").trim(),
                    order   = s.sequenceNumber
                )}
            val terms = keyTermRepository.findAll()
                .filter { it.lesson?.id == lesson.id }
                .map { k -> KeyTermDto(k.id.toString(), k.term, k.definition) }

            return ResponseEntity.ok(LessonDetailDto(
                id       = lessonId,
                title    = lesson.title,
                status   = ContentStatus.READY.name,
                sections = sections,
                keyTerms = terms
            ))
        }

        // Fallback: parse simplifiedText JSON if no lesson rows yet
        val parsed = parseFallbackSections(content.simplifiedText)
        return ResponseEntity.ok(LessonDetailDto(
            id       = lessonId,
            title    = content.title ?: "",
            status   = ContentStatus.READY.name,
            sections = parsed,
            keyTerms = emptyList()
        ))
    }

    // â”€â”€ GET /api/content/list â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    @GetMapping("/list")
    fun listContent(@AuthenticationPrincipal user: User): ResponseEntity<List<ContentListDto>> {
        val page = contentRepository.findByUserIdOrderByCreatedAtDesc(user.id, PageRequest.of(0, 50))
        return ResponseEntity.ok(page.content.map { it.toListDto() })
    }

    // â”€â”€ GET /api/content/status/{contentId} â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    @GetMapping("/status/{contentId}")
    fun getStatus(
        @PathVariable contentId: Long,
        @AuthenticationPrincipal user: User
    ): ResponseEntity<Map<String, Any>> {
        val content = contentRepository.findByIdAndUserId(contentId, user.id)
            ?: throw ResponseStatusException(HttpStatus.NOT_FOUND, "Content not found")
        return ResponseEntity.ok(mapOf("contentId" to contentId, "status" to content.status.name))
    }

    // â”€â”€ Async AI processing â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    @Async("taskExecutor")
    fun processTextAsync(contentId: Long, text: String, sneType: String?) {
        runCatching {
            log.info("AI processing text contentId=$contentId sneType=$sneType")
            val lessonJson = aiClient.simplifyText(SimplifyTextRequest(text = text, level = sneType ?: "standard"))
            val quizJson   = aiClient.generateQuiz(GenerateQuizRequest(content = text, questionCount = 5))
            persistAndMarkReady(contentId, lessonJson, quizJson)
        }.onFailure { ex ->
            log.error("AI text processing failed for contentId=$contentId: ${ex.message}")
            contentRepository.updateStatus(contentId, ContentStatus.FAILED)
        }
    }

    @Async("taskExecutor")
    fun processFileAsync(contentId: Long, filePath: Path, ext: String, sneType: String?) {
        runCatching {
            log.info("AI processing file contentId=$contentId ext=$ext")
            val text = extractText(filePath, ext)
            if (text.isBlank()) {
                contentRepository.updateStatus(contentId, ContentStatus.FAILED)
                return
            }
            val lessonJson = aiClient.simplifyText(SimplifyTextRequest(text = text, level = sneType ?: "standard"))
            val quizJson   = aiClient.generateQuiz(GenerateQuizRequest(content = text, questionCount = 5))
            contentRepository.updateSimplified(contentId, text, text.split("\\s+".toRegex()).size, ContentStatus.PROCESSING)
            persistAndMarkReady(contentId, lessonJson, quizJson)
        }.onFailure { ex ->
            log.error("AI file processing failed for contentId=$contentId: ${ex.message}")
            contentRepository.updateStatus(contentId, ContentStatus.FAILED)
        }
    }

    @Transactional
    fun persistAndMarkReady(contentId: Long, lessonJson: LessonJSON, quizJson: QuizJSON) {
        // Check if Lesson entity has a content_id FK (it joins on learner); skip lesson table for now
        // The content record is the source of truth for pilot; lesson_sections live under lessons
        // For pilot: store structured content in the content.simplified_text as JSON
        val structured = com.fasterxml.jackson.databind.ObjectMapper().writeValueAsString(mapOf(
            "title"    to lessonJson.title,
            "sections" to lessonJson.sections.map { mapOf("heading" to it.header, "body" to it.content) },
            "keyTerms" to lessonJson.terms.map { mapOf("term" to it.term, "definition" to it.definition) },
            "quiz"     to quizJson.questions.map { q -> mapOf(
                "question" to q.question,
                "options"  to q.options.map { mapOf("text" to it.text, "correct" to it.isCorrect) }
            )}
        ))
        val wc = lessonJson.sections.sumOf { it.content.split("\\s+".toRegex()).size }
        contentRepository.updateSimplified(contentId, structured, wc, ContentStatus.READY)
        log.info("Content $contentId marked READY â€” ${lessonJson.sections.size} sections, ${quizJson.questions.size} questions")
    }

    // â”€â”€ Internal helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    private fun extractText(path: Path, ext: String): String = when (ext) {
        "txt" -> Files.readString(path)
        "pdf" -> {
            org.apache.pdfbox.Loader.loadPDF(path.toFile()).use { doc ->
                org.apache.pdfbox.text.PDFTextStripper().getText(doc)
            }
        }
        "docx" -> {
            org.apache.poi.xwpf.usermodel.XWPFDocument(Files.newInputStream(path)).use { doc ->
                doc.paragraphs.joinToString("\n") { it.text }
            }
        }
        "doc" -> "" // legacy .doc not supported in pilot`n        
        else -> "" // images: AI service handles OCR via /process endpoint directly
    }

    private fun inferTitle(text: String): String =
        text.trim().lines().firstOrNull()?.take(60)?.trim() ?: "Untitled"

    @Suppress("UNCHECKED_CAST")
    private fun parseFallbackSections(simplified: String?): List<SectionDto> {
        if (simplified.isNullOrBlank()) return emptyList()
        return runCatching {
            val mapper = com.fasterxml.jackson.databind.ObjectMapper()
            val tree = mapper.readTree(simplified)
            val sections = tree["sections"] ?: return emptyList()
            sections.mapIndexed { i, s -> SectionDto(
                id      = "s$i",
                heading = s["heading"]?.asText() ?: s["header"]?.asText() ?: "",
                body    = s["body"]?.asText() ?: s["content"]?.asText() ?: "",
                order   = i + 1
            )}
        }.getOrDefault(emptyList())
    }
}

// â”€â”€ Response DTOs â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

data class LessonDetailDto(
    val id:       Long,
    val title:    String,
    val status:   String,
    val sections: List<SectionDto>,
    val keyTerms: List<KeyTermDto>
)

data class SectionDto(val id: String, val heading: String, val body: String, val order: Int)
data class KeyTermDto(val id: String, val term: String, val definition: String)

// Extension property â€” bridges Content entity to Lesson lookup
// Lesson.learner_id is UUID; for pilot we use content.id stored in lesson.rawText or a direct column
// NOTE: Add lesson_content_id BIGINT REFERENCES content(id) to lessons table (see V24 migration)
val com.elekeza.backend.content.Lesson.lesson_content_id: Long
    get() = runCatching { this.rawText.substringAfter("content_id:").substringBefore("\n").trim().toLong() }.getOrDefault(-1L)
