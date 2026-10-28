package com.elekeza.backend.content

import com.elekeza.backend.content.ContentRepository
import com.elekeza.backend.testutil.ApiTestSupport
import com.elekeza.backend.testutil.HttpOutcome
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.mock.web.MockMultipartFile

/**
 * Sprint 3 regression: POST /api/content/upload/file used to ignore the
 * submitted `title` multipart field entirely and always named the lesson after
 * the original filename. Missing/blank titles still fall back to the filename
 * (matching the text-upload convention) and over-length titles are rejected.
 */
class ContentUploadTitleTest : ApiTestSupport() {

    @Autowired lateinit var contentRepo: ContentRepository

    private val uploadDir = java.io.File("uploads").absoluteFile
    private val createdFiles = mutableListOf<String>()
    private val createdContentIds = mutableListOf<Long>()

    @AfterEach
    fun tearDown() {
        createdContentIds.forEach { contentRepo.deleteById(it) }
        createdFiles.forEach { name ->
            val f = java.io.File(uploadDir, name)
            if (f.exists()) f.delete()
        }
        if (uploadDir.exists() && uploadDir.listFiles()?.isEmpty() == true) uploadDir.delete()
    }

    private fun upload(
        fileName: String,
        session: jakarta.servlet.http.Cookie,
        title: String? = null,
        content: String = "Some lesson body text."
    ): HttpOutcome {
        val file = MockMultipartFile("file", fileName, "text/plain", content.toByteArray())
        return multipartPost(
            "/api/content/upload/file", file, session,
            if (title != null) mapOf("title" to title) else emptyMap()
        )
    }

    @Test
    fun `explicit title is persisted and returned`() {
        val session = login("teacher@elekeza.app", "teacher123")
        val res = upload("notes-v1.txt", session, title = "Transport in Cells")
        assertThat(res.status).isEqualTo(200)
        val lessonId = res.body!!["lessonId"].asLong()
        createdContentIds += lessonId
        createdFiles += res.body!!["storageName"].asText()

        assertThat(res.body!!["title"].asText()).isEqualTo("Transport in Cells")
        val persisted = contentRepo.findById(lessonId).orElseThrow()
        assertThat(persisted.title).isEqualTo("Transport in Cells")
    }

    @Test
    fun `missing or blank title falls back to the filename`() {
        val session = login("teacher@elekeza.app", "teacher123")

        val noTitle = upload("biology-lesson.txt", session, title = null)
        assertThat(noTitle.status).isEqualTo(200)
        createdContentIds += noTitle.body!!["lessonId"].asLong()
        createdFiles += noTitle.body!!["storageName"].asText()
        assertThat(noTitle.body!!["title"].asText()).isEqualTo("biology-lesson.txt")

        val blankTitle = upload("chemistry-notes.txt", session, title = "   ")
        assertThat(blankTitle.status).isEqualTo(200)
        createdContentIds += blankTitle.body!!["lessonId"].asLong()
        createdFiles += blankTitle.body!!["storageName"].asText()
        assertThat(blankTitle.body!!["title"].asText()).isEqualTo("chemistry-notes.txt")
    }

    @Test
    fun `a title longer than 255 characters is rejected`() {
        val session = login("teacher@elekeza.app", "teacher123")
        val res = upload("long-title.txt", session, title = "x".repeat(256))
        assertThat(res.status).isEqualTo(400)
        assertThat(res.bodyText).contains("255")
        // Nothing may have been persisted.
        assertThat(contentRepo.findAll().none { it.title == "x".repeat(256) }).isTrue()
    }

    @Test
    fun `a 255-character title is accepted`() {
        val session = login("teacher@elekeza.app", "teacher123")
        val title = "y".repeat(255)
        val res = upload("boundary-title.txt", session, title = title)
        assertThat(res.status).isEqualTo(200)
        createdContentIds += res.body!!["lessonId"].asLong()
        createdFiles += res.body!!["storageName"].asText()
        assertThat(res.body!!["title"].asText()).isEqualTo(title)
    }
}
