package com.elekeza.backend.notification

import com.elekeza.backend.auth.User
import com.elekeza.backend.auth.UserRepository
import org.springframework.http.ResponseEntity
import org.springframework.security.access.prepost.PreAuthorize
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.web.bind.annotation.*

data class SendNotificationRequest(
    val recipient: String,
    val message: String,
    val type: String? = null
)

@RestController
@RequestMapping("/api")
class MessageController(
    private val notificationRepo: NotificationRepository,
    private val userRepo: UserRepository
) {

    @PostMapping("/notifications/send")
    fun sendNotification(
        @AuthenticationPrincipal sender: User,
        @RequestBody req: SendNotificationRequest
    ): ResponseEntity<Map<String, String>> {
        notificationRepo.save(
            Notification(
                userId = sender.id,
                type = req.type ?: "MESSAGE",
                title = "Message sent",
                body = req.message
            )
        )
        return ResponseEntity.ok(mapOf("status" to "sent"))
    }

    @PostMapping("/guardian/messages")
    @PreAuthorize("hasAnyRole('GUARDIAN', 'ADMIN')")
    fun guardianSendMessage(
        @AuthenticationPrincipal sender: User,
        @RequestBody req: SendNotificationRequest
    ): ResponseEntity<Map<String, String>> {
        notificationRepo.save(
            Notification(
                userId = sender.id,
                type = "GUARDIAN_MESSAGE",
                title = "Guardian message",
                body = req.message
            )
        )
        return ResponseEntity.ok(mapOf("status" to "sent"))
    }

    @GetMapping("/guardian/messages")
    @PreAuthorize("hasAnyRole('GUARDIAN', 'ADMIN')")
    fun guardianGetMessages(@AuthenticationPrincipal user: User): ResponseEntity<List<NotificationDto>> {
        return ResponseEntity.ok(
            notificationRepo.findByUserIdOrderByCreatedAtDesc(user.id)
                .filter { it.type == "GUARDIAN_MESSAGE" || it.type == "MESSAGE" }
                .take(50)
                .map { it.toDto() }
        )
    }
}
