package com.elekeza.backend.content

import com.elekeza.backend.auth.User
import org.apache.pdfbox.Loader
import org.apache.pdfbox.text.PDFTextStripper
import org.apache.poi.xwpf.usermodel.XWPFDocument
import org.springframework.http.HttpStatus
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.web.bind.annotation.*
import org.springframework.web.multipart.MultipartFile
import org.springframework.web.server.ResponseStatusException
import java.time.LocalDateTime

@RestController
@RequestMapping("/api/content")
class ContentController(
    private val contentRepository: ContentRepository
) {
    data class UploadTextRequest(val title: String?, val subject: String?, val text: String)

    @PostMapping("/upload/text")
    fun uploadText(@RequestBody req: UploadTextRequest, @AuthenticationPrincipal user: User): Map<String, Any> {
        val title = req.title ?: "Untitled"
        val content = contentRepository.save(Content(
            userId = user.id, title = title, status = ContentStatus.READY,
            simplifiedText = req.text,
            wordCount = req.text.split(Regex("\\s+")).size,
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
            "txt" -> String(file.bytes)
            "pdf" -> Loader.loadPDF(file.bytes).use { PDFTextStripper().getText(it) }
            "docx" -> XWPFDocument(file.inputStream).use { doc -> doc.paragraphs.joinToString("\n") { it.text } }
            else -> throw ResponseStatusException(HttpStatus.BAD_REQUEST, "Unsupported file type: .$extension")
        }

        if (extractedText.isBlank()) throw ResponseStatusException(HttpStatus.BAD_REQUEST, "No readable text found")

        val content = contentRepository.save(Content(
            userId = user.id, title = title, originalFilename = originalName,
            status = ContentStatus.READY, simplifiedText = extractedText,
            wordCount = extractedText.split(Regex("\\s+")).size,
            createdAt = LocalDateTime.now(), updatedAt = LocalDateTime.now()
        ))
        return mapOf("lessonId" to content.id, "title" to title, "originalFilename" to originalName, "status" to "READY")
    }

    @GetMapping("/lessons/{lessonId}")
    fun getLesson(@PathVariable lessonId: Long): Map<String, Any> {
        val c = contentRepository.findById(lessonId)
            .orElseThrow { ResponseStatusException(HttpStatus.NOT_FOUND, "Lesson not found") }
        val paragraphs = (c.simplifiedText ?: "").split(Regex("(?<=[.!?])\\s+"))
        val sections = paragraphs.filter { it.isNotBlank() }.mapIndexed { i, p -> mapOf("heading" to "Section ${i+1}", "body" to p.trim()) }
        return mapOf("id" to c.id, "title" to (c.title ?: "Untitled"), "status" to c.status.name, "sections" to sections)
    }

    @GetMapping("/list")
    fun listAll(): List<Map<String, Any>> {
        return contentRepository.findAll().map { c ->
            mapOf("id" to c.id, "title" to (c.title ?: "Untitled"), "status" to c.status.name)
        }
    }
}
