package com.elekeza.backend.payments

import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest

/**
 * M-Pesa callback integrity: the callback endpoint is unauthenticated (the
 * provider cannot hold a session), so processCallback itself must enforce a
 * safe state machine, idempotency, amount binding and unknown-id rejection.
 */
@SpringBootTest(
    properties = [
        "spring.profiles.active=dev",
        "ai.client.type=mock",
        "ai.internal-secret=test-internal-secret",
        "spring.datasource.url=jdbc:h2:mem:elekeza;DB_CLOSE_DELAY=-1;MODE=PostgreSQL",
        "spring.datasource.username=sa",
        "spring.datasource.password=",
    ]
)
class MpesaCallbackTest {

    @Autowired lateinit var service: MpesaService
    @Autowired lateinit var repo: MpesaTransactionRepository

    @AfterEach
    fun tearDown() {
        repo.deleteAll()
    }

    private fun seed(checkoutId: String, amount: Double = 100.0, status: String = "INITIATED"): MpesaTransaction =
        repo.save(MpesaTransaction(
            checkoutRequestId = checkoutId,
            phoneNumber = "+254700000000",
            amount = amount,
            reference = "SCH-${checkoutId}",
            description = "School plan",
            status = status
        ))

    private fun callback(
        checkoutId: String,
        resultCode: Int,
        amount: Number? = 100,
        receipt: String? = "RCPT$checkoutId"
    ): Map<String, Any> {
        val items = mutableListOf<Map<String, Any>>()
        if (amount != null) items += mapOf("Name" to "Amount", "Value" to amount)
        if (receipt != null) items += mapOf("Name" to "MpesaReceiptNumber", "Value" to receipt)
        return mapOf("Body" to mapOf("stkCallback" to mapOf(
            "CheckoutRequestID" to checkoutId,
            "ResultCode" to resultCode,
            "ResultDesc" to "Service request processed",
            "CallbackMetadata" to mapOf("Item" to items)
        )))
    }

    @Test
    fun `valid success callback completes an initiated transaction`() {
        seed("CRQ-OK-1")
        val response = service.processCallback(callback("CRQ-OK-1", 0))
        assertThat(response["ResultCode"]).isEqualTo(0)
        val saved = repo.findByCheckoutRequestId("CRQ-OK-1")!!
        assertThat(saved.status).isEqualTo("COMPLETED")
        assertThat(saved.mpesaReceiptNumber).isEqualTo("RCPTCRQ-OK-1")
        assertThat(saved.resultCode).isEqualTo(0)
    }

    @Test
    fun `amount mismatch is rejected without state change`() {
        seed("CRQ-AMT-1", amount = 100.0)
        val response = service.processCallback(callback("CRQ-AMT-1", 0, amount = 10))
        assertThat(response["ResultCode"]).isEqualTo(1)
        assertThat(repo.findByCheckoutRequestId("CRQ-AMT-1")!!.status).isEqualTo("INITIATED")
    }

    @Test
    fun `duplicate success callbacks are idempotent`() {
        seed("CRQ-DUP-1")
        service.processCallback(callback("CRQ-DUP-1", 0))
        service.processCallback(callback("CRQ-DUP-1", 0))
        val saved = repo.findByCheckoutRequestId("CRQ-DUP-1")!!
        assertThat(saved.status).isEqualTo("COMPLETED")
        // One terminal row, no re-processing side effects.
        assertThat(repo.count()).isEqualTo(1L)
    }

    @Test
    fun `failed result records FAILED and a later success replay cannot reopen it`() {
        seed("CRQ-FAIL-1")
        // Failure callback carries no metadata (real provider behaviour).
        service.processCallback(callback("CRQ-FAIL-1", 1, amount = null, receipt = null))
        assertThat(repo.findByCheckoutRequestId("CRQ-FAIL-1")!!.status).isEqualTo("FAILED")

        // Forged/duplicate success replay after a terminal FAILED state.
        service.processCallback(callback("CRQ-FAIL-1", 0))
        assertThat(repo.findByCheckoutRequestId("CRQ-FAIL-1")!!.status).isEqualTo("FAILED")
    }

    @Test
    fun `unknown checkout id is rejected and logged, not recorded`() {
        val response = service.processCallback(callback("CRQ-UNKNOWN", 0))
        assertThat(response["ResultCode"]).isEqualTo(1)
        assertThat(repo.count()).isZero()
    }

    @Test
    fun `malformed body without checkout id is rejected`() {
        val response = service.processCallback(mapOf("Body" to mapOf("notStk" to "x")))
        assertThat(response["ResultCode"]).isEqualTo(1)
        assertThat(repo.count()).isZero()
    }
}
