package com.elekeza.backend.notification

import org.slf4j.LoggerFactory
import org.springframework.beans.factory.annotation.Value
import org.springframework.http.*
import org.springframework.stereotype.Service
import org.springframework.web.client.RestTemplate

@Service
class NotificationService(
    @Value("\${africastalking.api-key:}") private val apiKey: String,
    @Value("\${africastalking.username:}") private val username: String,
    @Value("\${africastalking.sender-id:Elekeza}") private val senderId: String,
    private val restTemplate: RestTemplate
) {
    private val log = LoggerFactory.getLogger(javaClass)
    private val baseUrl = "https://api.africastalking.com/version1/messaging"

    fun sendSms(recipients: List<String>, message: String): Map<String, Any> {
        if (apiKey.isBlank()) {
            log.warn("Africa's Talking not configured. Skipping SMS.")
            return mapOf("status" to "skipped", "reason" to "API key not configured")
        }
        val headers = HttpHeaders().apply {
            contentType = MediaType.APPLICATION_FORM_URLENCODED
            set("apiKey", apiKey)
            set("Accept", "application/json")
        }
        val body = mapOf(
            "username" to username,
            "to" to recipients.joinToString(","),
            "message" to message,
            "from" to senderId
        ).map { "${it.key}=${it.value}" }.joinToString("&")
        try {
            @Suppress("UNCHECKED_CAST")
            val response = restTemplate.exchange(baseUrl, HttpMethod.POST, HttpEntity(body, headers), Map::class.java) as ResponseEntity<Map<String, Any>>
            log.info("SMS sent to ${recipients.size} recipient(s)")
            return response.body ?: mapOf("status" to "sent")
        } catch (e: Exception) {
            log.error("Failed to send SMS: ${e.message}")
            return mapOf("status" to "failed", "error" to e.message.toString())
        }
    }

    fun sendGuardianNotification(guardianPhone: String, childName: String, event: String): Map<String, Any> {
        val message = when (event) {
            "lesson_completed" -> "Hello! $childName has just completed a lesson on Elekeza."
            "quiz_scored" -> "Good news! $childName scored well on a quiz."
            "assignment_due" -> "Reminder: $childName has a pending assignment."
            else -> "Update about $childName: $event."
        }
        return sendSms(listOf(guardianPhone), message)
    }
}
