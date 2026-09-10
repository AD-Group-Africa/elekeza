package com.elekeza.backend.auth

import com.elekeza.backend.testutil.HttpOutcome
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.http.MediaType
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders

/**
 * Forgot-password endpoint behaviour.
 *
 * The frontend links to /forgot-password and axios treats it as an auth page,
 * so this endpoint must not leak account-existence information and must fail
 * predictably when the email provider is not configured.
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
class ForgotPasswordEndpointTest {
    @Autowired lateinit var mockMvc: MockMvc

    private fun postAnonymousForgotPassword(json: String): HttpOutcome {
        return HttpOutcome(
            mockMvc.perform(
                MockMvcRequestBuilders.post("/api/auth/forgot-password")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(json)
            ).andReturn()
        )
    }

    @Test
    fun `registered email returns a uniform non-revealing message`() {
        val out = postAnonymousForgotPassword("""{"email":"student@elekeza.app"}""")
        assertThat(out.status).isEqualTo(200)
        assertThat(out.bodyText).contains("reset link has been sent")
    }

    @Test
    fun `unknown email returns the same uniform message and does not reveal existence`() {
        val out = postAnonymousForgotPassword("""{"email":"no-such-person@example.com"}""")
        assertThat(out.status).isEqualTo(200)
        assertThat(out.bodyText).contains("reset link has been sent")
    }

    @Test
    fun `malformed email body is rejected as 400`() {
        val out = postAnonymousForgotPassword("""{"email":""}""")
        assertThat(out.status).isEqualTo(400)
        assertThat(out.bodyText).contains("email")
    }

    @Test
    fun `missing email body is rejected as 400`() {
        val out = postAnonymousForgotPassword("""{}""")
        assertThat(out.status).isEqualTo(400)
    }

    @Test
    fun `malformed json body is rejected as 400`() {
        val out = postAnonymousForgotPassword("{not json")
        assertThat(out.status).isEqualTo(400)
        assertThat(out.bodyText).contains("Malformed request body")
    }
}