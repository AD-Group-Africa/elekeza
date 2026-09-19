package com.elekeza.backend.common

import org.slf4j.LoggerFactory
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty
import org.springframework.stereotype.Service

@Service
@ConditionalOnProperty(name = ["sms.provider"], havingValue = "mock", matchIfMissing = false)
class MockSmsProvider : SmsProvider {

    private val log = LoggerFactory.getLogger(javaClass)
    private val sentMessages = mutableListOf<MockSmsRecord>()

    data class MockSmsRecord(
        val recipient: String,
        val message: String,
        val messageId: String,
        val sentAt: Long = System.currentTimeMillis()
    )

    override fun send(recipient: String, message: String): String {
        val messageId = "mock-msg-${System.currentTimeMillis()}-${recipient.hashCode()}"
        sentMessages.add(MockSmsRecord(recipient = recipient, message = message, messageId = messageId))
        log.info("MOCK: SMS sent to $recipient — messageId=$messageId")
        return messageId
    }

    override fun validateRecipient(recipient: String): String? {
        if (recipient.isBlank()) return "Recipient is required"
        if (!recipient.startsWith("+") && !recipient.matches(Regex("^[0-9]{7,15}$"))) {
            return "Invalid phone number format"
        }
        return null
    }

    /** Returns the list of sent messages for test verification. */
    fun getSentMessages(): List<MockSmsRecord> = sentMessages
}