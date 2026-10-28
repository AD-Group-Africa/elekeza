package com.elekeza.backend.payments

import org.slf4j.LoggerFactory
import org.springframework.beans.factory.annotation.Value
import org.springframework.http.*
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.client.RestTemplate
import org.springframework.web.server.ResponseStatusException
import java.time.Instant
import java.time.LocalDateTime
import java.time.format.DateTimeFormatter
import java.util.Base64

/**
 * Daraja-backed M-Pesa provider integration.
 *
 * TRUST MODEL (2026-10-16 payment-security remediation)
 * ----------------------------------------------------
 * The STK callback is UNSIGNED. Safaricom publishes no HMAC or signature header
 * for it, so the callback body is a *notification*, never proof of payment. The
 * supported controls are (a) allowlisting the published Daraja callback source
 * IPs at the network edge — operational, not enforced here — and (b) verifying
 * the outcome with the STK Push Query API. This service therefore finalises a
 * payment only when [MpesaStatusVerifier] independently returns
 * [VerificationOutcome.Confirmed]; an unverifiable success is parked in
 * AWAITING_VERIFICATION and resolved later by the reconciliation job, never
 * credited on the callback's word alone.
 *
 * In `mock` mode (the default; no provider credentials) the callback IS the
 * simulated provider signal and confirms directly. That mode moves no real money
 * and must never be used for a live deployment.
 */
