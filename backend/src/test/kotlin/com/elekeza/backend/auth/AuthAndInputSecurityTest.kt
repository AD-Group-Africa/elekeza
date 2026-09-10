package com.elekeza.backend.auth

import com.elekeza.backend.testutil.ApiTestSupport
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders

@SpringBootTest(
    properties = [
        "spring.profiles.active=dev",
        "ai.client.type=mock",
        "ai.internal-secret=test-internal-secret",
        "spring.datasource.url=jdbc:h2:mem:elekeza;DB_CLOSE_DELAY=-1;MODE=PostgreSQL",
        "spring.datasource.username=sa",
        "spring.datasource.password=",
        // Tight rate-limit window so the recovery path is testable quickly.
        "app.login-rate-limit.max-attempts=3",
        "app.login-rate-limit.window-seconds=1",
    ]
)
class AuthAndInputSecurityTest : ApiTestSupport() {

    @Autowired lateinit var rateLimiter: LoginRateLimiter
    @Autowired lateinit var refreshTokenRepo: RefreshTokenRepository

    private val createdEmails = mutableListOf<String>()

    @BeforeEach
    fun resetLimits() = rateLimiter.clear()

    @AfterEach
    fun tearDown() {
        rateLimiter.clear()
        createdEmails.forEach { email ->
            userRepo.findByEmail(email)?.let { u ->
                refreshTokenRepo.deleteByUser(u)
                userRepo.delete(u)
            }
        }
    }

    private fun register(email: String, password: String, name: String = "Test User", terms: Boolean = true): Pair<Int, String> {
        val res = mockMvc.perform(
            MockMvcRequestBuilders.post("/api/auth/register")
                .contentType(org.springframework.http.MediaType.APPLICATION_JSON)
                .content(
                    """{"email":"$email","password":"$password","name":"$name","termsAccepted":$terms}"""
                )
        ).andReturn()
        if (res.response.status == 201) createdEmails += email.lowercase().trim()
        return res.response.status to res.response.contentAsString
    }

    // ── Registration / password validation ─────────────────────────────────

    @Test
    fun `short password is rejected`() {
        val (status, body) = register("shortpw-$random@test.app", "Ab1")
        assertThat(status).isEqualTo(400)
        assertThat(body).contains("at least 8 characters")
    }

    @Test
    fun `password without a digit is rejected`() {
        val (status, _) = register("nodigit-$random@test.app", "onlyletters")
        assertThat(status).isEqualTo(400)
    }

    @Test
    fun `password without a letter is rejected`() {
        val (status, _) = register("noletter-$random@test.app", "12345678")
        assertThat(status).isEqualTo(400)
    }

    @Test
    fun `malformed email is rejected`() {
        val (status, body) = register("not-an-email", "ValidPass1")
        assertThat(status).isEqualTo(400)
        assertThat(body).contains("valid email")
    }

    @Test
    fun `missing name is rejected`() {
        val (status, _) = register("noname-$random@test.app", "ValidPass1", name = "   ")
        assertThat(status).isEqualTo(400)
    }

    @Test
    fun `unaccepted terms are rejected`() {
        val (status, _) = register("noterms-$random@test.app", "ValidPass1", terms = false)
        assertThat(status).isEqualTo(400)
    }

    @Test
    fun `valid registration succeeds and duplicate email conflicts`() {
        val email = "valid-$random@test.app"
        assertThat(register(email, "ValidPass1").first).isEqualTo(201)
        assertThat(register(email, "ValidPass1").first).isEqualTo(409)
    }

    @Test
    fun `registration normalises email case`() {
        val email = "Case-$random@Test.app"
        assertThat(register(email, "ValidPass1").first).isEqualTo(201)
        assertThat(userRepo.findByEmail(email.lowercase().trim())).isNotNull
    }

    // ── Malformed / unconvertible client input ─────────────────────────────

    @Test
    fun `malformed json on login returns 400 not 500`() {
        val res = mockMvc.perform(
            MockMvcRequestBuilders.post("/api/auth/login")
                .contentType(org.springframework.http.MediaType.APPLICATION_JSON)
                .content("{bad json")
        ).andReturn()
        assertThat(res.response.status).isEqualTo(400)
        assertThat(res.response.contentAsString).contains("Malformed request body")
        assertThat(res.response.contentAsString).doesNotContain("Exception", "at com.elekeza")
    }

    @Test
    fun `malformed json on register returns 400 not 500`() {
        val res = mockMvc.perform(
            MockMvcRequestBuilders.post("/api/auth/register")
                .contentType(org.springframework.http.MediaType.APPLICATION_JSON)
                .content("[1,2,")
        ).andReturn()
        assertThat(res.response.status).isEqualTo(400)
    }

    @Test
    fun `non-numeric lesson id returns 400 not 500`() {
        val student = login("student@elekeza.app", "student123")
        val out = get("/api/content/lessons/not-a-number", student)
        assertThat(out.status).isEqualTo(400)
        assertThat(out.bodyText).contains("Invalid value for 'id'")
    }

    // ── Login rate limiting ────────────────────────────────────────────────

    @Test
    fun `login attempts below threshold behave normally and exceeding it returns 429`() {
        val wrong = """{"email":"student@elekeza.app","password":"wrong"}"""
        repeat(3) {
            assertThat(postRawLogin(wrong).status).isEqualTo(401)
        }
        // Fourth attempt exceeds the quota → 429, without revealing credentials.
        assertThat(postRawLogin(wrong).status).isEqualTo(429)
    }

    @Test
    fun `rate limited account cannot bypass with correct password`() {
        repeat(3) {
            postRawLogin("""{"email":"student@elekeza.app","password":"wrong"}""")
        }
        val correct = """{"email":"student@elekeza.app","password":"student123"}"""
        assertThat(postRawLogin(correct).status).isEqualTo(429)
    }

    @Test
    fun `different account is not blocked by another account's quota`() {
        repeat(4) { postRawLogin("""{"email":"student@elekeza.app","password":"wrong"}""") }
        assertThat(postRawLogin("""{"email":"teacher@elekeza.app","password":"wrong"}""").status).isEqualTo(401)
    }

    @Test
    fun `login succeeds after the rate-limit window expires`() {
        repeat(4) { postRawLogin("""{"email":"student@elekeza.app","password":"wrong"}""") }
        assertThat(postRawLogin("""{"email":"student@elekeza.app","password":"student123"}""").status).isEqualTo(429)
        Thread.sleep(1200)
        val out = postRawLogin("""{"email":"student@elekeza.app","password":"student123"}""")
        assertThat(out.status).isEqualTo(200)
    }

    private fun postRawLogin(json: String): com.elekeza.backend.testutil.HttpOutcome =
        com.elekeza.backend.testutil.HttpOutcome(
            mockMvc.perform(
                MockMvcRequestBuilders.post("/api/auth/login")
                    .contentType(org.springframework.http.MediaType.APPLICATION_JSON)
                    .content(json)
            ).andReturn()
        )

    private val random: String get() = java.util.UUID.randomUUID().toString().take(8)
}
