package com.elekeza.backend.payments

import org.slf4j.LoggerFactory
import org.springframework.beans.factory.annotation.Value
import org.springframework.scheduling.annotation.Scheduled
import org.springframework.stereotype.Component
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.Instant
import kotlin.math.min

/** Outcome of one reconciliation attempt. */
enum class ReconcileOutcome { RESOLVED, RETRIED, ESCALATED, SKIPPED }

data class ReconciliationSummary(
    val considered: Int = 0,
    val resolved: Int = 0,
    val retried: Int = 0,
    val escalated: Int = 0,
    val skipped: Int = 0,
) {
    operator fun plus(other: ReconcileOutcome): ReconciliationSummary = when (other) {
        ReconcileOutcome.RESOLVED -> copy(considered = considered + 1, resolved = resolved + 1)
        ReconcileOutcome.RETRIED -> copy(considered = considered + 1, retried = retried + 1)
        ReconcileOutcome.ESCALATED -> copy(considered = considered + 1, escalated = escalated + 1)
        ReconcileOutcome.SKIPPED -> copy(considered = considered + 1, skipped = skipped + 1)
    }
}

/**
 * Single-transaction reconciliation of one uncertain M-Pesa transaction.
 *
 * Kept as its own bean (not a private method of the scheduler) so Spring's
 * transactional proxy actually applies: a self-invocation would silently run
 * outside a transaction and the `@Modifying` claims would fail. Each row is
 * resolved in isolation, so one bad row cannot roll back the batch.
 */
@Component
class MpesaReconciliationWorker(
    private val transactionRepo: MpesaTransactionRepository,
    private val statusVerifier: MpesaStatusVerifier,
    private val finalizer: MpesaPaymentFinalizer,
    private val auditLogService: com.elekeza.backend.common.AuditLogService,
    @Value("\${payments.reconciliation.max-attempts:8}") private val maxAttempts: Int,
    @Value("\${payments.reconciliation.base-backoff-seconds:30}") private val baseBackoffSeconds: Long,
) {
    private val log = LoggerFactory.getLogger(javaClass)

    @Transactional
    fun reconcileOne(id: Long): ReconcileOutcome {
        val tx = transactionRepo.findById(id).orElse(null) ?: return ReconcileOutcome.SKIPPED
        if (tx.status in MpesaStatus.TERMINAL) return ReconcileOutcome.SKIPPED

        val checkout = tx.checkoutRequestId
        if (checkout.isNullOrBlank()) {
            // Durable intent that never received a provider id: the provider may
            // or may not have accepted it and there is nothing to query by.
            // Surface it for a human; never guess.
            val claimed = transactionRepo.markRequiresReview(
                tx.id,
                "provider outcome unknown: submitted without a stored CheckoutRequestID",
                Instant.now(),
            )
            if (claimed > 0) {
                auditLogService.log(
                    action = "MPESA_RECONCILE_ESCALATED", category = "PAYMENT",
                    detail = "txId=${tx.id} outcome=no-provider-id-requires-review", success = false,
                )
                log.error("M-Pesa intent {} has no CheckoutRequestID — escalated to REQUIRES_REVIEW", tx.id)
                return ReconcileOutcome.ESCALATED
            }
            return ReconcileOutcome.SKIPPED
        }

        return when (val outcome = statusVerifier.verify(checkout)) {
            is VerificationOutcome.Confirmed -> {
                val done = finalizer.finalizeConfirmed(tx, tx.mpesaReceiptNumber, "Reconciled: provider confirmed success")
                if (done) {
                    auditLogService.log(
                        action = "MPESA_RECONCILED", category = "PAYMENT",
                        detail = "checkoutRequestId=$checkout outcome=completed",
                    )
                    log.info("Reconciled M-Pesa {} as COMPLETED", checkout)
                }
                if (done) ReconcileOutcome.RESOLVED else ReconcileOutcome.SKIPPED
            }
            is VerificationOutcome.NotSuccessful -> {
                val done = finalizer.markFailed(tx, tx.resultCode, "Reconciled: provider reports not successful")
                if (done) ReconcileOutcome.RESOLVED else ReconcileOutcome.SKIPPED
            }
            is VerificationOutcome.Unavailable -> scheduleRetry(tx, outcome.reason)
        }
    }

    private fun scheduleRetry(tx: MpesaTransaction, reason: String): ReconcileOutcome {
        val attempts = tx.verificationAttempts + 1
        if (attempts >= maxAttempts) {
            val claimed = transactionRepo.markRequiresReview(
                tx.id,
                "verification exhausted after $attempts attempts: $reason",
                Instant.now(),
            )
            if (claimed > 0) {
                auditLogService.log(
                    action = "MPESA_RECONCILE_ESCALATED", category = "PAYMENT",
                    detail = "checkoutRequestId=${tx.checkoutRequestId} attempts=$attempts", success = false,
                )
                log.error("M-Pesa {} could not be verified after {} attempts — REQUIRES_REVIEW", tx.checkoutRequestId, attempts)
                return ReconcileOutcome.ESCALATED
            }
            return ReconcileOutcome.SKIPPED
        }
        // Exponential backoff, capped at one hour. No status change: the row is
        // already non-terminal and must not be marked failed merely because the
        // provider could not be reached.
        val backoff = min(baseBackoffSeconds * (1L shl min(attempts, 6)), 3_600L)
        val claimed = transactionRepo.claimVerificationAttempt(tx.id, Instant.now().plusSeconds(backoff), Instant.now())
        return if (claimed > 0) {
            auditLogService.log(
                action = "MPESA_RECONCILE_RETRY", category = "PAYMENT",
                detail = "checkoutRequestId=${tx.checkoutRequestId} attempt=$attempts backoffSeconds=$backoff",
            )
            log.info("M-Pesa {} unverifiable ({}); retry #{} in {}s", tx.checkoutRequestId, reason, attempts, backoff)
            ReconcileOutcome.RETRIED
        } else {
            ReconcileOutcome.SKIPPED
        }
    }
}