@Service
class MpesaService(
    @Value("\${mpesa.consumer-key:}") private val consumerKey: String,
    @Value("\${mpesa.consumer-secret:}") private val consumerSecret: String,
    @Value("\${mpesa.passkey:}") private val passkey: String,
    @Value("\${mpesa.shortcode:174379}") private val shortcode: String,
    @Value("\${mpesa.callback-url:}") private val callbackUrl: String,
    @Value("\${mpesa.environment:sandbox}") private val environment: String,
    private val transactionRepo: MpesaTransactionRepository,
    private val restTemplate: RestTemplate,
    private val statusVerifier: MpesaStatusVerifier,
    private val finalizer: MpesaPaymentFinalizer,
    private val auditLogService: com.elekeza.backend.common.AuditLogService,
) {
    private val log = LoggerFactory.getLogger(javaClass)
    private val baseUrl =
        if (environment == "production") "https://api.safaricom.co.ke" else "https://sandbox.safaricom.co.ke"

    fun stkPush(phoneNumber: String, amount: Double, reference: String, description: String): Map<String, Any> {
        if (consumerKey.isBlank() || consumerSecret.isBlank()) {
            throw ResponseStatusException(
                HttpStatus.SERVICE_UNAVAILABLE,
                "M-Pesa payments are not configured for this deployment."
            )
        }
        if (callbackUrl.isBlank()) {
            // Sending to Daraja without a callback URL would strand the payment.
            throw ResponseStatusException(
                HttpStatus.SERVICE_UNAVAILABLE,
                "M-Pesa callback URL is not configured for this deployment."
            )
        }

        // Durable intent FIRST: if the provider accepts the request but the
        // process dies before we record its id, the row survives as PENDING and
        // is surfaced for review by reconciliation instead of vanishing.
        val intent = transactionRepo.save(
            MpesaTransaction(
                merchantRequestId = null,
                checkoutRequestId = null,
                phoneNumber = phoneNumber,
                amount = amount,
                reference = reference,
                description = description,
                status = MpesaStatus.PENDING,
            )
        )

        val token = getAccessToken()
        val timestamp = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMddHHmmss"))
        val password = Base64.getEncoder().encodeToString("$shortcode$passkey$timestamp".toByteArray())

        val body = mapOf(
            "BusinessShortCode" to shortcode,
            "Password" to password,
            "Timestamp" to timestamp,
            "TransactionType" to "CustomerPayBillOnline",
            "Amount" to amount.toInt(),
            "PartyA" to phoneNumber.replace("+", ""),
            "PartyB" to shortcode,
            "PhoneNumber" to phoneNumber.replace("+", ""),
            "CallBackURL" to callbackUrl,
            "AccountReference" to reference,
            "TransactionDesc" to description
        )

        val headers = HttpHeaders().apply {
            contentType = MediaType.APPLICATION_JSON
            setBearerAuth(token)
        }

        @Suppress("UNCHECKED_CAST")
        val response = restTemplate.exchange(
            "$baseUrl/mpesa/stkpush/v1/processrequest",
            HttpMethod.POST,
            HttpEntity(body, headers),
            Map::class.java
        ) as ResponseEntity<Map<String, Any>>

        @Suppress("UNCHECKED_CAST") val responseBody: Map<String, Any> = response.body as? Map<String, Any> ?: emptyMap()
        val checkoutRequestId = responseBody["CheckoutRequestID"] as? String

        if (checkoutRequestId.isNullOrBlank()) {
            auditLogService.log(
                action = "MPESA_STK_REVIEW", category = "PAYMENT",
                detail = "intentId=${intent.id} outcome=provider-no-checkout-id", success = false,
            )
            // Provider answered but gave no id we can correlate. Surface it.
            transactionRepo.save(
                intent.copy(
                    status = MpesaStatus.REQUIRES_REVIEW,
                    resultDesc = "provider accepted the request without a CheckoutRequestID",
                    updatedAt = Instant.now(),
                )
            )
        } else {
            transactionRepo.save(
                intent.copy(
                    merchantRequestId = responseBody["MerchantRequestID"] as? String,
                    checkoutRequestId = checkoutRequestId,
                    status = MpesaStatus.INITIATED,
                    updatedAt = Instant.now(),
                )
            )
            auditLogService.log(
                action = "MPESA_STK_ACCEPTED", category = "PAYMENT",
                detail = "intentId=${intent.id} checkoutRequestId=$checkoutRequestId",
            )
        }

        return mapOf(
            "success" to (response.statusCode == HttpStatus.OK),
            "merchantRequestId" to (responseBody["MerchantRequestID"] ?: "") as Any,
            "checkoutRequestId" to (checkoutRequestId ?: "") as Any,
            "message" to (responseBody["ResponseDescription"] ?: "") as Any
        )
    }

    /**
     * Handles the Safaricom STK callback. The endpoint is intentionally
     * unauthenticated (the provider cannot hold a session), so this handler is
     * defensive and treats the payload as untrusted:
     *
     *  - only a transaction we initiated, still non-terminal, is eligible;
     *  - the callback Amount must match the amount we initiated;
     *  - a claimed SUCCESS is finalised ONLY after independent verification
     *    (STK Push Query in live mode) — an unverifiable success is parked as
     *    AWAITING_VERIFICATION and creates no credit;
     *  - a verified non-success becomes FAILED;
     *  - terminal rows are never reopened (duplicate/replayed callbacks are
     *    acknowledged and ignored);
     *  - unknown checkout ids are rejected and logged, never recorded.
     */
    @Transactional
    fun processCallback(body: Map<String, Any>): Map<String, Any> {
        val stkCallback = (body["Body"] as? Map<*, *>)?.get("stkCallback") as? Map<String, Any>
        val checkoutRequestId = stkCallback?.get("CheckoutRequestID") as? String
        if (checkoutRequestId == null) {
            log.warn("M-Pesa callback without a CheckoutRequestID")
            return mapOf("ResultCode" to 1, "ResultDesc" to "Failed")
        }

        val transaction = transactionRepo.findByCheckoutRequestId(checkoutRequestId)
        if (transaction == null) {
            auditLogService.log(
                action = "MPESA_CALLBACK_UNKNOWN", category = "PAYMENT",
                detail = "checkoutRequestId=$checkoutRequestId", success = false,
            )
            log.warn("M-Pesa callback for unknown CheckoutRequestID {}", checkoutRequestId)
            return mapOf("ResultCode" to 1, "ResultDesc" to "Failed")
        }

        // Idempotency: terminal transactions are final. This also blocks
        // replaying a forged success body after a FAILED result.
        if (transaction.status in MpesaStatus.TERMINAL) {
            auditLogService.log(
                action = "MPESA_CALLBACK_DUPLICATE", category = "PAYMENT",
                detail = "checkoutRequestId=$checkoutRequestId status=${transaction.status}",
            )
            log.info("Ignoring duplicate M-Pesa callback for terminal transaction {} ({})", checkoutRequestId, transaction.status)
            return mapOf("ResultCode" to 0, "ResultDesc" to "Success")
        }

        val resultCode = (stkCallback["ResultCode"] as? Number)?.toInt() ?: -1
        val resultDesc = stkCallback["ResultDesc"] as? String
        val metadata = (stkCallback["CallbackMetadata"] as? Map<*, *>)?.get("Item") as? List<Map<String, Any>>
        val callbackAmount = (metadata?.find { it["Name"] == "Amount" }?.get("Value") as? Number)?.toDouble()
        val receipt = metadata?.find { it["Name"] == "MpesaReceiptNumber" }?.get("Value") as? String

        // The amount the provider reports must equal what we initiated.
        auditLogService.log(
            action = "MPESA_CALLBACK", category = "PAYMENT",
            detail = "checkoutRequestId=$checkoutRequestId resultCode=$resultCode amountKES=${transaction.amount}",
            success = true,
        )
        if (callbackAmount != null && Math.abs(callbackAmount - transaction.amount) > 0.001) {
            auditLogService.log(
                action = "MPESA_CALLBACK_MISMATCH", category = "PAYMENT",
                detail = "checkoutRequestId=$checkoutRequestId actually-initiated-KES=${transaction.amount}",
                success = false,
            )
            log.warn(
                "M-Pesa callback amount mismatch for {}: initiated KES {} but callback reports KES {}",
                checkoutRequestId, transaction.amount, callbackAmount
            )
            return mapOf("ResultCode" to 1, "ResultDesc" to "Amount mismatch")
        }

        // Provider reports failure/cancellation — no verification needed to
        // refuse a credit, and a definitive failure is safe to record.
        // SPRINT 3 P1 FIX: A non-zero ResultCode from an unauthenticated callback
        // is NOT proof of failure. Anyone with a known checkout ID could forge
        // a failure callback and permanently terminate a legitimate in-flight
        // payment (FAILED is terminal; reconciliation only retries non-terminal).
        // In live mode, verify with the provider before any terminal transition.
        if (resultCode != 0) {
            if (!statusVerifier.isLive) {
                // Mock mode: the callback IS the provider signal, no real money.
                finalizer.markFailed(transaction, resultCode, resultDesc)
                return mapOf("ResultCode" to 0, "ResultDesc" to "Success")
            }
            when (val failureOutcome = statusVerifier.verify(checkoutRequestId)) {
                is VerificationOutcome.Confirmed -> {
                    auditLogService.log(
                        action = "MPESA_FAILURE_CALLBACK_CONTRADICTED", category = "PAYMENT",
                        detail = "checkoutRequestId=$checkoutRequestId outcome=provider-confirms-success",
                        success = false,
                    )
                    log.warn("M-Pesa callback reported failure for {} but provider confirms success - finalising, not failing", checkoutRequestId)
                    finalizer.finalizeConfirmed(transaction, receipt, "Callback non-zero but provider confirmed success")
                }
                is VerificationOutcome.NotSuccessful -> {
                    finalizer.markFailed(transaction, resultCode, resultDesc)
                }
                is VerificationOutcome.Unavailable -> {
                    auditLogService.log(
                        action = "MPESA_FAILURE_CALLBACK_UNVERIFIED", category = "PAYMENT",
                        detail = "checkoutRequestId=$checkoutRequestId outcome=parked-for-reconciliation",
                        success = false,
                    )
                    finalizer.parkAwaitingVerification(transaction, "failure callback unverified: ${failureOutcome.reason}")
                }
            }
            return mapOf("ResultCode" to 0, "ResultDesc" to "Success")
        }

        // Provider CLAIMS success. Do not credit on that claim alone.
        when (val outcome = statusVerifier.verify(checkoutRequestId)) {
            is VerificationOutcome.Confirmed -> {
                log.info("M-Pesa payment {} independently verified — finalising", checkoutRequestId)
                finalizer.finalizeConfirmed(transaction, receipt, resultDesc)
            }
            is VerificationOutcome.NotSuccessful -> {
                auditLogService.log(
                    action = "MPESA_REFUSED", category = "PAYMENT",
                    detail = "checkoutRequestId=$checkoutRequestId outcome=provider-contradiction", success = false,
                )
                log.warn(
                    "M-Pesa callback claimed success for {} but the provider query says otherwise — refusing credit",
                    checkoutRequestId
                )
                finalizer.markFailed(transaction, resultCode, "Provider verification returned not successful")
            }
            is VerificationOutcome.Unavailable -> {
                auditLogService.log(
                    action = "MPESA_AWAITING", category = "PAYMENT",
                    detail = "checkoutRequestId=$checkoutRequestId outcome=unverified-parked", success = false,
                )
                // Fail closed: acknowledge receipt, create no credit, let the
                // reconciliation job resolve the true outcome.
                finalizer.parkAwaitingVerification(transaction, "unverified: ${outcome.reason}")
            }
        }

        return mapOf("ResultCode" to 0, "ResultDesc" to "Success")
    }

    fun getRevenue(): Map<String, Any> {
        val transactions = transactionRepo.findAll()
        val totalRevenue = transactions.filter { it.status == MpesaStatus.COMPLETED }.sumOf { it.amount }
        val thisMonth = transactions.filter {
            it.createdAt.atZone(java.time.ZoneId.systemDefault()).month == Instant.now().atZone(java.time.ZoneId.systemDefault()).month
        }

        return mapOf(
            "totalRevenue" to totalRevenue,
            "transactionCount" to transactions.size,
            "successfulTransactions" to transactions.count { it.status == MpesaStatus.COMPLETED },
            "failedTransactions" to transactions.count { it.status == MpesaStatus.FAILED },
            "awaitingVerification" to transactions.count { it.status == MpesaStatus.AWAITING_VERIFICATION },
            "requiresReview" to transactions.count { it.status == MpesaStatus.REQUIRES_REVIEW },
            "revenueThisMonth" to thisMonth.filter { it.status == MpesaStatus.COMPLETED }.sumOf { it.amount },
            "monthlyRevenue" to (0..5).map { monthsAgo ->
                val targetMonth = LocalDateTime.now().minusMonths(monthsAgo.toLong()).month
                transactions.filter {
                    it.createdAt.atZone(java.time.ZoneId.systemDefault()).month == targetMonth &&
                        it.status == MpesaStatus.COMPLETED
                }.sumOf { it.amount }
            }
        )
    }

    private fun getAccessToken(): String {
        val auth = Base64.getEncoder().encodeToString("$consumerKey:$consumerSecret".toByteArray())
        val headers = HttpHeaders().apply { set("Authorization", "Basic $auth") }

        @Suppress("UNCHECKED_CAST")
        val response = restTemplate.exchange(
            "$baseUrl/oauth/v1/generate?grant_type=client_credentials",
            HttpMethod.GET,
            HttpEntity<String>(headers),
            Map::class.java
        ) as ResponseEntity<Map<String, Any>>

        return (response.body?.get("access_token") as? String)
            ?: throw RuntimeException("Failed to get M-Pesa access token")
    }
}
