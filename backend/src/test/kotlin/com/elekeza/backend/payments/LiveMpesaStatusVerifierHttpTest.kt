package com.elekeza.backend.payments

import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.boot.test.context.TestConfiguration
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Primary
import org.springframework.http.HttpMethod
import org.springframework.test.web.client.ExpectedCount
import org.springframework.test.web.client.MockRestServiceServer
import org.springframework.test.web.client.match.MockRestRequestMatchers.header
import org.springframework.test.web.client.match.MockRestRequestMatchers.method
import org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo
import org.springframework.http.HttpStatus
import org.springframework.http.client.ClientHttpResponse
import org.springframework.test.web.client.response.MockRestResponseCreators.withException
import org.springframework.test.web.client.response.MockRestResponseCreators.withStatus
import org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess
import org.springframework.web.client.RestTemplate
import java.net.SocketTimeoutException
import java.net.URI

/**
 * HTTP-level semantics of [LiveMpesaStatusVerifier] — the class that talks to
 * the real Daraja sandbox in live mode. The endpoints here are scripted with
 * [MockRestServiceServer] bound to a test-local @Primary [RestTemplate] (the
 * verifier and every other consumer use it); no network and no real provider
 * credentials are involved. Live-sandbox verification with authorised
 * credentials remains operationally blocked and is reported as such in
 * docs/PAYMENT-SECURITY-REMEDIATION-2026-10-16.md.
 *
 * Phase-2 cases covered (payment-security sprint 2):
 *  1. OAuth token acquired, then Query `ResultCode=0`  -> Confirmed
 *  2. OAuth rejected (401)                             -> Unavailable (fail closed)
 *  3. Query read timeout (SocketTimeoutException)      -> Unavailable, never success
 *  4. Query in-flight provider error body (500.001.1001) -> Unavailable (keep retrying)
 *  5. Query `ResultCode=1032` (customer cancelled)     -> NotSuccessful
 */
@SpringBootTest(
    properties = [
        "spring.profiles.active=dev",
        "ai.client.type=mock",
        "ai.internal-secret=test-internal-secret",
        "spring.datasource.url=jdbc:h2:mem:elekeza;DB_CLOSE_DELAY=-1;MODE=PostgreSQL",
        "spring.datasource.username=sa",
        "spring.datasource.password=",
        "fees.mpesa-mode=live",
        "mpesa.consumer-key=test-consumer-key",
        "mpesa.consumer-secret=test-consumer-secret",
        "mpesa.passkey=bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919",
        "mpesa.shortcode=174379",
        "mpesa.environment=sandbox",
    ]
)
class LiveMpesaStatusVerifierHttpTest {

    @TestConfiguration
    class MockHttpConfig {
        @Bean
        @Primary
        fun mockRestTemplate(): RestTemplate = RestTemplate().also { MockRestServiceServer.bindTo(it).build() }
    }

    @Autowired lateinit var verifier: LiveMpesaStatusVerifier
    @Autowired lateinit var template: RestTemplate

    private val server: MockRestServiceServer
        get() = MockRestServiceServer.bindTo(template).build()

    private fun mockOAuthSuccess(s: MockRestServiceServer) {
        s.expect(ExpectedCount.once(), requestTo("https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials"))
            .andExpect(method(HttpMethod.GET))
            .andRespond(
                withSuccess("""{"access_token":"scripted-token","expires_in":"3599"}""", org.springframework.http.MediaType.APPLICATION_JSON)
            )
    }

    private fun mockQuery(s: MockRestServiceServer, body: String) {
        s.expect(ExpectedCount.once(), requestTo("https://sandbox.safaricom.co.ke/mpesa/stkpushquery/v1/query"))
            .andExpect(method(HttpMethod.POST))
            .andRespond(withSuccess(body, org.springframework.http.MediaType.APPLICATION_JSON))
    }

    @Test
    fun `oauth then ResultCode 0 confirms`() {
        val s = server
        mockOAuthSuccess(s)
        mockQuery(s, """{"ResponseCode":"0","ResponseDescription":"The service request is processed successfully.","ResultCode":"0","ResultDesc":"The service request is processed successfully.","CheckoutRequestID":"ws_CO_TEST_1"}""")
        val outcome = verifier.query("ws_CO_TEST_1")
        assertThat(outcome).isEqualTo(VerificationOutcome.Confirmed)
        s.verify()
    }

    @Test
    fun `oauth 401 fails closed as Unavailable`() {
        val s = server
        s.expect(ExpectedCount.once(), requestTo("https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials"))
            .andRespond(withStatus(HttpStatus.UNAUTHORIZED))
        val outcome = verifier.query("ws_CO_TEST_OAUTH_FAIL")
        assertThat(outcome).isInstanceOf(VerificationOutcome.Unavailable::class.java)
        s.verify()
    }

    @Test
    fun `query read timeout fails closed as Unavailable`() {
        val s = server
        mockOAuthSuccess(s)
        s.expect(ExpectedCount.once(), requestTo("https://sandbox.safaricom.co.ke/mpesa/stkpushquery/v1/query"))
            .andExpect(method(HttpMethod.POST))
            .andRespond(withException(SocketTimeoutException("read timed out")))
        val outcome = verifier.query("ws_CO_TEST_TIMEOUT")
        assertThat(outcome).isInstanceOf(VerificationOutcome.Unavailable::class.java)
        s.verify()
    }

    @Test
    fun `query in-flight errorCode is Unavailable`() {
        val s = server
        mockOAuthSuccess(s)
        mockQuery(s, """{"errorCode":"500.001.1001","errorMessage":"The transaction is being processed"}""")
        val outcome = verifier.query("ws_CO_TEST_INFLIGHT")
        assertThat(outcome).isInstanceOf(VerificationOutcome.Unavailable::class.java)
        s.verify()
    }

    @Test
    fun `query ResultCode 1032 is NotSuccessful`() {
        val s = server
        mockOAuthSuccess(s)
        mockQuery(s, """{"ResponseCode":"0","ResponseDescription":"The service request is processed successfully.","ResultCode":"1032","ResultDesc":"Request cancelled by user","CheckoutRequestID":"ws_CO_TEST_2"}""")
        val outcome = verifier.query("ws_CO_TEST_2")
        assertThat(outcome).isEqualTo(VerificationOutcome.NotSuccessful)
        s.verify()
    }

    @Test
    fun `live mode without credentials is Unavailable even offline`() {
        val s = server
        val unconfigured = LiveMpesaStatusVerifier("", "", "passk", "174379", "sandbox", template)
        val outcome = unconfigured.query("ws_CO_TEST_UNCONFIGURED")
        assertThat(outcome).isInstanceOf(VerificationOutcome.Unavailable::class.java)
        assertThat(unconfigured.isConfigured).isFalse()
        s.verify()
    }
}
