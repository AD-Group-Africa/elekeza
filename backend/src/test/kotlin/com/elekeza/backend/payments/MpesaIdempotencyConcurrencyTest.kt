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
import org.springframework.security.crypto.password.PasswordEncoder
import java.util.concurrent.Callable
import java.util.concurrent.CyclicBarrier
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit

/**
 * Concurrency guarantee for the ledger.
 *
 * The requirement is not "the happy path is idempotent" but "two simultaneous
 * deliveries of the same provider success cannot create two financial credits".
 * This test really runs the callback concurrently on several threads (released
 * together by a barrier) and then asserts the database outcome: exactly one
 * mpesa row, exactly one finance payment for the checkout id.
 *
 * The safety net is the conditional status transition
 * (`transitionNonTerminal`) plus the UNIQUE index on
 * `payments.checkout_request_id` — NOT an in-memory lock. Thread failures caused
 * by that serialisation (e.g. a loser hitting a lock timeout) are tolerated on
 * purpose: what must hold is the final state.
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
class MpesaIdempotencyConcurrencyTest {

    @Autowired lateinit var service: MpesaService
    @Autowired lateinit var txRepo: MpesaTransactionRepository
    @Autowired lateinit var paymentRepo: PaymentRepository
    @Autowired lateinit var userRepo: UserRepository
    @Autowired lateinit var institutionRepo: InstitutionRepository
    @Autowired lateinit var passwordEncoder: PasswordEncoder

    private var institutionId: Long? = null
    private var learnerId: Long? = null
    private val createdCheckouts = mutableListOf<String>()

    private fun learner(): Long {
        if (learnerId == null) {
            val inst = institutionRepo.save(Institution(name = "Concurrency Test Academy", county = "Test", subCounty = "Test"))
            institutionId = inst.id
            val u: User = userRepo.save(
                User(
                    email = "concurrency-learner-${System.nanoTime()}@example.com",
                    name = "Concurrency Learner",
                    password = passwordEncoder.encode("pass123"),
                    role = UserRole.STUDENT,
                    institutionId = inst.id,
                )
            )
            learnerId = u.id
        }
        return learnerId!!
    }

    private fun callback(checkoutId: String) = mapOf(
        "Body" to mapOf(
            "stkCallback" to mapOf(
                "CheckoutRequestID" to checkoutId,
                "ResultCode" to 0,
                "ResultDesc" to "Service request processed",
                "CallbackMetadata" to mapOf(
                    "Item" to listOf(
                        mapOf("Name" to "Amount", "Value" to 100),
                        mapOf("Name" to "MpesaReceiptNumber", "Value" to "RCPT-$checkoutId"),
                    )
                ),
            )
        )
    )

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
    fun `concurrent duplicate callbacks create exactly one financial credit`() {
        val checkoutId = "CONC-DUP-1"
        createdCheckouts += checkoutId
        val l = learner()
        txRepo.save(
            MpesaTransaction(
                checkoutRequestId = checkoutId,
                phoneNumber = "+254700000000",
                amount = 100.0,
                reference = "ELEKEZA-FEES-$l",
                description = "concurrency test",
                status = "INITIATED",
            )
        )

        val threads = 4
        val barrier = CyclicBarrier(threads)
        val pool = Executors.newFixedThreadPool(threads)
        val tasks = (1..threads).map {
            Callable {
                runCatching {
                    barrier.await(10, TimeUnit.SECONDS)
                    service.processCallback(callback(checkoutId))
                }
            }
        }

        try {
            pool.invokeAll(tasks)
        } finally {
            pool.shutdownNow()
        }

        // The invariant that matters — regardless of which thread won.
        val payments = paymentRepo.findAll().filter { it.checkoutRequestId == checkoutId }
        assertThat(payments).hasSize(1)
        assertThat(payments.sumOf { it.amount }).isEqualTo(100.0)

        val rows = txRepo.findAll().filter { it.checkoutRequestId == checkoutId }
        assertThat(rows).hasSize(1)
        assertThat(rows.single().status).isEqualTo(MpesaStatus.COMPLETED)
    }
}
