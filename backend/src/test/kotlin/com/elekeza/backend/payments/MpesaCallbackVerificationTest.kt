package com.elekeza.backend.payments

import com.elekeza.backend.auth.User
import com.elekeza.backend.auth.UserRepository
import com.elekeza.backend.common.AuditLogRepository
import com.elekeza.backend.auth.UserRole
import com.elekeza.backend.finance.PaymentRepository
import com.elekeza.backend.institution.Institution
import com.elekeza.backend.institution.InstitutionRepository
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.boot.test.context.TestConfiguration
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Primary
import org.springframework.security.crypto.password.PasswordEncoder

/**
 * A verifier whose answer the test controls, so the LIVE (credentialed) trust
 * model can be exercised without network access.
 */
class ScriptedVerifier : MpesaStatusVerifier {
    @Volatile var outcome: VerificationOutcome = VerificationOutcome.Confirmed
    @Volatile override var isLive: Boolean = true
    override fun verify(checkoutRequestId: String): VerificationOutcome = outcome
}

/**
 * Callback trust model (2026-10-16 payment-security remediation).
 *
 * The Daraja STK callback is unsigned, so a callback body must NOT be able to
 * finalise a financial credit on its own. These tests run in LIVE mode with a
 * scripted verifier and prove:
 *
 *  - an unverifiable success creates NO credit and parks the transaction;
 *  - a provider "not successful" answer never credits;
 *  - only an independently confirmed success becomes COMPLETED and credits;
 *  - amount mismatches, unknown ids and terminal replays change nothing.
 */
@SpringBootTest(
    properties = [
        "spring.profiles.active=dev",
        "ai.client.type=mock",
        "ai.internal-secret=test-internal-secret",
        "spring.datasource.url=jdbc:h2:mem:elekeza;DB_CLOSE_DELAY=-1;MODE=PostgreSQL",
        "spring.datasource.username=sa",
        "spring.datasource.password=",
        // Live mode + credentials => the deployment must verify with the provider.
        "fees.mpesa-mode=live",
        "mpesa.consumer-key=test-consumer-key",
        "mpesa.consumer-secret=test-consumer-secret",
    ]
)
class MpesaCallbackVerificationTest {

    @TestConfiguration
    class ScriptedVerifierConfig {
        @Bean
        @Primary
        fun scriptedVerifier(): ScriptedVerifier = ScriptedVerifier()
    }

    @Autowired lateinit var service: MpesaService
    @Autowired lateinit var verifier: ScriptedVerifier
    @Autowired lateinit var txRepo: MpesaTransactionRepository
    @Autowired lateinit var paymentRepo: PaymentRepository
    @Autowired lateinit var auditRepo: AuditLogRepository
    @Autowired lateinit var userRepo: UserRepository
    @Autowired lateinit var institutionRepo: InstitutionRepository
    @Autowired lateinit var passwordEncoder: PasswordEncoder

    private var institutionId: Long? = null
    private var learnerId: Long? = null
    private val createdCheckouts = mutableListOf<String>()

    private fun learner(): Long {
        if (learnerId == null) {
            val inst = institutionRepo.save(Institution(name = "Verify Test Academy", county = "Test", subCounty = "Test"))
            institutionId = inst.id
            val u: User = userRepo.save(
                User(
                    email = "verify-learner-${System.nanoTime()}@example.com",
                    name = "Verify Learner",
                    password = passwordEncoder.encode("pass123"),
                    role = UserRole.STUDENT,
                    institutionId = inst.id,
                )
            )
            learnerId = u.id
        }
        return learnerId!!
    }

    private fun seed(checkoutId: String, amount: Double = 100.0, status: String = "INITIATED"): MpesaTransaction {
        createdCheckouts += checkoutId
        return txRepo.save(
            MpesaTransaction(
                checkoutRequestId = checkoutId,
                phoneNumber = "+254700000000",
                amount = amount,
                reference = "ELEKEZA-FEES-${learner()}",
                description = "verification test",
                status = status,
            )
        )
    }

    private fun callback(checkoutId: String, resultCode: Int, amount: Number? = 100, receipt: String? = "RCPT-$checkoutId") =
        mapOf(
            "Body" to mapOf(
                "stkCallback" to mapOf(
                    "CheckoutRequestID" to checkoutId,
                    "ResultCode" to resultCode,
                    "ResultDesc" to "Service request processed",
                    "CallbackMetadata" to mapOf(
                        "Item" to listOfNotNull(
                            amount?.let { mapOf("Name" to "Amount", "Value" to it) },
                            receipt?.let { mapOf("Name" to "MpesaReceiptNumber", "Value" to it) },
                        )
                    ),
                )
            )
        )

