package com.elekeza.backend.payments

import com.elekeza.backend.auth.User
import com.elekeza.backend.auth.UserRepository
import com.elekeza.backend.auth.UserRole
import com.elekeza.backend.finance.Payment
import com.elekeza.backend.finance.PaymentMethod
import com.elekeza.backend.finance.PaymentRepository
import com.elekeza.backend.finance.PaymentStatus
import com.elekeza.backend.institution.Institution
import com.elekeza.backend.institution.InstitutionRepository
import org.assertj.core.api.Assertions.assertThat
import org.assertj.core.api.Assertions.assertThatThrownBy
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.dao.DataIntegrityViolationException
import org.springframework.security.crypto.password.PasswordEncoder

/**
 * The database-level half of the idempotency guarantee. Application checks can
 * be raced; the unique index cannot. Each `saveAndFlush` runs in its own
 * transaction so the second write really hits the constraint.
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
class PaymentUniquenessConstraintTest {

    @Autowired lateinit var txRepo: MpesaTransactionRepository
    @Autowired lateinit var paymentRepo: PaymentRepository
    @Autowired lateinit var userRepo: UserRepository
    @Autowired lateinit var institutionRepo: InstitutionRepository
    @Autowired lateinit var passwordEncoder: PasswordEncoder

    private val createdTxIds = mutableListOf<Long>()
    private val createdPaymentIds = mutableListOf<Long>()
    private var institutionId: Long? = null
    private var learnerId: Long? = null

    private fun learner(): Long {
        if (learnerId == null) {
            val inst = institutionRepo.save(Institution(name = "Uniqueness Test Academy", county = "Test", subCounty = "Test"))
            institutionId = inst.id
            val u: User = userRepo.save(
                User(
                    email = "uniqueness-learner-${System.nanoTime()}@example.com",
                    name = "Uniqueness Learner",
                    password = passwordEncoder.encode("pass123"),
                    role = UserRole.STUDENT,
                    institutionId = inst.id,
                )
            )
            learnerId = u.id
        }
        return learnerId!!
    }

    private fun txEntity(checkoutId: String?) = MpesaTransaction(
        checkoutRequestId = checkoutId,
        phoneNumber = "+254700000000",
        amount = 10.0,
        reference = "ELEKEZA-FEES-${learner()}",
        description = "uniqueness test",
        status = "INITIATED",
    )

    private fun saveTx(checkoutId: String?) {
        createdTxIds += txRepo.saveAndFlush(txEntity(checkoutId)).id
    }

    private fun paymentEntity(checkoutId: String?, number: String): Payment {
        learner()
        return Payment(
            institutionId = institutionId!!,
            learnerId = learnerId!!,
            amount = 10.0,
            method = PaymentMethod.MPESA,
            status = PaymentStatus.COMPLETED,
            providerRef = null,
            checkoutRequestId = checkoutId,
            note = null,
            recordedBy = null,
            paymentNumber = number,
        )
    }

    private fun savePayment(checkoutId: String?, number: String) {
        createdPaymentIds += paymentRepo.saveAndFlush(paymentEntity(checkoutId, number)).id
    }

    @AfterEach
    fun cleanUp() {
        createdPaymentIds.forEach { id -> paymentRepo.findById(id).ifPresent { paymentRepo.delete(it) } }
        createdPaymentIds.clear()
        createdTxIds.forEach { id -> txRepo.findById(id).ifPresent { txRepo.delete(it) } }
        createdTxIds.clear()
        learnerId?.let { id -> userRepo.findById(id).ifPresent { userRepo.delete(it) } }
        learnerId = null
        institutionId?.let { id -> institutionRepo.findById(id).ifPresent { institutionRepo.delete(it) } }
        institutionId = null
    }

    @Test
    fun `a second mpesa transaction with the same checkout id is rejected by the database`() {
        saveTx("UNIQ-TX-1")

        assertThatThrownBy { txRepo.saveAndFlush(txEntity("UNIQ-TX-1")) }
            .isInstanceOf(DataIntegrityViolationException::class.java)
    }

    @Test
    fun `a second payment with the same checkout id is rejected by the database`() {
        savePayment("UNIQ-PAY-1", "RCP-UNIQ-1")

        assertThatThrownBy { paymentRepo.saveAndFlush(paymentEntity("UNIQ-PAY-1", "RCP-UNIQ-2")) }
            .isInstanceOf(DataIntegrityViolationException::class.java)
    }

    @Test
    fun `multiple null checkout ids remain allowed`() {
        // Manual payments and durable intents carry no provider id; the unique
        // index must not block them (standard SQL: NULLs are distinct).
        savePayment(null, "RCP-NULL-1")
        savePayment(null, "RCP-NULL-2")
        saveTx(null)
        saveTx(null)

        assertThat(createdPaymentIds).hasSize(2)
        assertThat(createdTxIds).hasSize(2)
        assertThat(txRepo.countByStatus(MpesaStatus.INITIATED)).isGreaterThanOrEqualTo(2)
    }
}
