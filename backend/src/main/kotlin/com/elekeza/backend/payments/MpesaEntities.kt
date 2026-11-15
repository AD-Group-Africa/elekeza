package com.elekeza.backend.payments

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.Table
import jakarta.persistence.UniqueConstraint
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Modifying
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param
import org.springframework.stereotype.Repository
import java.time.Instant

/** Provider transaction statuses. Terminal = COMPLETED, FAILED, REQUIRES_REVIEW. */
object MpesaStatus {
    const val PENDING = "PENDING"                              // durable intent, provider not yet acknowledged
    const val INITIATED = "INITIATED"                          // provider accepted; awaiting callback
    const val AWAITING_VERIFICATION = "AWAITING_VERIFICATION"  // success claimed, not yet independently verified
    const val COMPLETED = "COMPLETED"                          // verified success (terminal)
    const val FAILED = "FAILED"                                // provider/verification says failed (terminal)
    const val REQUIRES_REVIEW = "REQUIRES_REVIEW"              // surface for investigation, never auto-credit (terminal)

    val NON_TERMINAL = listOf(PENDING, INITIATED, AWAITING_VERIFICATION)
    val TERMINAL = listOf(COMPLETED, FAILED, REQUIRES_REVIEW)
}

/**
 * M-Pesa provider ledger.
 *
 * `checkout_request_id` is UNIQUE: it is the canonical identifier of exactly one
 * provider transaction, and that uniqueness is the database-level half of the
 * idempotency guarantee (the other half is the conditional status transition in
 * [MpesaTransactionRepository.transitionNonTerminal]). NULL is allowed and not
 * constrained — multiple NULLs coexist for durable intents that never received a
 * provider id.
 */
@Entity
@Table(
    name = "mpesa_transactions",
    uniqueConstraints = [UniqueConstraint(name = "ux_mpesa_tx_checkout_request_id", columnNames = ["checkout_request_id"])]
)
data class MpesaTransaction(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,
    val merchantRequestId: String? = null,
    val checkoutRequestId: String? = null,
    val phoneNumber: String,
    val amount: Double,
    val reference: String,
    val description: String,
    val status: String = "PENDING",
    val resultCode: Int? = null,
    val resultDesc: String? = null,
    val mpesaReceiptNumber: String? = null,
    val transactionDate: Instant? = null,
    @Column(name = "verification_attempts", nullable = false)
    val verificationAttempts: Int = 0,
    @Column(name = "next_verification_at")
    val nextVerificationAt: Instant? = null,
    @Column(name = "last_verified_at")
    val lastVerifiedAt: Instant? = null,
    val createdAt: Instant = Instant.now(),
    val updatedAt: Instant = Instant.now()
)

@Repository
interface MpesaTransactionRepository : JpaRepository<MpesaTransaction, Long> {

    fun findByCheckoutRequestId(checkoutRequestId: String): MpesaTransaction?

    fun findByStatusInAndUpdatedAtBefore(statuses: Collection<String>, cutoff: Instant): List<MpesaTransaction>

    fun countByStatus(status: String): Long

    /**
     * Atomically moves a NON-TERMINAL row to a new status. Returns the number of
     * rows updated: 1 = this caller won the transition and owns the right to
     * create any financial side effect; 0 = another caller already moved it (or
     * it was terminal) and this caller must do nothing.
     *
     * The conditional UPDATE is what makes concurrent duplicate callbacks safe:
     * the row lock serialises the two statements, and the loser's WHERE clause no
     * longer matches after the winner commits. This is a database guarantee, not
     * an in-memory lock.
     */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query(
        """
        UPDATE MpesaTransaction t
           SET t.status = :status,
               t.resultCode = :resultCode,
               t.resultDesc = :resultDesc,
               t.mpesaReceiptNumber = :receipt,
               t.transactionDate = :at,
               t.lastVerifiedAt = :at,
               t.updatedAt = :at
         WHERE t.checkoutRequestId = :checkout
           AND t.status IN ('PENDING', 'INITIATED', 'AWAITING_VERIFICATION')
        """
    )
    fun transitionNonTerminal(
        @Param("checkout") checkout: String,
        @Param("status") status: String,
        @Param("resultCode") resultCode: Int?,
        @Param("resultDesc") resultDesc: String?,
        @Param("receipt") receipt: String?,
        @Param("at") at: Instant,
    ): Int

    /**
     * Records a failed verification attempt and schedules the next one, keeping
     * the row non-terminal. Returns 1 when claimed (so only one worker bumps the
     * counter), 0 when the row already moved on.
     */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query(
        """
        UPDATE MpesaTransaction t
           SET t.verificationAttempts = t.verificationAttempts + 1,
               t.nextVerificationAt = :next,
               t.updatedAt = :now
         WHERE t.id = :id
           AND t.status IN ('PENDING', 'INITIATED', 'AWAITING_VERIFICATION')
        """
    )
    fun claimVerificationAttempt(
        @Param("id") id: Long,
        @Param("next") next: Instant,
        @Param("now") now: Instant,
    ): Int

    /**
     * Escalates a non-terminal row (including a durable intent with no checkout
     * id) to manual review. Never credits, never deletes: unknown or exhausted
     * transactions are surfaced rather than discarded.
     */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query(
        """
        UPDATE MpesaTransaction t
           SET t.status = 'REQUIRES_REVIEW',
               t.resultDesc = :reason,
               t.updatedAt = :now
         WHERE t.id = :id
           AND t.status IN ('PENDING', 'INITIATED', 'AWAITING_VERIFICATION')
        """
    )
    fun markRequiresReview(
        @Param("id") id: Long,
        @Param("reason") reason: String,
        @Param("now") now: Instant,
    ): Int
}
