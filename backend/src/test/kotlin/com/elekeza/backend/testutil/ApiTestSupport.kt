package com.elekeza.backend.testutil

import com.elekeza.backend.auth.User
import com.elekeza.backend.auth.UserRepository
import com.elekeza.backend.auth.UserRole
import com.fasterxml.jackson.databind.JsonNode
import com.fasterxml.jackson.databind.ObjectMapper
import jakarta.servlet.http.Cookie
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.http.MediaType
import org.springframework.mock.web.MockMultipartFile
import org.springframework.security.crypto.password.PasswordEncoder
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.MvcResult
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders

/**
 * Shared HTTP-level test support: boots the full application with a pinned
 * in-memory H2 (dev profile) and performs real cookie-logins through
 * /api/auth/login so controllers see an actual authenticated [User]
 * principal (same path production uses). Also handles the CSRF cookie/header
 * dance required for state-changing requests.
 */
@SpringBootTest(
    properties = [
        "spring.profiles.active=dev",
        "ai.client.type=mock",
        "ai.internal-secret=test-internal-secret",
        // Pin the datasource so ambient SPRING_DATASOURCE_* env vars (GitLab
        // CI) cannot redirect the context away from the H2 test database.
        "spring.datasource.url=jdbc:h2:mem:elekeza;DB_CLOSE_DELAY=-1;MODE=PostgreSQL",
        "spring.datasource.username=sa",
        "spring.datasource.password=",

    ]
)
@AutoConfigureMockMvc
abstract class ApiTestSupport {

    @Autowired lateinit var mockMvc: MockMvc
    @Autowired lateinit var userRepo: UserRepository
    @Autowired lateinit var passwordEncoder: PasswordEncoder
    @Autowired lateinit var objectMapper: ObjectMapper

    protected fun createUser(
        email: String,
        rawPassword: String,
        name: String,
        role: UserRole,
        institutionId: Long? = null
    ): User = userRepo.save(
        User(
            email = email.lowercase().trim(),
            name = name,
            password = passwordEncoder.encode(rawPassword),
            role = role,
            institutionId = institutionId
        )
    )

    /** Real login through the auth endpoint; returns the access cookie. */
    protected fun login(email: String, password: String): Cookie {
        val res = mockMvc.perform(
            MockMvcRequestBuilders.post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""{"email":"$email","password":"$password"}""")
        ).andReturn()
        require(res.response.status == 200) { "login failed: ${res.response.status} ${res.response.contentAsString}" }
        val cookie = res.response.cookies.firstOrNull { it.name == "elekeza_access" }
        requireNotNull(cookie) { "no access cookie in login response" }
        return cookie
    }

    protected fun csrf(cookie: Cookie?): CsrfPair {
        val res = mockMvc.perform(MockMvcRequestBuilders.get("/api/auth/csrf").apply { cookie?.let { c -> cookie(c) } }).andReturn()
        val token = objectMapper.readTree(res.response.contentAsString)["token"].asText()
        val xsrfCookie = res.response.cookies.firstOrNull { it.name == "XSRF-TOKEN" }
            ?: Cookie("XSRF-TOKEN", token)
        return CsrfPair(token, xsrfCookie)
    }

    protected fun get(url: String, session: Cookie?): HttpOutcome =
        HttpOutcome(mockMvc.perform(MockMvcRequestBuilders.get(url).apply { session?.let { cookie(it) } }).andReturn())

    protected fun postJson(url: String, json: String, session: Cookie?, withCsrf: Boolean = true): HttpOutcome {
        var builder: MockHttpServletRequestBuilder =
            MockMvcRequestBuilders.post(url).contentType(MediaType.APPLICATION_JSON).content(json)
        builder = attachSession(builder, session, withCsrf)
        return HttpOutcome(mockMvc.perform(builder).andReturn())
    }

    protected fun putJson(url: String, json: String, session: Cookie?, withCsrf: Boolean = true): HttpOutcome {
        var builder: MockHttpServletRequestBuilder =
            MockMvcRequestBuilders.put(url).contentType(MediaType.APPLICATION_JSON).content(json)
        builder = attachSession(builder, session, withCsrf)
        return HttpOutcome(mockMvc.perform(builder).andReturn())
    }

    protected fun postForm(url: String, session: Cookie?, withCsrf: Boolean = true): HttpOutcome {
        var builder: MockHttpServletRequestBuilder = MockMvcRequestBuilders.post(url)
        builder = attachSession(builder, session, withCsrf)
        return HttpOutcome(mockMvc.perform(builder).andReturn())
    }

    protected fun delete(url: String, session: Cookie?, withCsrf: Boolean = true): HttpOutcome {
        var builder: MockHttpServletRequestBuilder = MockMvcRequestBuilders.delete(url)
        builder = attachSession(builder, session, withCsrf)
        return HttpOutcome(mockMvc.perform(builder).andReturn())
    }

    protected fun multipartPost(url: String, file: MockMultipartFile, session: Cookie?): HttpOutcome {
        val builder: MockHttpServletRequestBuilder = MockMvcRequestBuilders.multipart(url).file(file)
        val withAuth = attachSession(builder, session, withCsrf = true)
        return HttpOutcome(mockMvc.perform(withAuth).andReturn())
    }

    private fun attachSession(
        builder: MockHttpServletRequestBuilder,
        session: Cookie?,
        withCsrf: Boolean
    ): MockHttpServletRequestBuilder {
        var b = builder
        if (session != null) b = b.cookie(session)
        if (withCsrf) {
            val pair = csrf(session)
            b = b.cookie(pair.cookie).header("X-XSRF-TOKEN", pair.token)
        }
        return b
    }
}

data class CsrfPair(val token: String, val cookie: Cookie)

class HttpOutcome(val result: MvcResult) {
    val status: Int get() = result.response.status
    val body: JsonNode? get() = if (result.response.contentAsString.isBlank()) null
        else com.fasterxml.jackson.databind.json.JsonMapper().readTree(result.response.contentAsString)
    val bodyText: String get() = result.response.contentAsString
}
