package com.elekeza.backend.content

import com.elekeza.backend.auth.User
import com.fasterxml.jackson.databind.ObjectMapper
import org.slf4j.LoggerFactory
import org.springframework.http.HttpStatus
import org.springframework.security.access.prepost.PreAuthorize
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.web.bind.annotation.*
import org.springframework.web.multipart.MultipartFile
import org.springframework.web.server.ResponseStatusException
import java.io.File
import java.util.UUID

@RestController
@RequestMapping("/api/content")
class ContentController(
    private val contentRepository: ContentRepository,
    private val processingService: ContentProcessingService,
    private val textExtractor: TextExtractor,
    private val objectMapper: ObjectMapper,
    private val accessGuard: ContentAccessGuard
) {

    private val logger = LoggerFactory.getLogger(javaClass)

    // Allowed file types for upload
    private val ALLOWED_EXTENSIONS = setOf(
        "pdf", "doc", "docx", "txt", "rtf", "odt",
        "png", "jpg", "jpeg", "gif", "svg", "bmp"
    )

    private val MAX_FILE_SIZE = 10L * 1024 * 1024 // 10 MB

    // ── POST /api/content/upload/text ──────────────────────────────────────
    // Educational content is created by teachers/school admins — learners
    // consume it. Role-guard matches the file-upload path below.
    @PostMapping("/upload/text")
    @PreAuthorize("hasAnyRole('TEACHER', 'SCHOOL_ADMIN', 'ADMIN')")
    fun uploadText(
        @RequestBody req: UploadTextRequest,
        @AuthenticationPrincipal user: User
    ): Map<String, Any> {
        if (req.text.isBlank()) throw ResponseStatusException(HttpStatus.BAD_REQUEST, "Text is required")

        val title = req.title?.takeIf { it.isNotBlank() } ?: req.text.lines().firstOrNull { it.isNotBlank() }?.take(60)?.trim() ?: "Untitled"

        val content = contentRepository.save(Content(
            userId = user.id,
            title = title,
            status = ContentStatus.UPLOADING,
            rawText = req.text.trim(),
            wordCount = req.text.split(Regex("\\s+")).size
        ))

        // Adapt synchronously: in mock mode this is instant; with a real AI
        // service it is the actual simplify + quiz-generation pipeline. Either
        // way content ends up READY and readable.
        val result = processingService.process(content.id, req.sneType)
        val current = contentRepository.findById(content.id).orElseThrow()
        return mapOf(
            "lessonId" to current.id,
            "title" to (current.title ?: title),
            "status" to current.status.name,
            "adapted" to result.adapted,
            "message" to result.message
        )
    }

    // Data class for the request
    data class UploadTextRequest(
        val title: String? = null,
        val text: String,
        val sneType: String? = null
    )

    companion object {
        /**
         * Reduces any client-supplied filename to a flat, filesystem-safe
         * name: path separators and control characters are removed, runs are
         * collapsed and a fully-malicious name falls back to "file". The
         * UUID prefix added by the caller guarantees uniqueness.
         */
        internal fun sanitizeStoredFileName(original: String): String {
            val flattened = original
                .replace(Regex("[^A-Za-z0-9._-]"), "-")
                .replace(Regex("-+"), "-")
                .trim('-')
            // Never emit a bare-parent or blank segment even when the caller
            // forgets the UUID prefix.
            return flattened.takeIf { it.isNotBlank() && it != "." && it != ".." } ?: "file"
        }
    }

    // ── POST /api/content/upload/file ──────────────────────────────────────
    @PostMapping("/upload/file")
    @PreAuthorize("hasAnyRole('TEACHER', 'SCHOOL_ADMIN', 'ADMIN')")
    fun uploadFile(
        @RequestParam("file") file: MultipartFile,
        @AuthenticationPrincipal user: User
    ): Map<String, Any> {
        // 1. Validate file size
        if (file.isEmpty) throw ResponseStatusException(HttpStatus.BAD_REQUEST, "File is empty")
        if (file.size > MAX_FILE_SIZE) throw ResponseStatusException(
            HttpStatus.REQUEST_ENTITY_TOO_LARGE,
            "File size exceeds maximum limit of ${MAX_FILE_SIZE / 1024 / 1024}MB"
        )

        // 2. Validate extension
        val originalFilename = file.originalFilename ?: "unknown"
        val extension = originalFilename.substringAfterLast(".").lowercase()
        if (extension !in ALLOWED_EXTENSIONS) {
            throw ResponseStatusException(
                HttpStatus.UNSUPPORTED_MEDIA_TYPE,
                "File type '$extension' is not allowed. Allowed types: ${ALLOWED_EXTENSIONS.joinToString(", ")}"
            )
        }

        // 3. Generate storage name (UUID + flattened original name) and save to local storage.
        // The stored name must never contain path separators or traversal
        // sequences: it is a single flat filename inside uploadDir, no matter
        // what the client supplied as the original filename.
        val sanitizedName = sanitizeStoredFileName(originalFilename)
        val storageName = UUID.randomUUID().toString() + "-" + sanitizedName
        val uploadDir = File("uploads")
        uploadDir.mkdirs()
        // Absolute target: MultipartFile.transferTo resolves relative paths
        // against Tomcat's temp repository, not the app's working directory.
        val targetPath = java.nio.file.Paths.get(uploadDir.absolutePath, storageName)
        try {
            file.transferTo(targetPath.toFile())
        } catch (e: java.io.IOException) {
            logger.warn("Could not store uploaded file '{}': {}", originalFilename, e.message)
            throw ResponseStatusException(
                HttpStatus.BAD_REQUEST,
                "The uploaded file could not be stored. Use a plain filename and try again."
            )
        }

        // 4. Extract readable text where the format allows it (txt/pdf/docx/doc)
        val rawText = textExtractor.extract(file, extension)
        val content = contentRepository.save(Content(
            userId = user.id,
            title = originalFilename.take(255),
            originalFilename = originalFilename,
            filePath = storageName,
            status = ContentStatus.UPLOADING,
            rawText = rawText,
            wordCount = rawText?.split(Regex("\\s+"))?.size ?: 0
        ))

        val result = processingService.process(content.id, sneType = null)
        val current = contentRepository.findById(content.id).orElseThrow()
        return mapOf(
            "lessonId" to current.id,
            "fileId" to current.id,
            "storageName" to storageName,
            "originalName" to originalFilename,
            "size" to file.size,
            "title" to (current.title ?: originalFilename),
            "status" to current.status.name,
            "adapted" to result.adapted,
            "message" to result.message
        )
    }

    // ── GET /api/content/list ───────────────────────────────────────────────
    @GetMapping("/list")
    fun listAll(@AuthenticationPrincipal user: User): List<Map<String, Any>> =
        contentRepository.findAll()
            .filter { user.role.name == "ADMIN" || it.userId == user.id }
            .sortedByDescending { it.createdAt }
            .map { c -> mapOf(
                "id" to c.id,
                "title" to (c.title ?: "Untitled"),
                "status" to c.status.name
            )}

    // ── GET /api/content/lessons/{id} ───────────────────────────────────────
    /** Lesson page payload — adapted sections/key terms, or the raw source text. */
    @GetMapping("/lessons/{id}")
    fun getLesson(@PathVariable id: Long, @AuthenticationPrincipal user: User): Map<String, Any?> {
        val content = contentRepository.findById(id)
            .orElseThrow { ResponseStatusException(HttpStatus.NOT_FOUND, "Lesson not found") }
        accessGuard.requireAccess(user, content)
        return LessonView.render(content, objectMapper)
    }

    // ── GET /api/content/status/{id} ────────────────────────────────────────
    @GetMapping("/status/{id}")
    fun getStatus(@PathVariable id: Long, @AuthenticationPrincipal user: User): Map<String, Any> {
        val c = contentRepository.findById(id)
            .orElseThrow { ResponseStatusException(HttpStatus.NOT_FOUND, "Not found") }
        accessGuard.requireAccess(user, c)
        return mapOf("id" to c.id, "status" to c.status.name)
    }
}
