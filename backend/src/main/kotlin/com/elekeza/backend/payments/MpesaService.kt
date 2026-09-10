package com.elekeza.backend.payments

import com.fasterxml.jackson.databind.ObjectMapper
import org.slf4j.LoggerFactory
import org.springframework.beans.factory.annotation.Value
import org.springframework.http.*
import org.springframework.stereotype.Service
import org.springframework.web.client.RestTemplate
import org.springframework.web.server.ResponseStatusException
import java.time.Instant
import java.time.LocalDateTime
import java.time.format.DateTimeFormatter
import java.util.Base64

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
    private val objectMapper: ObjectMapper
) {
    private val log = LoggerFactory.getLogger(javaClass)
    private val baseUrl = if (environment == "production") "https://api.safaricom.co.ke" else "https://sandbox.safaricom.co.ke"

    fun stkPush(phoneNumber: String, amount: Double, reference: String, description: String): Map<String, Any> {
        if (consumerKey.isBlank() || consumerSecret.isBlank()) {
            throw ResponseStatusException(
                HttpStatus.SERVICE_UNAVAILABLE,
                "M-Pesa payments are not configured for this deployment."
            )
        }
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

        transactionRepo.save(MpesaTransaction(
            merchantRequestId = responseBody["MerchantRequestID"] as? String,
            checkoutRequestId = responseBody["CheckoutRequestID"] as? String,
            phoneNumber = phoneNumber,
            amount = amount,
            reference = reference,
            description = description,
            status = "INITIATED"
        ))

        return mapOf(
            "success" to (response.statusCode == HttpStatus.OK),
            "merchantRequestId" to (responseBody["MerchantRequestID"] ?: "") as Any,
            "checkoutRequestId" to (responseBody["CheckoutRequestID"] ?: "") as Any,
            "message" to (responseBody["ResponseDescription"] ?: "") as Any
        )
    }

    /**
     * Handles the Safaricom STK callback. The endpoint is intentionally
     * unauthenticated (the provider cannot hold a session), so this handler
     * must be defensive on its own:
     *
     *  - only transitions a transaction we initiated and that is still
     *    pending (state machine INITIATED/PENDING → COMPLETED | FAILED);
     *  - terminal transactions are never re-opened (duplicate callbacks from
     *    provider retries are ignored, and a FAILED result cannot be flipped
     *    to COMPLETED by replaying a forged success body);
     *  - the callback Amount must match the amount we initiated — a mismatch
     *    means tampering or a provider error, and is rejected without state
     *    change;
     *  - unknown checkout ids are rejected and logged.
     *
     * Deployments with real Daraja credentials MUST additionally enable
     * provider signature verification (Safaricom signs callbacks with their
     * public key) at the edge before this handler runs — see the audit doc.
     */
    fun processCallback(body: Map<String, Any>): Map<String, Any> {
        val stkCallback = (body["Body"] as? Map<*, *>)?.get("stkCallback") as? Map<String, Any>
        val checkoutRequestId = stkCallback?.get("CheckoutRequestID") as? String
        if (checkoutRequestId == null) {
            log.warn("M-Pesa callback without a CheckoutRequestID")
            return mapOf("ResultCode" to 1, "ResultDesc" to "Failed")
        }

        val transaction = transactionRepo.findByCheckoutRequestId(checkoutRequestId)
        if (transaction == null) {
            log.warn("M-Pesa callback for unknown CheckoutRequestID {}", checkoutRequestId)
            return mapOf("ResultCode" to 1, "ResultDesc" to "Failed")
        }

        // Idempotency: terminal transactions are final. This also blocks
        // replaying a forged success body after a FAILED result.
        if (transaction.status == "COMPLETED" || transaction.status == "FAILED") {
            log.info("Ignoring duplicate M-Pesa callback for terminal transaction {} ({})", checkoutRequestId, transaction.status)
            return mapOf("ResultCode" to 0, "ResultDesc" to "Success")
        }

        val resultCode = stkCallback["ResultCode"] as? Int ?: -1
        val resultDesc = stkCallback["ResultDesc"] as? String
        val metadata = (stkCallback["CallbackMetadata"] as? Map<*, *>)?.get("Item") as? List<Map<String, Any>>
        val callbackAmount = (metadata?.find { it["Name"] == "Amount" }?.get("Value") as? Number)?.toDouble()

        // The amount the provider reports must equal what we initiated.
        if (callbackAmount != null && Math.abs(callbackAmount - transaction.amount) > 0.001) {
            log.warn(
                "M-Pesa callback amount mismatch for {}: initiated KES {} but callback reports KES {}",
                checkoutRequestId, transaction.amount, callbackAmount
            )
            return mapOf("ResultCode" to 1, "ResultDesc" to "Amount mismatch")
        }

        val updated = transaction.copy(
            status = if (resultCode == 0) "COMPLETED" else "FAILED",
            resultCode = resultCode,
            resultDesc = resultDesc,
            mpesaReceiptNumber = metadata?.find { it["Name"] == "MpesaReceiptNumber" }?.get("Value") as? String,
            transactionDate = Instant.now(),
            updatedAt = Instant.now()
        )
        transactionRepo.save(updated)
        log.info("M-Pesa payment {}: {} - KES {}", updated.status, updated.mpesaReceiptNumber ?: checkoutRequestId, updated.amount)
        return mapOf("ResultCode" to 0, "ResultDesc" to "Success")
    }

    fun getTransactionStatus(checkoutRequestId: String): Map<String, Any> {
        val token = getAccessToken()
        val timestamp = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMddHHmmss"))
        val password = Base64.getEncoder().encodeToString("$shortcode$passkey$timestamp".toByteArray())

        val body = mapOf(
            "BusinessShortCode" to shortcode,
            "Password" to password,
            "Timestamp" to timestamp,
            "CheckoutRequestID" to checkoutRequestId
        )

        val headers = HttpHeaders().apply {
            contentType = MediaType.APPLICATION_JSON
            setBearerAuth(token)
        }

        @Suppress("UNCHECKED_CAST")
        val response = restTemplate.exchange(
            "$baseUrl/mpesa/stkpushquery/v1/query",
            HttpMethod.POST,
            HttpEntity(body, headers),
            Map::class.java
        ) as ResponseEntity<Map<String, Any>>

        return response.body ?: mapOf("error" to "Failed to query status")
    }

    fun getRevenue(): Map<String, Any> {
        val transactions = transactionRepo.findAll()
        val totalRevenue = transactions.filter { it.status == "COMPLETED" }.sumOf { it.amount }
        val thisMonth = transactions.filter {
            it.createdAt.atZone(java.time.ZoneId.systemDefault()).month == Instant.now().atZone(java.time.ZoneId.systemDefault()).month
        }

        return mapOf(
            "totalRevenue" to totalRevenue,
            "transactionCount" to transactions.size,
            "successfulTransactions" to transactions.count { it.status == "COMPLETED" },
            "failedTransactions" to transactions.count { it.status == "FAILED" },
            "revenueThisMonth" to thisMonth.filter { it.status == "COMPLETED" }.sumOf { it.amount },
            "monthlyRevenue" to (0..5).map { monthsAgo ->
                val targetMonth = LocalDateTime.now().minusMonths(monthsAgo.toLong()).month
                transactions.filter {
                    it.createdAt.atZone(java.time.ZoneId.systemDefault()).month == targetMonth &&
                    it.status == "COMPLETED"
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





