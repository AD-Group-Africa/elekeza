package com.elekeza.backend.content

import com.elekeza.backend.testutil.ApiTestSupport
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.mock.web.MockMultipartFile

/**
 * Content creation is a teacher/school-admin capability. Learners must not be
 * able to create educational content through any upload path, and file uploads
 * stay role-guarded too.
 */
class ContentAuthorizationTest : ApiTestSupport() {

    @Autowired lateinit var contentRepo: ContentRepository

    private val createdContentIds = mutableListOf<Long>()

    @AfterEach
    fun tearDown() {
        createdContentIds.forEach { id -> contentRepo.findById(id).ifPresent { contentRepo.delete(it) } }
        userRepo.findByEmail("content-student-$random@test.app")?.let { userRepo.delete(it) }
    }

    @Test
    fun `student cannot upload text content`() {
        val student = createUser("content-student-$random@test.app", "Studpass1", "Content Student", com.elekeza.backend.auth.UserRole.STUDENT)
        val session = login(student.email, "Studpass1")
        val out = postJson(
            "/api/content/upload/text",
            """{"title":"Sneaky lesson","text":"should be rejected"}""",
            session
        )
        assertThat(out.status).isEqualTo(403)
    }

    @Test
    fun `student cannot upload files`() {
        val student = createUser("content-student-$random@test.app", "Studpass1", "Content Student", com.elekeza.backend.auth.UserRole.STUDENT)
        val session = login(student.email, "Studpass1")
        val file = MockMultipartFile("file", "notes.txt", "text/plain", "hello".toByteArray())
        val out = multipartPost("/api/content/upload/file", file, session)
        assertThat(out.status).isEqualTo(403)
    }

    @Test
    fun `teacher can upload text content`() {
        val session = login("teacher@elekeza.app", "teacher123")
        val out = postJson(
            "/api/content/upload/text",
            """{"title":"Teacher lesson","text":"A real lesson body for the auth test."}""",
            session
        )
        assertThat(out.status).isEqualTo(200)
        out.body?.get("lessonId")?.asLong()?.let { createdContentIds += it }
        assertThat(out.bodyText).contains("READY")
    }

    private val random: String get() = java.util.UUID.randomUUID().toString().take(8)
}
