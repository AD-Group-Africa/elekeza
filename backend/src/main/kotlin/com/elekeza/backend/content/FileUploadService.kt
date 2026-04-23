package com.elekeza.backend.content

import org.apache.pdfbox.Loader
import org.apache.pdfbox.text.PDFTextStripper
import org.apache.poi.xwpf.usermodel.XWPFDocument
import org.springframework.stereotype.Service
import org.springframework.web.multipart.MultipartFile

private val SUPPORTED_TYPES = setOf(
    "text/plain",
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
)
private const val MAX_BYTES = 10 * 1024 * 1024L

@Service
class FileUploadService(
    private val contentService: ContentService
) {
    fun uploadFile(userId: Long, file: MultipartFile): Content {
        if (file.isEmpty) throw IllegalArgumentException("File is empty.")
        if (file.size > MAX_BYTES) throw IllegalArgumentException("File exceeds 10 MB limit.")

        val mime = file.contentType?.lowercase()?.trim() ?: ""
        if (mime !in SUPPORTED_TYPES)
            throw IllegalArgumentException("Unsupported file type '$mime'.")

        return contentService.upload(userId, file, null)
    }

    fun extractText(file: MultipartFile): String {
        val mime = file.contentType?.lowercase()?.trim() ?: ""
        return when {
            mime == "text/plain"          -> file.inputStream.bufferedReader(Charsets.UTF_8).readText()
            mime == "application/pdf"     -> Loader.loadPDF(file.bytes).use { PDFTextStripper().getText(it) }
            mime.contains("wordprocessingml") -> XWPFDocument(file.inputStream).use { doc ->
                doc.paragraphs.joinToString("\n") { it.text }
            }
            else -> throw IllegalArgumentException("Cannot extract text from '$mime'.")
        }.trim()
    }
}