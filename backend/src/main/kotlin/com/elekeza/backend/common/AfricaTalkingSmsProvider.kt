package com.elekeza.backend.common

import org.slf4j.LoggerFactory
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty
import org.springframework.beans.factory.annotation.Value
import org.springframework.boot.web.client.RestTemplateBuilder
import org.springframework.stereotype.Service
import org.springframework.web.client.RestTemplate

@Service
@ConditionalOnProperty(name = ["sms.provider"], havingValue = "africa_talking", matchIfMissing = false)
class AfricaTalkingSmsProvider(
    @Value("\${africa_talking.api_key:}") private val apiKey: String,
    @Value("\${africa_talking.sender_id:DefaultSender}") private val senderId: String,
    restTemplateBuilder: RestTemplateBuilder
) : SmsProvider {
    private val restTemplate: RestTemplate = restTemplateBuilder.build()

    private val log = LoggerFactory.getLogger(javaClass)
    private val baseUrl = "https://api.africastalking.com/version1/messaging"

    override fun send(recipient: String, message: String): String {
        if (apiKey.isBlank()) {
            log.warn("Africa's Talking API key not configured — returning mock message ID")
            return "mock-msg-${System.currentTimeMillis()}"
        }

        val headers = org.springframework.http.HttpHeaders().apply {
            set("Authorization", "Bearer $apiKey")
            set("Content-Type", "application/json")
        }

        val body = mapOf(
            "phoneNumber" to recipient,
            "message" to message,
            "sender" to senderId
        ).toString()

        val entity = org.springframework.http.HttpEntity(body, headers)

        try {
            val response = restTemplate.postForEntity(baseUrl, entity, String::class.java)
            log.info("Africa's Talking SMS sent to $recipient, response: ${response.body}")
            return response.body ?: "mock-msg-${System.currentTimeMillis()}"
        } catch (e: Exception) {
            log.error("Africa's Talking SMS failed to $recipient: ${e.message}")
            throw e
        }
    }

    override fun validateRecipient(recipient: String): String? {
        if (recipient.isBlank()) return "Recipient phone number is required"
        // Simple: must start with + and be 7-15 digits, or be 7-15 digits alone
        val trimmed = recipient.trim()
        if (trimmed.startsWith("+")) {
            val digitPart = trimmed.drop(1)
            if (digitPart.length >= 7 && digitPart.length <= 15 && digitPart.all { it.isDigit() }) return null
        } else if (trimmed.length >= 7 && trimmed.length <= 15 && trimmed.all { it.isDigit() }) return null
        return "Invalid phone number format. Use +254712345678 or 254712345678 format"
    }
}