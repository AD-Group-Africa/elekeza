package com.elekeza.backend.payments

import com.elekeza.backend.auth.User
import com.elekeza.backend.auth.UserRepository
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
import java.time.Instant

/**
 * Reconciliation: uncertain transactions (missing/delayed callbacks, provider
 * timeouts, provider-accepted-but-unpersisted requests) must be recoverable,
 * retried with backoff, and eventually escalated — never guessed at and never
 * credited while still uncertain.
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
        // Escalate quickly so the bounded-retry policy is testable.
        "payments.reconciliation.max-attempts=2",
    ]
)
class MpesaReconciliationTest {

    @TestConfiguration
    class ScriptedVerifierConfig {
        @Bean
        @Primary
        fun scriptedVerifier(): ScriptedVerifier = ScriptedVerifier()
    }

    @Autowired lateinit var reconciliation: MpesaReconciliationService
    @Autowired lateinit var worker: MpesaReconciliationWorker
    @Autowired lateinit var verifier: ScriptedVerifier
    @Autowired lateinit var txRepo: MpesaTransactionRepository
    @Autowired lateinit var paymentRepo: PaymentRepository
    @Autowired lateinit var userRepo: UserRepository
    @Autowired lateinit var institutionRepo: InstitutionRepository
    @Autowired lateinit var passwordEncoder: PasswordEncoder

    private val createdTxIds = mutableListOf<Long>()
    private var institutionId: Long? = null
    private var learnerId: Long? = null

    private fun learner(): Long {
        if (learnerId == null) {
            val inst = institutionRepo.save(Institution(name = "Reconcile Test Academy", county = "Test", subCounty = "Test"))
            institutionId = inst.id
            val u: User = userRepo.save(
                User(
                    email = "reconcile-learner-${System.nanoTime()}@example.com",
                    name = "Reconcile Learner",
                    password = passwordEncoder.encode("pass123"),
                    role = UserRole.STUDENT,
                    institutionId = inst.id,
                )
            )
            learnerId = u.id
        }
        return learnerId!!
    }

    private fun seedStale(checkoutId: String?, status: String = MpesaStatus.INITIATED): MpesaTransaction {
        val stale = Instant.now().minusSeconds(600)
        val saved = txRepo.save(
            MpesaTransaction(
                checkoutRequestId = checkoutId,
                phoneNumber = "+254700000000",
                amount = 250.0,
                reference = "ELEKEZA-FEES-${learner()}",
                description = "reconciliation test",
                status = status,
                createdAt = stale,
                updatedAt = stale,
            )
        )
        createdTxIds += saved.id
        return saved
    }

    private fun paymentsFor(checkoutId: String) =
        paymentRepo.findAll().filter { it.checkoutRequestId == checkoutId }

    @AfterEach
    fun cleanUp() {
        createdTxIds.forEach { id ->
            // Any payment created by the reconciliation run for these checkouts.
            val tx = txRepo.findById(id).orElse(null)
            tx?.checkoutRequestId?.let { cid -> paymentsFor(cid).forEach { paymentRepo.delete(it) } }
            txRepo.findById(id).ifPresent { txRepo.delete(it) }
        }
        createdTxIds.clear()
        learnerId?.let { id -> userRepo.findById(id).ifPresent { userRepo.delete(it) } }
        learnerId = null
        institutionId?.let { id -> institutionRepo.findById(id).ifPresent { institutionRepo.delete(it) } }
        institutionId = null
    }

    @Test
    fun `reconciliation recovers a stale transaction once the provider confirms success`() {
        val checkoutId = "REC-CONFIRM-1"
        seedStale(checkoutId)
        verifier.outcome = VerificationOutcome.Confirmed

        val summary = reconciliation.reconcile()

        assertThat(summary.resolved).isEqualTo(1)
        assertThat(txRepo.findByCheckoutRequestId(checkoutId)!!.status).isEqualTo(MpesaStatus.COMPLETED)
        assertThat(paymentsFor(checkoutId)).hasSize(1)
    }

    @Test
    fun `reconciliation records a provider-declined transaction as failed without credit`() {
        val checkoutId = "REC-DECLINE-1"
        seedStale(checkoutId)
        verifier.outcome = VerificationOutcome.NotSuccessful

        reconciliation.reconcile()

        assertThat(txRepo.findByCheckoutRequestId(checkoutId)!!.status).isEqualTo(MpesaStatus.FAILED)
        assertThat(paymentsFor(checkoutId)).isEmpty()
    }

    @Test
    fun `an unreachable provider leaves the transaction non-terminal and schedules a retry`() {
        val checkoutId = "REC-RETRY-1"
        val tx = seedStale(checkoutId)
        verifier.outcome = VerificationOutcome.Unavailable("provider timeout")

        val outcome = worker.reconcileOne(tx.id)

        assertThat(outcome).isEqualTo(ReconcileOutcome.RETRIED)
        val saved = txRepo.findByCheckoutRequestId(checkoutId)!!
        // Never marked failed merely because the provider could not be reached.
        assertThat(saved.status).isEqualTo(MpesaStatus.INITIATED)
        assertThat(saved.verificationAttempts).isEqualTo(1)
        assertThat(saved.nextVerificationAt).isNotNull()
        assertThat(paymentsFor(checkoutId)).isEmpty()
    }

    @Test
    fun `repeated verification failures escalate to REQUIRES_REVIEW instead of guessing`() {
        val checkoutId = "REC-ESCALATE-1"
        val tx = seedStale(checkoutId)
        verifier.outcome = VerificationOutcome.Unavailable("provider unavailable")

        assertThat(worker.reconcileOne(tx.id)).isEqualTo(ReconcileOutcome.RETRIED)
        assertThat(worker.reconcileOne(tx.id)).isEqualTo(ReconcileOutcome.ESCALATED)

        val saved = txRepo.findByCheckoutRequestId(checkoutId)!!
        assertThat(saved.status).isEqualTo(MpesaStatus.REQUIRES_REVIEW)
        assertThat(paymentsFor(checkoutId)).isEmpty()
    }

    @Test
    fun `a durable intent with no checkout id is escalated for review, never credited`() {
        val tx = seedStale(null, status = MpesaStatus.PENDING)

        val outcome = worker.reconcileOne(tx.id)

        assertThat(outcome).isEqualTo(ReconcileOutcome.ESCALATED)
        val saved = txRepo.findById(tx.id).orElseThrow()
        assertThat(saved.status).isEqualTo(MpesaStatus.REQUIRES_REVIEW)
        assertThat(saved.checkoutRequestId).isNull()
    }

    @Test
    fun `reconciliation is a no-op when live verification is not configured`() {
        val checkoutId = "REC-MOCK-1"
        seedStale(checkoutId)
        verifier.outcome = VerificationOutcome.Confirmed
        verifier.isLive = false

        try {
            val summary = reconciliation.reconcile()

            assertThat(summary.considered).isZero()
            assertThat(txRepo.findByCheckoutRequestId(checkoutId)!!.status).isEqualTo(MpesaStatus.INITIATED)
            assertThat(paymentsFor(checkoutId)).isEmpty()
        } finally {
            verifier.isLive = true
        }
    }
}
