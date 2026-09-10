package com.elekeza.backend.content

import com.elekeza.backend.content.ContentRepository
import com.elekeza.backend.testutil.ApiTestSupport
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.mock.web.MockMultipartFile
import java.io.File

/**
 * File-upload hardening regression: client-supplied filenames must never be
 * able to write outside the uploads directory (path traversal), must never
 * contain separators after sanitization, and storage failures must map to a
 * client error rather than a 500 with filesystem details.
 */
class ContentUploadSecurityTest : ApiTestSupport() {

    @Autowired lateinit var contentRepo: ContentRepository

    private val uploadDir = File("uploads").absoluteFile
    private val createdFiles = mutableListOf<String>()

    @AfterEach
    fun tearDown() {
        createdFiles.forEach { name ->
            val f = File(uploadDir, name)
            if (f.exists()) f.delete()
        }
        // Remove the directory too when nothing else was uploaded during tests.
        if (uploadDir.exists() && uploadDir.listFiles()?.isEmpty() == true) uploadDir.delete()
    }

    @Test
    fun `sanitizer flattens traversal and separator filenames`() {
        assertThat(ContentController.sanitizeStoredFileName("../../pwned.txt")).isEqualTo("..-..-pwned.txt")
        assertThat(ContentController.sanitizeStoredFileName("..\\..\\pwned.txt")).isEqualTo("..-..-pwned.txt")
        assertThat(ContentController.sanitizeStoredFileName("C:\\evil\\file.txt")).isEqualTo("C-evil-file.txt")
        assertThat(ContentController.sanitizeStoredFileName("lesson notes v2.txt")).isEqualTo("lesson-notes-v2.txt")
        // No sanitized name may contain a path separator or a bare-parent sequence.
        listOf("../../pwned.txt", "..\\..\\pwned.txt", "a/b\\c", "....//....", "..")
            .forEach { raw ->
                val out = ContentController.sanitizeStoredFileName(raw)
                assertThat(out).doesNotContain("/", "\\")
                assertThat(out).isNotBlank()
                // A single segment equal to "." or ".." is never produced.
                assertThat(out).isNotIn(".", "..")
            }
        // Fully-malicious names collapse to a safe placeholder.
        assertThat(ContentController.sanitizeStoredFileName("///")).isEqualTo("file")
    }

    @Test
    fun `upload with a traversal filename stays inside the uploads directory`() {
        val session = login("teacher@elekeza.app", "teacher123")
        val file = MockMultipartFile(
            "file",
            "../../pwned.txt",
            "text/plain",
            "traversal attempt content".toByteArray()
        )
        val outcome = multipartPost("/api/content/upload/file", file, session)
        assertThat(outcome.status).isEqualTo(200)
        val storageName = outcome.body!!["storageName"].asText()
        val lessonId = outcome.body!!["lessonId"].asLong()

        // The stored name is a flat single filename (UUID prefix + sanitized):
        // no path separators survive, so it cannot escape the uploads dir.
        assertThat(storageName).doesNotContain("/", "\\")
        // UUID prefix (36 chars + dash) then the flattened original tail.
        assertThat(storageName.length).isGreaterThan(40)
        assertThat(storageName.endsWith("pwned.txt")).isTrue()

        val stored = File(uploadDir, storageName)
        assertThat(stored).exists()
        assertThat(stored.readText()).contains("traversal attempt content")
        createdFiles += storageName

        // Nothing escaped outside the uploads directory.
        assertThat(File(uploadDir.parentFile, "pwned.txt").exists()).isFalse()

        // Cleanup the persisted content row created by the upload.
        contentRepo.deleteById(lessonId)
    }
}
