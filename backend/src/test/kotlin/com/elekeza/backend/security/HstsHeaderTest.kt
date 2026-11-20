package com.elekeza.backend.security

import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get

/**
 * HSTS with `app.security.hsts-enabled=true` (the staging/production posture).
 *
 * Spring only writes the header on requests it considers secure, which is why
 * the positive case marks the request `secure(true)`. That mirrors a host
 * behind a TLS-terminating proxy: without `server.forward-headers-strategy`,
 * the container would see plain HTTP and withhold the header — the reason that
 * setting is now pinned in `application-prod.yaml`.
 */
@SpringBootTest(
    properties = [
        "spring.profiles.active=dev",
        "ai.client.type=mock",
        "ai.internal-secret=test-internal-secret",
        "spring.datasource.url=jdbc:h2:mem:elekeza-hsts;DB_CLOSE_DELAY=-1;MODE=PostgreSQL",
        "spring.datasource.username=sa",
        "spring.datasource.password=",
        "app.security.hsts-enabled=true"
    ]
)
@AutoConfigureMockMvc
class HstsHeaderTest {

    @Autowired lateinit var mockMvc: MockMvc

    @Test
    fun `HSTS is emitted on a secure request when enabled`() {
        val response = mockMvc.perform(get("/api/auth/csrf").secure(true)).andReturn().response
        val hsts = response.getHeader("Strict-Transport-Security")
        assertThat(hsts).isNotNull()
        assertThat(hsts).contains("max-age=31536000")
        // Neither is set deliberately; both are owned by the domain holder.
        assertThat(hsts).doesNotContain("includeSubDomains")
        assertThat(hsts).doesNotContain("preload")
    }

    @Test
    fun `HSTS is withheld on a plain-HTTP request even when enabled`() {
        val response = mockMvc.perform(get("/api/auth/csrf")).andReturn().response
        assertThat(response.getHeader("Strict-Transport-Security")).isNull()
    }
}
