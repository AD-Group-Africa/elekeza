package com.elekeza.backend.payments

import org.slf4j.LoggerFactory
import org.springframework.beans.factory.annotation.Value
import org.springframework.context.annotation.Lazy
import org.springframework.http.HttpEntity
import org.springframework.http.HttpHeaders
import org.springframework.http.HttpMethod
import org.springframework.http.MediaType
import org.springframework.http.ResponseEntity
import org.springframework.stereotype.Component
import org.springframework.web.client.RestTemplate
import java.time.LocalDateTime
import java.time.format.DateTimeFormatter
import java.util.Base64

/**
 * Independent verification of an M-Pesa/STK transaction outcome.
 *
 * WHY THIS EXISTS (2026-10-16 payment-security sprint)
 * ----------------------------------------------------
 * Safaricom's Daraja STK callback is **unsigned**: the public callback contract
 * documents no HMAC, signature header or shared secret. A callback body alone is
 * therefore a *notification*, not proof of payment. The documented controls are
 * (a) allowlisting the published Daraja callback source IPs at the network edge
 * and (b) independently querying the transaction, i.e. `POST
 * /mpesa/stkpushquery/v1/query` (`ResultCode = 0` ⇒ success).
 *
 * This port is the seam for rule (b). `MpesaService.processCallback` finalises a
 * transaction only when [verify] returns [VerificationOutcome.Confirmed].
 */
sealed class VerificationOutcome {
    /** The provider independently confirms a successful transaction. */
    object Confirmed : VerificationOutcome()

    /** The provider states the transaction did not succeed (or was cancelled). */
    object NotSuccessful : VerificationOutcome()

    /**
     * The outcome could not be established (not configured, network failure,
     * provider in-progress/unknown shape). NEVER treat this as success.
     */
    data class Unavailable(val reason: String) : VerificationOutcome()
}

interface MpesaStatusVerifier {
    /**
     * True when this deployment can perform real provider verification.
     * The reconciliation job only acts when this is true, so a mock/dev
     * deployment can never fabricate a completed payment.
     */
    val isLive: Boolean

    fun verify(checkoutRequestId: String): VerificationOutcome
}

/**
 * Chooses the verification strategy from configuration, mirroring
 * [ConfigurableMpesaGateway]:
 *
 *  - mode != "live" (default `mock`) → the local mock flow: the callback IS the
 *    simulated provider signal, so it confirms. This is not a real payment
 *    environment and must never be used to move real money.
 *  - mode == "live" with credentials → real STK Push Query against Daraja.
 *  - mode == "live" without credentials → [VerificationOutcome.Unavailable] so
 *    financial finalisation FAILS CLOSED instead of trusting the callback.
 */
@Component
class ConfigurableMpesaStatusVerifier(
    @Value("\${fees.mpesa-mode:mock}") private val mode: String,
    @Lazy private val live: LiveMpesaStatusVerifier,
) : MpesaStatusVerifier {

    private val log = LoggerFactory.getLogger(javaClass)

    override val isLive: Boolean
        get() = mode == "live" && live.isConfigured

    override fun verify(checkoutRequestId: String): VerificationOutcome {
        if (mode != "live") return VerificationOutcome.Confirmed
        if (!live.isConfigured) {
            log.error(
                "M-Pesa live mode is active but provider credentials are missing; " +
                    "refusing to finalise payment for {} (fail closed)",
                checkoutRequestId
            )
            return VerificationOutcome.Unavailable("live mode without provider credentials")
        }
        return live.query(checkoutRequestId)
    }
}

/**
 * Real provider verification via Daraja STK Push Query. Read-only: it asks the
 * provider what happened and never moves money.
 */
@Component
class LiveMpesaStatusVerifier(
    @Value("\${mpesa.consumer-key:}") private val consumerKey: String,
    @Value("\${mpesa.consumer-secret:}") private val consumerSecret: String,
    @Value("\${mpesa.passkey:}") private val passkey: String,
    @Value("\${mpesa.shortcode:174379}") private val shortcode: String,
    @Value("\${mpesa.environment:sandbox}") private val environment: String,
    private val restTemplate: RestTemplate,
) {
    private val log = LoggerFactory.getLogger(javaClass)
    private val baseUrl =
        if (environment == "production") "https://api.safaricom.co.ke" else "https://sandbox.safaricom.co.ke"

    val isConfigured: Boolean
        get() = consumerKey.isNotBlank() && consumerSecret.isNotBlank()

    fun query(checkoutRequestId: String): VerificationOutcome {
        if (!isConfigured) {
            // Fail closed without touching the network.
            return VerificationOutcome.Unavailable("live provider credentials are not configured")
        }
        return try {
            val token = accessToken()
            val timestamp = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMddHHmmss"))
            val password = Base64.getEncoder()
                .encodeToString("$shortcode$passkey$timestamp".toByteArray())
            val body = mapOf(
                "BusinessShortCode" to shortcode,
                "Password" to password,
                "Timestamp" to timestamp,
                "CheckoutRequestID" to checkoutRequestId,
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
                Map::class.java,
            ) as ResponseEntity<Map<String, Any>>

            val responseBody = response.body ?: return VerificationOutcome.Unavailable("empty query response")
            // Daraja reports ResultCode both as a JSON number and as a string
            // (e.g. "0" or "1032"). Normalise both shapes; anything else is
            // NOT determinable and must never become a success.
            val resultCode = when (val raw = responseBody["ResultCode"]) {
                is Number -> raw.toInt()
                is String -> raw.trim().toIntOrNull()
                else -> null
            }
            when (resultCode) {
                0 -> VerificationOutcome.Confirmed
                null -> VerificationOutcome.Unavailable(
                    "query result not determinable: ${responseBody["errorCode"] ?: responseBody["ResultCode"]}"
                )
                else -> VerificationOutcome.NotSuccessful
            }
        } catch (e: Exception) {
            log.warn("M-Pesa status query failed for {}: {}", checkoutRequestId, e.message)
            VerificationOutcome.Unavailable("provider query failed: ${e.javaClass.simpleName}")
        }
    }

    private fun accessToken(): String {
        val auth = Base64.getEncoder().encodeToString("$consumerKey:$consumerSecret".toByteArray())
        val headers = HttpHeaders().apply { set("Authorization", "Basic $auth") }
        @Suppress("UNCHECKED_CAST")
        val response = restTemplate.exchange(
            "$baseUrl/oauth/v1/generate?grant_type=client_credentials",
            HttpMethod.GET,
            HttpEntity<String>(headers),
            Map::class.java,
        ) as ResponseEntity<Map<String, Any>>
        return (response.body?.get("access_token") as? String)
            ?: throw IllegalStateException("provider returned no access token")
    }
}
