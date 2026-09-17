package com.elekeza.backend.finance

import org.springframework.beans.factory.annotation.Value
import org.springframework.context.annotation.Lazy
import org.springframework.context.annotation.Primary
import org.springframework.http.HttpStatus
import org.springframework.stereotype.Component
import org.springframework.web.server.ResponseStatusException

/**
 * The fee-payment gateway used by the finance module. Sits above the existing
 * [com.elekeza.backend.payments.MpesaService] provider integration:
 *
 *  - MOCK mode (default): deterministic local STK flow — no network, no
 *    secrets. The callback endpoint accepts the same Daraja payload shape so
 *    the whole integration chain is testable end-to-end.
 *  - LIVE mode (`fees.mpesa-mode=live`): delegates to the real Daraja-backed
 *    MpesaService; no money is recorded until the provider callback confirms
 *    success.
 *
 * Mode selection is per-request so a misconfigured live environment (missing
 * credentials) degrades to the mock with an honest flag rather than faking
 * production money movement.
 */
interface MpesaGateway {
    val isMock: Boolean
    fun stkPush(phone: String, amount: Double, reference: String, description: String): Map<String, Any>
}

@Component
@Primary
class ConfigurableMpesaGateway(
    @Value("\${fees.mpesa-mode:mock}") private val mode: String,
    @Value("\${mpesa.consumer-key:}") private val consumerKey: String,
    @Value("\${mpesa.consumer-secret:}") private val consumerSecret: String,
    @Lazy private val mpesaService: com.elekeza.backend.payments.MpesaService,
    private val mockGateway: MockMpesaGateway
) : MpesaGateway {

    private val liveConfigured: Boolean
        get() = consumerKey.isNotBlank() && consumerSecret.isNotBlank()

    override val isMock: Boolean
        get() = !(mode == "live" && liveConfigured)

    override fun stkPush(phone: String, amount: Double, reference: String, description: String): Map<String, Any> {
        if (!isMock) {
            return mpesaService.stkPush(phone, amount, reference, description)
        }
        if (mode == "live") {
            // Asked for live but credentials are missing — say so honestly.
            throw ResponseStatusException(
                HttpStatus.SERVICE_UNAVAILABLE,
                "M-Pesa live mode requested but credentials are not configured."
            )
        }
        return mockGateway.push(phone, amount, reference)
    }
}

/** Deterministic mock STK flow — no network, no credentials, no secrets. */
@Component
class MockMpesaGateway {

    fun push(phone: String, amount: Double, reference: String): Map<String, Any> {
        val checkoutId = "ws_CO_MOCK_${System.currentTimeMillis()}_${(0..999).random()}"
        return mapOf(
            "checkoutRequestId" to checkoutId,
            "merchantRequestId" to "mr_MOCK_${System.currentTimeMillis()}",
            "mock" to true,
            "message" to "Mock STK push accepted — confirm via the callback endpoint"
        )
    }
}
