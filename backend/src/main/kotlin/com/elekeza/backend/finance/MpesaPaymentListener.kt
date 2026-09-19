package com.elekeza.backend.finance

/**
 * Callback port implemented by the finance module and consumed by
 * [com.elekeza.backend.payments.MpesaService]. Kept as an interface so the
 * payments provider layer does not depend on the finance module directly
 * (dependency direction: payments → port, finance → implementation).
 */
interface MpesaPaymentListener {
    /**
     * Called once per confirmed M-Pesa success callback.
     * Returns the created finance Payment, or null when the callback was an
     * idempotent replay (already mapped).
     */
    fun onMpesaSuccess(checkoutRequestId: String, learnerId: Long, amount: Double, receiptNumber: String?): PaymentDto?
}

@org.springframework.stereotype.Component
class FinanceMpesaListener(private val financeService: FinanceService) : MpesaPaymentListener {
    override fun onMpesaSuccess(checkoutRequestId: String, learnerId: Long, amount: Double, receiptNumber: String?): PaymentDto? =
        financeService.onMpesaSuccess(checkoutRequestId, learnerId, amount, receiptNumber)
}
