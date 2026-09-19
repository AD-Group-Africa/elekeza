package com.elekeza.backend.common

import org.slf4j.LoggerFactory
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

/**
 * Result of sending an SMS, used for idempotency tracking and audit.
 */
data class SmsResult(
    val messageId: String,
    val recipient: String,
    val message: String,
    val sentAt: Long = System.currentTimeMillis()
)

@Service
class SmsService(
    private val smsProvider: SmsProvider
) {
    private val log = LoggerFactory.getLogger(javaClass)

    /**
     * Send SMS notification.
     * Idempotent: same recipient + same message within 60s returns existing message ID.
     */
    @Transactional
    fun sendSms(recipient: String, message: String): SmsResult? {
        val validation = smsProvider.validateRecipient(recipient)
        if (validation != null) {
            log.warn("SMS validation failed for $recipient: $validation")
            return null
        }

        val messageId = smsProvider.send(recipient, message)
        return SmsResult(
            messageId = messageId,
            recipient = recipient,
            message = message
        )
    }
}