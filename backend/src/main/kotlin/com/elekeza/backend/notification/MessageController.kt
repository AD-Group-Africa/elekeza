package com.elekeza.backend.notification

import com.elekeza.backend.auth.User
import com.elekeza.backend.auth.UserRepository
import com.elekeza.backend.auth.UserRole
import com.elekeza.backend.institution.GuardianLinkRepository
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.security.access.prepost.PreAuthorize
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.web.bind.annotation.*
import org.springframework.web.server.ResponseStatusException

/**
 * EL-NEW-02 Phase 1: two-way guardian↔teacher messaging.
 *
 * Defect being fixed: every message used to be saved with userId = sender.id,
 * so the recipient never received anything and no teacher-side read endpoint
 * existed. Notifications are now saved against the RECIPIENT with the sender
 * recorded in sender_id (V17), and both sides get read endpoints scoped to
 * human messages (senderId IS NOT NULL) so system notifications never leak
 * into the threads.
 *
 * Tenant isolation: a guardian may only message teachers at the institution
 * of their linked learner(s); a staff sender may only message users at their
 * own institution. Cross-tenant attempts return 403.
 */
/** Staff/broadcast send contract — kept: recipient is a CSV of user IDs. */
data class SendNotificationRequest(
    val recipient: String,
    val message: String,
    val type: String? = null
)

data class GuardianMessageRequest(
    val recipientUserId: Long,
    val message: String
)

data class TeacherDto(
    val id: Long,
    val name: String,
    val email: String
)

