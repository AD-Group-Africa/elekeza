package com.elekeza.backend.security

import com.elekeza.backend.testutil.ApiTestSupport
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get

/**
 * Locks in the response-header baseline and the correlation id.
 *
 * The default test profile is a plain-HTTP local/dev context, so HSTS must be
 * ABSENT here: emitting it from a non-TLS origin is a footgun, not a fix.
 * [HstsHeaderTest] covers the enabled, HTTPS case.
 */
class SecurityHeadersTest : ApiTestSupport() {

    private fun headers() = get("/api/auth/csrf", null).result.response

    @Test
    fun `baseline security headers are present`() {
        val response = headers()
        assertThat(response.getHeader("X-Content-Type-Options")).isEqualTo("nosniff")
        assertThat(response.getHeader("X-Frame-Options")).isEqualTo("DENY")
        assertThat(response.getHeader("Referrer-Policy")).isEqualTo("no-referrer")
        assertThat(response.getHeader("Content-Security-Policy")).contains("frame-ancestors 'none'")
        assertThat(response.getHeader("Permissions-Policy"))
            .isEqualTo("camera=(), microphone=(), geolocation=()")
    }

    @Test
    fun `HSTS is not emitted when it has not been enabled`() {
        assertThat(headers().getHeader("Strict-Transport-Security")).isNull()
    }

    @Test
    fun `a request id is generated and echoed when the client sends none`() {
        val id = headers().getHeader("X-Request-Id")
        assertThat(id).isNotNull()
        assertThat(id).matches("[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}")
    }

    @Test
    fun `a safe inbound request id is preserved so a proxy trace survives`() {
        val response = mockMvc.perform(
            get("/api/auth/csrf").header("X-Request-Id", "abc12345-deploy-trace")
        ).andReturn().response
        assertThat(response.getHeader("X-Request-Id")).isEqualTo("abc12345-deploy-trace")
    }

    @Test
    fun `an unsafe inbound request id is replaced instead of reflected`() {
        val hostile = "bad id with spaces and <script>"
        val response = mockMvc.perform(
            get("/api/auth/csrf").header("X-Request-Id", hostile)
        ).andReturn().response
        val id = response.getHeader("X-Request-Id")
        assertThat(id).isNotEqualTo(hostile)
        assertThat(id).matches("[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}")
    }
}
