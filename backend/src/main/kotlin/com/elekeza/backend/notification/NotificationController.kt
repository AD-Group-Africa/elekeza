package com.elekeza.backend.notification

import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.*

@RestController
@RequestMapping("/api/notifications")
class NotificationController(
    private val notificationService: NotificationService
) {
    data class SmsRequest(val recipients: List<String>, val message: String)
    data class GuardianNotificationRequest(val phone: String, val childName: String, val event: String)

    @PostMapping("/sms")
    fun sendSms(@RequestBody req: SmsRequest): ResponseEntity<Map<String, Any>> {
        return ResponseEntity.ok(notificationService.sendSms(req.recipients, req.message))
    }

    @PostMapping("/guardian")
    fun sendGuardianNotification(@RequestBody req: GuardianNotificationRequest): ResponseEntity<Map<String, Any>> {
        return ResponseEntity.ok(notificationService.sendGuardianNotification(req.phone, req.childName, req.event))
    }
}