@RestController
@RequestMapping("/api")
class MessageController(
    private val notificationRepo: NotificationRepository,
    private val userRepo: UserRepository,
    private val guardianLinkRepo: GuardianLinkRepository
) {

    companion object {
        /** Human message types surfaced in guardian/teacher threads. */
        val MESSAGE_TYPES = listOf("GUARDIAN_MESSAGE", "MESSAGE")
    }

    // ── Guardian → Teacher ────────────────────────────────────────────────

    @PostMapping("/guardian/messages")
    @PreAuthorize("hasAnyRole('GUARDIAN', 'ADMIN')")
    fun guardianSendMessage(
        @AuthenticationPrincipal sender: User,
        @RequestBody req: GuardianMessageRequest
    ): ResponseEntity<Map<String, String>> {
        if (req.message.isBlank()) throw ResponseStatusException(HttpStatus.BAD_REQUEST, "Message must not be empty")
        val recipient = userRepo.findById(req.recipientUserId)
            .orElseThrow { ResponseStatusException(HttpStatus.NOT_FOUND, "Recipient not found") }
        if (recipient.role != UserRole.TEACHER) {
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, "Recipient is not a teacher")
        }
        val institutionId = guardianInstitutionId(sender)
            ?: throw ResponseStatusException(HttpStatus.BAD_REQUEST, "Guardian has no linked learner at an institution")
        if (recipient.institutionId != institutionId) {
            throw ResponseStatusException(HttpStatus.FORBIDDEN, "Teacher is not at the guardian's institution")
        }
        notificationRepo.save(
            Notification(
                userId = recipient.id,
                senderId = sender.id,
                type = "GUARDIAN_MESSAGE",
                title = "Guardian message",
                body = req.message
            )
        )
        return ResponseEntity.ok(mapOf("status" to "sent"))
    }

    /** Teachers the guardian can message: staff at their child's institution. */
    @GetMapping("/guardian/teachers")
    @PreAuthorize("hasAnyRole('GUARDIAN', 'ADMIN')")
    fun guardianGetTeachers(@AuthenticationPrincipal user: User): ResponseEntity<List<TeacherDto>> {
        val institutionId = guardianInstitutionId(user)
            ?: throw ResponseStatusException(HttpStatus.BAD_REQUEST, "Guardian has no linked learner at an institution")
        return ResponseEntity.ok(
            userRepo.findByInstitutionIdAndRole(institutionId, UserRole.TEACHER)
                .map { TeacherDto(id = it.id, name = it.name, email = it.email) }
        )
    }

    /** Received human messages for the guardian (messages sent TO them). */
    @GetMapping("/guardian/messages")
    @PreAuthorize("hasAnyRole('GUARDIAN', 'ADMIN')")
    fun guardianGetMessages(@AuthenticationPrincipal user: User): ResponseEntity<List<NotificationDto>> {
        return ResponseEntity.ok(receivedMessages(user.id))
    }

    // ── Teacher → Guardians (and staff broadcast) ─────────────────────────

    /**
     * Staff send: resolves the recipient CSV to user IDs, validates same-
     * institution tenancy for each, and saves one Notification per recipient
     * with the sender attributed.
     */
    @PostMapping("/notifications/send")
    @PreAuthorize("hasAnyRole('TEACHER', 'SCHOOL_ADMIN', 'ADMIN')")
    fun sendNotification(
        @AuthenticationPrincipal sender: User,
        @RequestBody req: SendNotificationRequest
    ): ResponseEntity<Map<String, String>> {
        if (req.message.isBlank()) throw ResponseStatusException(HttpStatus.BAD_REQUEST, "Message must not be empty")
        val recipientIds = req.recipient.split(',')
            .map { it.trim() }
            .filter { it.isNotEmpty() }
            .mapNotNull { it.toLongOrNull() }
            .toSet()
        if (recipientIds.isEmpty()) {
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, "No valid recipient user IDs")
        }
        val recipients = userRepo.findAllById(recipientIds)
        if (recipients.size != recipientIds.size) {
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, "One or more recipients not found")
        }
        recipients.forEach { recipient ->
            if (!sameInstitution(sender, recipient)) {
                throw ResponseStatusException(HttpStatus.FORBIDDEN, "Recipient is not at your institution")
            }
            notificationRepo.save(
                Notification(
                    userId = recipient.id,
                    senderId = sender.id,
                    type = req.type ?: "MESSAGE",
                    title = "Message from ${sender.name}",
                    body = req.message
                )
            )
        }
        return ResponseEntity.ok(mapOf("status" to "sent", "count" to recipientIds.size.toString()))
    }

    /** Received human messages for the teacher/staff sender (their inbox). */
    @GetMapping("/teacher/messages")
    @PreAuthorize("hasAnyRole('TEACHER', 'SCHOOL_ADMIN', 'ADMIN')")
    fun teacherGetMessages(@AuthenticationPrincipal user: User): ResponseEntity<List<NotificationDto>> {
        return ResponseEntity.ok(receivedMessages(user.id))
    }

    // ── Helpers ───────────────────────────────────────────────────────────

    /** Human messages addressed to this user; system notifications excluded. */
    private fun receivedMessages(userId: Long): List<NotificationDto> =
        notificationRepo.findByUserIdAndTypeInOrderByCreatedAtDesc(userId, MESSAGE_TYPES)
            .filter { it.senderId != null }
            .take(50)
            .toDtosWithSenderNames(userRepo)

    /**
     * The institution a guardian acts within, derived from active guardian
     * links → learners. Uses [com.elekeza.backend.institution.GuardianLink.currentlyActive]
     * so revoked/expired grants cannot be used for messaging. Guardians are
     * bound to one institution; anything else is unusable for addressing.
     */
    private fun guardianInstitutionId(guardian: User): Long? {
        val learnerIds = guardianLinkRepo.findByGuardianId(guardian.id)
            .filter { it.currentlyActive() }
            .map { it.learnerId }
        if (learnerIds.isEmpty()) return null
        val institutions = userRepo.findAllById(learnerIds).mapNotNull { it.institutionId }.toSet()
        return institutions.singleOrNull()
    }

    /**
     * Tenancy check for staff sends. Most users carry institutionId directly;
     * some guardians only link to their learner, so fall back to the learner's
     * institution via guardian_links. Platform ADMIN (no institution) may
     * message any institution, matching the existing role matrix.
     */
    private fun sameInstitution(sender: User, recipient: User): Boolean {
        if (sender.role == UserRole.ADMIN) return true
        val senderInstitution = sender.institutionId ?: return false
        if (recipient.institutionId != null) return recipient.institutionId == senderInstitution
        if (recipient.role == UserRole.GUARDIAN) {
            val learnerIds = guardianLinkRepo.findByGuardianId(recipient.id)
                .filter { it.currentlyActive() }
                .map { it.learnerId }
            if (learnerIds.isEmpty()) return false
            return userRepo.findAllById(learnerIds).any { it.institutionId == senderInstitution }
        }
        return false
    }
}
