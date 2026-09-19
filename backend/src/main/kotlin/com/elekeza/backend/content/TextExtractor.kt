package com.elekeza.backend.content

import org.slf4j.LoggerFactory
import org.springframework.stereotype.Component
import org.springframework.web.multipart.MultipartFile

/**
 * Extracts plain text from supported upload formats so file-based content can
 * flow through the same AI adaptation pipeline as pasted text. Unsupported or
 * unreadable files return null — the upload still succeeds, it simply cannot
 * be adapted until the file is re-uploaded in a supported format.
 */
@Component
class TextExtractor {
    private val log = LoggerFactory.getLogger(javaClass)

    fun extract(file: MultipartFile, extension: String): String? = try {
        when (extension.lowercase()) {
            "txt" -> file.inputStream.bufferedReader().use { it.readText() }
            "pdf" -> extractPdf(file)
            "docx" -> extractDocx(file)
            "doc" -> extractDoc(file)
            else -> null
        }?.trim()?.takeIf { it.isNotBlank() }
    } catch (e: Exception) {
        log.warn("Text extraction failed for {}: {}", file.originalFilename, e.message)
        null
    }

    private fun extractPdf(file: MultipartFile): String {
        val doc = org.apache.pdfbox.Loader.loadPDF(file.bytes)
        return doc.use { org.apache.pdfbox.text.PDFTextStripper().getText(it) }
    }

    private fun extractDocx(file: MultipartFile): String {
        val doc = org.apache.poi.xwpf.usermodel.XWPFDocument(file.inputStream)
        return org.apache.poi.xwpf.extractor.XWPFWordExtractor(doc).use { it.text }
    }

    private fun extractDoc(file: MultipartFile): String {
        val doc = org.apache.poi.hwpf.HWPFDocument(file.inputStream)
        return org.apache.poi.hwpf.extractor.WordExtractor(doc).use { it.text }
    }
}
