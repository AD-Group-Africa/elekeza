package com.elekeza.backend.payments

import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.post
import org.springframework.http.MediaType

/**
 * End-to-end callback verification through the REAL HTTP security chain —
 * exactly how Safaricom's server calls us: no session, no CSRF token, no
 * cookies. The service-level tests in MpesaCallbackTest cover the state
 * machine; these cover the filter chain (CSRF exemption, auth rule, content
 * negotiation) that the unit tests cannot see.
 */
@SpringBootTest(
    properties = [
        "spring.profiles.active=dev",
        "ai.client.type=mock",
        "ai.internal-secret=test-internal-secret",
        "spring.datasource.url=jdbc:h2:mem:elekeza;DB_CLOSE_DELAY=-1;MODE=PostgreSQL",
        "spring.datasource.username=sa",
        "spring.datasource.password=",
        "mpesa.consumer-key=",
        "mpesa.consumer-secret=",
        "mpesa.passkey=",
    ]
)
@AutoConfigureMockMvc
class MpesaCallbackEndToEndTest {

    @Autowired lateinit var mockMvc: MockMvc
    @Autowired lateinit var repo: MpesaTransactionRepository

    private val createdIds = mutableListOf<String>()

    @AfterEach
    fun cleanup() {
        createdIds.forEach { repo.findByCheckoutRequestId(it)?.let { t -> repo.delete(t) } }
    }

    private fun seedTransaction(checkoutId: String, amount: Double, status: String = "INITIATED"): MpesaTransaction {
        val t = MpesaTransaction(
            checkoutRequestId = checkoutId,
            phoneNumber = "+254700000001",
            amount = amount,
            reference = "e2e-$checkoutId",
            description = "e2e test",
            status = status,
        )
        repo.save(t)
        createdIds += checkoutId
        return t
    }

    private fun callbackJson(checkoutId: String, resultCode: Int, amount: Double? = null): String {
        val metadata = if (amount != null) {
            ""","CallbackMetadata":{"Item":[{"Name":"Amount","Value":$amount}]}"""
        } else ""
        return """{"Body":{"stkCallback":{"CheckoutRequestID":"$checkoutId","ResultCode":$resultCode$metadata}}}"""
    }

    @Test
    fun `provider callback with NO csrf token is accepted (filter chain exempt)`() {
        seedTransaction("ws_CO_E2E_1", 500.0)
        val result = mockMvc.post("/api/payments/callback") {
            contentType = MediaType.APPLICATION_JSON
            content = callbackJson("ws_CO_E2E_1", 0, 500.0)
        }.andExpect { status { isOk() } }
            .andReturn()

        assertThat(result.response.contentAsString).contains("\"ResultCode\":0")
        assertThat(repo.findByCheckoutRequestId("ws_CO_E2E_1")!!.status).isEqualTo("COMPLETED")
    }

    @Test
    fun `duplicate provider callback stays idempotent through the chain`() {
        seedTransaction("ws_CO_E2E_2", 250.0)
        repeat(2) {
            mockMvc.post("/api/payments/callback") {
                contentType = MediaType.APPLICATION_JSON
                content = callbackJson("ws_CO_E2E_2", 0, 250.0)
            }.andExpect { status { isOk() } }
        }
        val tx = repo.findByCheckoutRequestId("ws_CO_E2E_2")!!
        assertThat(tx.status).isEqualTo("COMPLETED")
        // exactly one row — no duplicate transactions/entitlements
        assertThat(repo.findAll().count { it.checkoutRequestId == "ws_CO_E2E_2" }).isEqualTo(1)
    }

    @Test
    fun `amount mismatch is rejected through the chain without state change`() {
        seedTransaction("ws_CO_E2E_3", 300.0)
        mockMvc.post("/api/payments/callback") {
            contentType = MediaType.APPLICATION_JSON
            content = callbackJson("ws_CO_E2E_3", 0, 999.0)
        }.andExpect { status { isOk() } }
            .andExpect { jsonPath("$.ResultDesc") { value("Amount mismatch") } }
        assertThat(repo.findByCheckoutRequestId("ws_CO_E2E_3")!!.status).isEqualTo("INITIATED")
    }

    @Test
    fun `failed result code transitions to FAILED and cannot be replayed as success`() {
        seedTransaction("ws_CO_E2E_4", 100.0)
        mockMvc.post("/api/payments/callback") {
            contentType = MediaType.APPLICATION_JSON
            content = callbackJson("ws_CO_E2E_4", 1032, 100.0)
        }.andExpect { status { isOk() } }
        assertThat(repo.findByCheckoutRequestId("ws_CO_E2E_4")!!.status).isEqualTo("FAILED")

        // forged success replay after failure must NOT flip the terminal state
        mockMvc.post("/api/payments/callback") {
            contentType = MediaType.APPLICATION_JSON
            content = callbackJson("ws_CO_E2E_4", 0, 100.0)
        }.andExpect { status { isOk() } }
        assertThat(repo.findByCheckoutRequestId("ws_CO_E2E_4")!!.status).isEqualTo("FAILED")
    }

    @Test
    fun `unknown checkout id is rejected without creating anything`() {
        val before = repo.count()
        mockMvc.post("/api/payments/callback") {
            contentType = MediaType.APPLICATION_JSON
            content = callbackJson("ws_CO_UNKNOWN_E2E", 0, 50.0)
        }.andExpect { status { isOk() } }
            .andExpect { jsonPath("$.ResultDesc") { value("Failed") } }
        assertThat(repo.count()).isEqualTo(before)
    }

    @Test
    fun `malformed callback body is handled safely (no 500)`() {
        mockMvc.post("/api/payments/callback") {
            contentType = MediaType.APPLICATION_JSON
            content = """{"unexpected":"shape"}"""
        }.andExpect { status { isOk() } }
    }
}
