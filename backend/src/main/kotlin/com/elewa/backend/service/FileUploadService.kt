package com.elewa.backend.service

import com.elewa.backend.dto.LessonResponse
import com.elewa.backend.dto.TextUploadRequest
import org.apache.pdfbox.pdmodel.PDDocument
import org.apache.pdfbox.text.PDFTextStripper
import org.apache.poi.xwpf.usermodel.XWPFDocument
import org.apache.poi.hwpf.HWPFDocument
import org.springframework.stereotype.Service
import org.springframework.web.multipart.MultipartFile
import java.util.UUID

private val SUPPORTED_TYPES = setOf(
    "text/plain",
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
)

private const val MAX_BYTES = 10 * 1024 * 1024L // 10 MB

@Service
class FileUploadService(
    private val contentService: ContentService
) {

    fun uploadFile(learnerId: UUID, file: MultipartFile): LessonResponse {
        // Validate: not empty
        if (file.isEmpty) throw IllegalArgumentException("File is empty.")

        // Validate: size
        if (file.size > MAX_BYTES) throw IllegalArgumentException("File exceeds 10 MB limit.")

        // Validate: MIME type
        val mime = file.contentType?.lowercase()?.trim() ?: ""
        if (mime !in SUPPORTED_TYPES) {
            throw IllegalArgumentException(
                "Unsupported file type '$mime'. Supported types: text/plain, application/pdf, .doc, .docx"
            )
        }

        // Extract text
        val text = when {
            mime == "text/plain" -> file.inputStream.bufferedReader(Charsets.UTF_8).readText()
            mime == "application/pdf" -> extractPdf(file)
            mime == "application/msword" -> extractDoc(file)
            mime.contains("wordprocessingml") -> extractDocx(file)
            else -> throw IllegalArgumentException("Cannot extract text from type '$mime'.")
        }.trim()

        if (text.length < 50) throw IllegalArgumentException(
            "Could not extract enough text from file (got ${text.length} chars, need at least 50)."
        )

        // Reuse existing text upload pipeline
        return contentService.uploadText(learnerId, TextUploadRequest(text = text))
    }

    private fun extractPdf(file: MultipartFile): String {
        return PDDocument.load(file.inputStream).use { doc ->
            PDFTextStripper().getText(doc)
        }
    }

    private fun extractDocx(file: MultipartFile): String {
        return XWPFDocument(file.inputStream).use { doc ->
            doc.paragraphs.joinToString("\n") { it.text }
        }
    }

    private fun extractDoc(file: MultipartFile): String {
        return HWPFDocument(file.inputStream).use { doc ->
            doc.range.text()
        }
    }
}