/**
 * Bounded, retryable recovery for transactions whose outcome is uncertain:
 * missing/delayed callbacks, provider timeouts, callbacks that arrived after a
 * UI timeout, and durable intents whose provider call failed after acceptance.
 *
 * SAFETY: does nothing unless the deployment can actually verify with the
 * provider ([MpesaStatusVerifier.isLive]). In mock/dev mode this job never runs,
 * so it can never fabricate a completed payment.
 */
@Service
class MpesaReconciliationService(
    private val transactionRepo: MpesaTransactionRepository,
    private val statusVerifier: MpesaStatusVerifier,
    private val worker: MpesaReconciliationWorker,
    @Value("\${payments.reconciliation.enabled:true}") private val enabled: Boolean,
    @Value("\${payments.reconciliation.stale-after-seconds:300}") private val staleAfterSeconds: Long,
) {
    private val log = LoggerFactory.getLogger(javaClass)

    @Scheduled(
        fixedDelayString = "\${payments.reconciliation.interval-ms:300000}",
        initialDelayString = "\${payments.reconciliation.initial-delay-ms:120000}",
    )
    fun scheduledReconcile() {
        runCatching { reconcile() }
            .onFailure { log.error("M-Pesa reconciliation run failed: {}", it.message) }
    }

    /**
     * One reconciliation pass. Runs only when live verification is configured;
     * everything else is a no-op (never auto-credits in mock mode).
     */
    fun reconcile(): ReconciliationSummary {
        if (!enabled) return ReconciliationSummary()
        if (!statusVerifier.isLive) {
            log.debug("M-Pesa reconciliation skipped: live provider verification is not configured")
            return ReconciliationSummary()
        }

        val now = Instant.now()
        val cutoff = now.minusSeconds(staleAfterSeconds)
        val candidates = transactionRepo.findByStatusInAndUpdatedAtBefore(MpesaStatus.NON_TERMINAL, cutoff)

        var summary = ReconciliationSummary()
        for (tx in candidates) {
            if (tx.nextVerificationAt?.isAfter(now) == true) continue
            summary += runCatching { worker.reconcileOne(tx.id) }
                .getOrElse {
                    log.error("M-Pesa reconciliation failed for transaction {}: {}", tx.id, it.message)
                    ReconcileOutcome.SKIPPED
                }
        }
        if (summary.considered > 0) log.info("M-Pesa reconciliation: {}", summary)
        return summary
    }
}