    private fun paymentsFor(checkoutId: String): List<*> =
        paymentRepo.findAll().filter { it.checkoutRequestId == checkoutId }

    /**
     * Audit writes are @Async (AuditLogService.log), so poll briefly instead of
     * asserting immediately after the callback returns.
     */
    private fun awaitAudit(action: String, detailContains: String, timeoutMs: Long = 5000): Boolean {
        val deadline = System.currentTimeMillis() + timeoutMs
        while (System.currentTimeMillis() < deadline) {
            if (auditRepo.findAll().any { it.action == action && (it.detail?.contains(detailContains) == true) }) return true
            Thread.sleep(50)
        }
        return false
    }

    @AfterEach
    fun cleanUp() {
        createdCheckouts.forEach { cid ->
            paymentRepo.findAll().filter { it.checkoutRequestId == cid }.forEach { paymentRepo.delete(it) }
            txRepo.findAll().filter { it.checkoutRequestId == cid }.forEach { txRepo.delete(it) }
        }
        createdCheckouts.clear()
        learnerId?.let { id -> userRepo.findById(id).ifPresent { userRepo.delete(it) } }
        learnerId = null
        institutionId?.let { id -> institutionRepo.findById(id).ifPresent { institutionRepo.delete(it) } }
        institutionId = null
    }

    @Test
    fun `unverifiable success callback creates no credit and parks the transaction`() {
        val checkoutId = "VER-UNAVAILABLE-1"
        seed(checkoutId)
        verifier.outcome = VerificationOutcome.Unavailable(reason = "provider unreachable")

        val response = service.processCallback(callback(checkoutId, 0))

        assertThat(response["ResultCode"]).isEqualTo(0) // acknowledged, not credited
        assertThat(txRepo.findByCheckoutRequestId(checkoutId)!!.status).isEqualTo(MpesaStatus.AWAITING_VERIFICATION)
        assertThat(paymentsFor(checkoutId)).isEmpty()
        assertThat(awaitAudit("MPESA_CALLBACK", checkoutId)).isTrue()
        assertThat(awaitAudit("MPESA_AWAITING", checkoutId)).isTrue()
    }

    @Test
    fun `provider says not successful so the callback claim is refused`() {
        val checkoutId = "VER-NOT-SUCCESS-1"
        seed(checkoutId)
        verifier.outcome = VerificationOutcome.NotSuccessful

        service.processCallback(callback(checkoutId, 0))

        assertThat(txRepo.findByCheckoutRequestId(checkoutId)!!.status).isEqualTo(MpesaStatus.FAILED)
        assertThat(paymentsFor(checkoutId)).isEmpty()
        assertThat(awaitAudit("MPESA_CALLBACK", checkoutId)).isTrue()
        assertThat(awaitAudit("MPESA_REFUSED", checkoutId)).isTrue()
    }

    @Test
    fun `independently confirmed success becomes COMPLETED and credits the ledger once`() {
        val checkoutId = "VER-CONFIRMED-1"
        val tx = seed(checkoutId)
        verifier.outcome = VerificationOutcome.Confirmed

        service.processCallback(callback(checkoutId, 0))

        val saved = txRepo.findByCheckoutRequestId(checkoutId)!!
        assertThat(saved.status).isEqualTo(MpesaStatus.COMPLETED)
        assertThat(saved.amount).isEqualTo(tx.amount)
        val payments = paymentsFor(checkoutId)
        assertThat(payments).hasSize(1)
        assertThat(awaitAudit("MPESA_CALLBACK", checkoutId)).isTrue()
        assertThat(awaitAudit("MPESA_CREDIT_APPLIED", checkoutId)).isTrue()
    }

    @Test
    fun `confirmed success is idempotent when the callback is replayed`() {
        val checkoutId = "VER-REPLAY-1"
        seed(checkoutId)
        verifier.outcome = VerificationOutcome.Confirmed

        service.processCallback(callback(checkoutId, 0))
        service.processCallback(callback(checkoutId, 0))

        assertThat(txRepo.findByCheckoutRequestId(checkoutId)!!.status).isEqualTo(MpesaStatus.COMPLETED)
        assertThat(paymentsFor(checkoutId)).hasSize(1)
        assertThat(txRepo.findAll().count { it.checkoutRequestId == checkoutId }).isEqualTo(1)
        assertThat(awaitAudit("MPESA_CALLBACK_DUPLICATE", checkoutId)).isTrue()
    }

