package com.elekeza.backend.auth

import com.elekeza.backend.common.MockEmailProvider
import com.elekeza.backend.testutil.HttpOutcome
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.http.MediaType
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders
import java.util.regex.Pattern

/**
 * Complete password-reset lifecycle, exercised over real HTTP:
 *
 *   forgot-password → token (captured from the mock provider's email) →
 *   reset-password → login with the new password.
 *
 * Security behaviour under test:
 *  - the response of forgot-password never reveals account existence
 *  - reset rejects unknown, reused (single-use) and invalid tokens
 *  - the new password must satisfy the same policy as registration
 *  - a successful reset lets the user log in with the new password only
 */
@SpringBootTest(
    properties = [
        "spring.profiles.active=dev",
        "ai.client.type=mock",
        "ai.internal-secret=test-internal-secret",
        "spring.datasource.url=jdbc:h2:mem:elekeza;DB_CLOSE_DELAY=-1;MODE=PostgreSQL",
        "spring.datasource.username=sa",
        "spring.datasource.password=",
        "email.provider=mock",
        "frontend.url=http://localhost:3000",
    ]
)
@AutoConfigureMockMvc
class PasswordResetLifecycleTest {
    @Autowired lateinit var mockMvc: MockMvc
    @Autowired lateinit var mockEmailProvider: MockEmailProvider
    @Autowired lateinit var userRepo: UserRepository
    @Autowired lateinit var passwordEncoder: org.springframework.security.crypto.password.PasswordEncoder

    private fun post(path: String, json: String): HttpOutcome =
        HttpOutcome(
            mockMvc.perform(
                MockMvcRequestBuilders.post(path)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(json)
            ).andReturn()
        )

    private fun extractResetToken(email: String): String {
        val record = mockEmailProvider.getSentEmails().lastOrNull { it.to == email && it.subject == "Password Reset" }
            ?: error("No reset email found for $email")
        val matcher = Pattern.compile("token=([A-Za-z0-9_\\-]+)").matcher(record.body)
        assertThat(matcher.find()).isTrue()
        return matcher.group(1)
    }

    private fun createSeedUser(email: String): User =
        userRepo.save(
            User(
                email = email,
                name = "Reset Tester",
                password = passwordEncoder.encode("oldpassword1"),
                role = UserRole.STUDENT,
            )
        )

    @Test
    fun `complete lifecycle - forgot to token to reset to login`() {
        val email = "reset-lifecycle-${System.nanoTime()}@example.com"
        createSeedUser(email)

        val forgot = post("/api/auth/forgot-password", """{"email":"$email"}""")
        assertThat(forgot.status).isEqualTo(200)

        val token = extractResetToken(email)
        val reset = post("/api/auth/reset-password", """{"token":"$token","newPassword":"newpassword99"}""")
        assertThat(reset.status).isEqualTo(200)
        assertThat(reset.bodyText).contains("has been reset")

        // Login with the NEW password succeeds; the OLD one is dead.
        assertThat(post("/api/auth/login", """{"email":"$email","password":"newpassword99"}""").status).isEqualTo(200)
        assertThat(post("/api/auth/login", """{"email":"$email","password":"oldpassword1"}""").status).isEqualTo(401)
    }

    @Test
    fun `reset tokens are single-use`() {
        val email = "reset-single-${System.nanoTime()}@example.com"
        createSeedUser(email)
        post("/api/auth/forgot-password", """{"email":"$email"}""")
        val token = extractResetToken(email)
        post("/api/auth/reset-password", """{"token":"$token","newPassword":"newpassword99"}""")

        // Second attempt with the same token must fail...
        val reuse = post("/api/auth/reset-password", """{"token":"$token","newPassword":"anotherpass77"}""")
        assertThat(reuse.status).isEqualTo(400)

        // ...and must NOT have changed the password again.
        assertThat(post("/api/auth/login", """{"email":"$email","password":"anotherpass77"}""").status).isEqualTo(401)
        assertThat(post("/api/auth/login", """{"email":"$email","password":"newpassword99"}""").status).isEqualTo(200)
    }

    @Test
    fun `unknown token is rejected with the generic message`() {
        val out = post("/api/auth/reset-password", """{"token":"not-a-real-token","newPassword":"newpassword99"}""")
        assertThat(out.status).isEqualTo(400)
        assertThat(out.bodyText).contains("invalid or has expired")
    }

    @Test
    fun `issuing a second reset invalidates the first token`() {
        val email = "reset-supersede-${System.nanoTime()}@example.com"
        createSeedUser(email)
        post("/api/auth/forgot-password", """{"email":"$email"}""")
        val first = extractResetToken(email)
        post("/api/auth/forgot-password", """{"email":"$email"}""")
        val second = extractResetToken(email)

        assertThat(post("/api/auth/reset-password", """{"token":"$first","newPassword":"newpassword99"}""").status)
            .isEqualTo(400)
        assertThat(post("/api/auth/reset-password", """{"token":"$second","newPassword":"newpassword99"}""").status)
            .isEqualTo(200)
    }

    @Test
    fun `weak new password is rejected`() {
        val email = "reset-weak-${System.nanoTime()}@example.com"
        createSeedUser(email)
        post("/api/auth/forgot-password", """{"email":"$email"}""")
        val token = extractResetToken(email)
        assertThat(post("/api/auth/reset-password", """{"token":"$token","newPassword":"short"}""").status).isEqualTo(400)
        assertThat(post("/api/auth/reset-password", """{"token":"$token","newPassword":"nodigitshere"}""").status).isEqualTo(400)
        // The token is still consumable after failed validation attempts.
        assertThat(post("/api/auth/reset-password", """{"token":"$token","newPassword":"goodpassword22"}""").status)
            .isEqualTo(200)
    }

    @Test
    fun `forgot-password for unknown email stays uniform and sends nothing`() {
        val before = mockEmailProvider.getSentEmails().size
        val out = post("/api/auth/forgot-password", """{"email":"ghost-${System.nanoTime()}@example.com"}""")
        assertThat(out.status).isEqualTo(200)
        assertThat(out.bodyText).contains("If that email is registered")
        assertThat(mockEmailProvider.getSentEmails().size).isEqualTo(before)
    }
}
