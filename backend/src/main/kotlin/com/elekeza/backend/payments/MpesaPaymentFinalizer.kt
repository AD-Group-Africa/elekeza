package com.elekeza.backend.payments

import com.elekeza.backend.finance.MpesaPaymentListener
import org.slf4j.LoggerFactory
import org.springframework.stereotype.Component
import org.springframework.transaction.annotation.Transactional
import java.time.Instant

/**
 * The single place where an M-Pesa transaction becomes terminal and where a
 * financial credit is created.
 *
 * CONTRACT: the credit happens **only after** [MpesaTransactionRepository.transitionNonTerminal]
 * reports that this caller won the COMPLETED transition (returned 1). That
 * conditional UPDATE is the concurrency gate — two simultaneous callbacks (or a
 * callback racing the reconciliation job) serialise on the row, and exactly one
 * of them observes 1. This is what prevents duplicate financial credits, in
 * addition to the UNIQUE constraint on `payments.checkout_request_id`.
 *
 * If the credit itself fails, the exception propagates and the whole
 * transaction (including the status change) rolls back, leaving the row
 * non-terminal for reconciliation to retry. Losing money silently is not an
 * acceptable failure mode.
 */
@Component
class MpesaPaymentFinalizer(
    private val transactionRepo: MpesaTransactionRepository,
    private val feePaymentListener: MpesaPaymentListener,
) {
    private val log = LoggerFactory.getLogger(javaClass)

    /**
     * Verified success → COMPLETED + credit. Returns true when this caller
     * performed the transition; false when the row was already terminal.
     */
    @Transactional
    fun finalizeConfirmed(tx: MpesaTransaction, receipt: String?, resultDesc: String?): Boolean {
        val checkoutId = tx.checkoutRequestId ?: return false
        val claimed = transactionRepo.transitionNonTerminal(
            checkout = checkoutId,
            status = MpesaStatus.COMPLETED,
            resultCode = 0,
            resultDesc = resultDesc ?: "Verified success",
            receipt = receipt,
            at = Instant.now(),
        )
        if (claimed == 0) {
            log.info("M-Pesa {} is already terminal — refusing to credit again (idempotent)", checkoutId)
            return false
        }
        creditFees(tx, checkoutId, receipt)
        return true
    }

    /**
     * Moves a verified non-success to a terminal status (FAILED) without any
     * credit. Returns true when this caller performed the transition.
     */
    @Transactional
    fun markFailed(tx: MpesaTransaction, resultCode: Int?, resultDesc: String?): Boolean {
        val checkoutId = tx.checkoutRequestId ?: return false
        val claimed = transactionRepo.transitionNonTerminal(
            checkout = checkoutId,
            status = MpesaStatus.FAILED,
            resultCode = resultCode,
            resultDesc = resultDesc,
            receipt = null,
            at = Instant.now(),
        )
        if (claimed > 0) log.info("M-Pesa {} marked FAILED: {}", checkoutId, resultDesc)
        return claimed > 0
    }

    /**
     * Success claimed by the provider but NOT independently verified: park the
     * row so no credit is created and the reconciliation job can resolve it.
     */
    @Transactional
    fun parkAwaitingVerification(tx: MpesaTransaction, reason: String): Boolean {
        val checkoutId = tx.checkoutRequestId ?: return false
        val claimed = transactionRepo.transitionNonTerminal(
            checkout = checkoutId,
            status = MpesaStatus.AWAITING_VERIFICATION,
            resultCode = null,
            resultDesc = reason,
            receipt = null,
            at = Instant.now(),
        )
        if (claimed > 0) {
            log.warn("M-Pesa {} parked as AWAITING_VERIFICATION ({}) — no credit until verified", checkoutId, reason)
        }
        return claimed > 0
    }

    private fun creditFees(tx: MpesaTransaction, checkoutId: String, receipt: String?) {
        val learnerId = tx.reference.split("-").lastOrNull()?.toLongOrNull()
        if (learnerId == null) {
            log.info(
                "M-Pesa {} verified COMPLETED but reference '{}' carries no learner id — provider ledger only",
                checkoutId, tx.reference
            )
            return
        }
        val payment = feePaymentListener.onMpesaSuccess(checkoutId, learnerId, tx.amount, receipt)
        if (payment == null) {
            log.warn(
                "M-Pesa {} verified COMPLETED but no new finance payment was created (already mapped, " +
                    "or the learner could not be matched) — verify manually if unexpected",
                checkoutId
            )
        }
    }
}
