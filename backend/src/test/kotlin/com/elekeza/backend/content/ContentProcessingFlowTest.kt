package com.elekeza.backend.content

import com.elekeza.backend.auth.User
import com.elekeza.backend.auth.UserRepository
import com.elekeza.backend.auth.UserRole
import com.fasterxml.jackson.databind.ObjectMapper
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.security.crypto.password.PasswordEncoder

/**
 * Regression coverage for the teacher content chain:
 * upload → stored raw text → status READY → learner-facing lesson view.
 * Runs with the mock AI client, so no external service is involved.
 */
@SpringBootTest(
    properties = [
        "spring.profiles.active=dev",
        "ai.client.type=mock",
        "ai.internal-secret=test-internal-secret",
        // Tests are authored against the dev profile's in-memory H2 demo seed.
        // Pin the datasource explicitly so ambient SPRING_DATASOURCE_* env vars
        // (e.g. GitLab CI's Postgres service) cannot redirect the context.
        "spring.datasource.url=jdbc:h2:mem:elekeza;DB_CLOSE_DELAY=-1;MODE=PostgreSQL",
        "spring.datasource.username=sa",
        "spring.datasource.password=",
    ]
)
class ContentProcessingFlowTest {

    @Autowired lateinit var contentRepository: ContentRepository
    @Autowired lateinit var userRepository: UserRepository
    @Autowired lateinit var passwordEncoder: PasswordEncoder
    @Autowired lateinit var processingService: ContentProcessingService
    @Autowired lateinit var objectMapper: ObjectMapper

    private val createdEmails = mutableListOf<String>()
    private val createdContentIds = mutableListOf<Long>()

    @AfterEach
    fun tearDown() {
        createdContentIds.forEach { contentRepository.deleteById(it) }
        createdEmails.forEach { userRepository.findByEmail(it)?.let { u -> userRepository.delete(u) } }
    }

    private fun teacher(): User {
        val email = "content-flow-teacher-${System.nanoTime()}@elekeza.app"
        val user = userRepository.save(
            User(email = email, name = "Content Flow Teacher", password = passwordEncoder.encode("Passw0rd!"), role = UserRole.TEACHER)
        )
        createdEmails += email
        return user
    }

    @Test
    fun `uploaded text is persisted, marked ready and readable via the lesson view`() {
        val teacher = teacher()
        val source = "Photosynthesis is how plants turn sunlight into food. " +
            "Leaves absorb light and use water and carbon dioxide. " +
            "They produce glucose and release oxygen."

        val saved = contentRepository.save(Content(
            userId = teacher.id,
            title = "Photosynthesis",
            status = ContentStatus.UPLOADING,
            rawText = source,
            wordCount = source.split(Regex("\\s+")).size
        ))
        createdContentIds += saved.id

        val result = processingService.process(saved.id, sneType = null)

        assertThat(result.adapted).isFalse()
        val current = contentRepository.findById(saved.id).orElseThrow()
        assertThat(current.status).isEqualTo(ContentStatus.READY)
        assertThat(current.rawText).isEqualTo(source)

        // Lesson view must surface the raw source as readable sections even
        // before any AI adaptation (mock mode).
        val view = LessonView.render(current, objectMapper)
        assertThat(view["id"]).isEqualTo(saved.id)
        @Suppress("UNCHECKED_CAST")
        val sections = view["sections"] as List<Map<String, Any>>
        assertThat(sections.map { it["body"] }).contains(source)
    }
}