    @Test
    fun `amount mismatch is rejected without state change or credit`() {
        val checkoutId = "VER-AMOUNT-1"
        seed(checkoutId, amount = 100.0)
        verifier.outcome = VerificationOutcome.Confirmed

        val response = service.processCallback(callback(checkoutId, 0, amount = 10))

        assertThat(response["ResultDesc"]).isEqualTo("Amount mismatch")
        assertThat(txRepo.findByCheckoutRequestId(checkoutId)!!.status).isEqualTo("INITIATED")
        assertThat(paymentsFor(checkoutId)).isEmpty()
        assertThat(awaitAudit("MPESA_CALLBACK_MISMATCH", checkoutId)).isTrue()
    }

    @Test
    fun `unknown checkout id creates nothing`() {
        val response = service.processCallback(callback("VER-UNKNOWN-1", 0))

        assertThat(response["ResultCode"]).isEqualTo(1)
        assertThat(txRepo.findByCheckoutRequestId("VER-UNKNOWN-1")).isNull()
        assertThat(paymentsFor("VER-UNKNOWN-1")).isEmpty()
        assertThat(awaitAudit("MPESA_CALLBACK_UNKNOWN", "VER-UNKNOWN-1")).isTrue()
    }

    @Test
    fun `a conflicting success callback cannot overwrite a terminal transaction`() {
        val checkoutId = "VER-TERMINAL-1"
        seed(checkoutId, status = MpesaStatus.FAILED)
        verifier.outcome = VerificationOutcome.Confirmed

        service.processCallback(callback(checkoutId, 0))

        assertThat(txRepo.findByCheckoutRequestId(checkoutId)!!.status).isEqualTo(MpesaStatus.FAILED)
        assertThat(paymentsFor(checkoutId)).isEmpty()
    }

    @Test
    fun `provider-confirmed failure is recorded as FAILED with no credit`() {
        // Sprint 3 P1: a non-zero ResultCode from an unsigned callback is not
        // proof of failure in live mode — the transaction is marked FAILED only
        // when the provider query itself says the payment is not successful.
        val checkoutId = "VER-FAILED-1"
        seed(checkoutId)
        verifier.outcome = VerificationOutcome.NotSuccessful

        service.processCallback(callback(checkoutId, 1032, amount = null, receipt = null))

        assertThat(txRepo.findByCheckoutRequestId(checkoutId)!!.status).isEqualTo(MpesaStatus.FAILED)
        assertThat(paymentsFor(checkoutId)).isEmpty()
    }

    @Test
    fun `a forged failure callback cannot terminate a payment the provider confirms`() {
        // Sprint 3 P1: FAILED is terminal, so an attacker with a known checkout
        // ID used to be able to hurt a legitimate in-flight payment by sending
        // a forged failure callback. In live mode the provider-confirmed truth
        // wins: the transaction is finalised and credited, and the
        // contradiction is audited.
        val checkoutId = "VER-FORGE-FAIL-1"
        seed(checkoutId)
        verifier.outcome = VerificationOutcome.Confirmed

        service.processCallback(callback(checkoutId, 1032, amount = null, receipt = null))

        assertThat(txRepo.findByCheckoutRequestId(checkoutId)!!.status).isEqualTo(MpesaStatus.COMPLETED)
        assertThat(paymentsFor(checkoutId)).hasSize(1)
        assertThat(awaitAudit("MPESA_FAILURE_CALLBACK_CONTRADICTED", checkoutId)).isTrue()
    }

    @Test
    fun `a forged failure callback parks an unverifiable payment instead of failing it`() {
        // Sprint 3 P1: when the provider is unreachable the callback must NOT
        // produce a terminal FAILED — reconciliation still gets its chance.
        val checkoutId = "VER-FORGE-UNAVAIL-1"
        seed(checkoutId)
        verifier.outcome = VerificationOutcome.Unavailable(reason = "provider query unreachable (scripted)")

        service.processCallback(callback(checkoutId, 1032, amount = null, receipt = null))

        val tx = txRepo.findByCheckoutRequestId(checkoutId)!!
        assertThat(tx.status).isNotEqualTo(MpesaStatus.FAILED)
        assertThat(paymentsFor(checkoutId)).isEmpty()
        assertThat(awaitAudit("MPESA_FAILURE_CALLBACK_UNVERIFIED", checkoutId)).isTrue()
    }
}
