package com.elewa.backend.service

import com.elewa.backend.dto.LessonResponse
import com.elewa.backend.dto.TextUploadRequest
import org.apache.pdfbox.Loader
import org.apache.pdfbox.text.PDFTextStripper
import org.apache.poi.xwpf.usermodel.XWPFDocument
import org.springframework.stereotype.Service
import org.springframework.web.multipart.MultipartFile
import java.util.UUID

private val SUPPORTED_TYPES = setOf(
    "text/plain",
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
)

private const val MAX_BYTES = 10 * 1024 * 1024L // 10 MB

@Service
class FileUploadService(
    private val contentService: ContentService
) {

    fun uploadFile(learnerId: UUID, file: MultipartFile): LessonResponse {
        if (file.isEmpty) throw IllegalArgumentException("File is empty.")
        if (file.size > MAX_BYTES) throw IllegalArgumentException("File exceeds 10 MB limit.")

        val mime = file.contentType?.lowercase()?.trim() ?: ""
        if (mime !in SUPPORTED_TYPES) {
            throw IllegalArgumentException(
                "Unsupported file type '$mime'. Supported: text/plain, application/pdf, .docx"
            )
        }

        val text = when {
            mime == "text/plain" -> file.inputStream.bufferedReader(Charsets.UTF_8).readText()
            mime == "application/pdf" -> extractPdf(file)
            mime.contains("wordprocessingml") -> extractDocx(file)
            else -> throw IllegalArgumentException("Cannot extract text from '$mime'.")
        }.trim()

        if (text.length < 50) throw IllegalArgumentException(
            "Could not extract enough text from file (got ${text.length} chars, need at least 50)."
        )

        return contentService.uploadText(learnerId, TextUploadRequest(text = text))
    }

    private fun extractPdf(file: MultipartFile): String {
        // pdfbox 3.x uses Loader.loadPDF()
        return Loader.loadPDF(file.bytes).use { doc ->
            PDFTextStripper().getText(doc)
        }
    }

    private fun extractDocx(file: MultipartFile): String {
        return XWPFDocument(file.inputStream).use { doc ->
            doc.paragraphs.joinToString("\n") { it.text }
        }
    }
}