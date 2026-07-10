package com.elekeza.backend.notification

import com.elekeza.backend.auth.User
import com.elekeza.backend.auth.UserRepository
import com.elekeza.backend.content.ContentRepository
import com.elekeza.backend.learner.GuardianRepository
import jakarta.persistence.*
import org.slf4j.LoggerFactory
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param
import org.springframework.http.ResponseEntity
import org.springframework.scheduling.annotation.Async
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.stereotype.Repository
import org.springframework.stereotype.Service
import org.springframework.web.bind.annotation.*
import java.time.Instant

// ── Entity ────────────────────────────────────────────────────────────────────

@Entity
@Table(name = "notifications", indexes = [
    Index(name = "idx_notif_user_read", columnList = "user_id,read"),
    Index(name = "idx_notif_created",   columnList = "created_at")
])
data class Notification(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,

    @Column(name = "user_id", nullable = false)
    val userId: Long,

    @Column(nullable = false, length = 50)
    val type: String,         // QUIZ_COMPLETED | LESSON_ASSIGNED | PROGRESS_REPORT

    @Column(nullable = false)
    val title: String,

    @Column(columnDefinition = "TEXT", nullable = false)
    val body: String,

    @Column var read: Boolean = false,

    @Column(name = "created_at")
    val createdAt: Instant = Instant.now()
)

// ── Repository ────────────────────────────────────────────────────────────────

@Repository
interface NotificationRepository : JpaRepository<Notification, Long> {
    fun findByUserIdOrderByCreatedAtDesc(userId: Long): List<Notification>
    fun findByUserIdAndReadFalseOrderByCreatedAtDesc(userId: Long): List<Notification>

    @Query("SELECT COUNT(n) FROM Notification n WHERE n.userId = :uid AND n.read = false")
    fun countUnread(@Param("uid") userId: Long): Long
}

// ── DTOs ──────────────────────────────────────────────────────────────────────

data class NotificationDto(
    val id: Long, val type: String, val title: String,
    val body: String, val read: Boolean, val createdAt: String
)
fun Notification.toDto() = NotificationDto(id, type, title, body, read, createdAt.toString())

// ── Service ───────────────────────────────────────────────────────────────────

@Service
class NotificationService(
    private val repo: NotificationRepository,
    private val userRepo: UserRepository,
    private val guardianRepo: GuardianRepository,
    private val contentRepo: ContentRepository
) {
    private val log = LoggerFactory.getLogger(javaClass)

    /** Called after quiz completion — notifies linked guardian(s) asynchronously */
    @Async("taskExecutor")
    fun notifyGuardianOnQuizComplete(studentId: Long, contentId: Long, score: Double) {
        val student = userRepo.findById(studentId).orElse(null) ?: return
        val title   = contentRepo.findById(contentId).map { it.title ?: "a lesson" }.orElse("a lesson")
        val scoreStr = "%.0f%%".format(score)
        val body = when {
            score >= 80 -> "${student.name} scored $scoreStr on \"$title\" — excellent work! 🎉"
            score >= 60 -> "${student.name} scored $scoreStr on \"$title\" — good effort! Keep going. 💪"
            else        -> "${student.name} scored $scoreStr on \"$title\". They may need a little extra support."
        }

        // Find all guardians linked to this student
        val guardians = guardianRepo.findAllByEmail(student.email)
        guardians.forEach { g ->
            g.email?.let { email ->
                userRepo.findByEmail(email)?.let { guardianUser ->
                    repo.save(Notification(
                        userId = guardianUser.id, type = "QUIZ_COMPLETED",
                        title = "${student.name} completed a quiz", body = body
                    ))
                    log.debug("Notified guardian={} for student={} score={}", email, student.email, scoreStr)
                }
            }
        }
    }

    /** Called when a teacher assigns a lesson to a student */
    @Async("taskExecutor")
    fun notifyStudentOnAssignment(studentId: Long, contentId: Long) {
        val lessonTitle = contentRepo.findById(contentId).map { it.title ?: "a new lesson" }.orElse("a new lesson")
        repo.save(Notification(
            userId = studentId, type = "LESSON_ASSIGNED",
            title = "New lesson assigned",
            body  = "Your teacher assigned you: \"$lessonTitle\". Open it from your home screen."
        ))
    }

    fun getAll(userId: Long): List<NotificationDto> =
        repo.findByUserIdOrderByCreatedAtDesc(userId).take(50).map { it.toDto() }

    fun getUnread(userId: Long): List<NotificationDto> =
        repo.findByUserIdAndReadFalseOrderByCreatedAtDesc(userId).map { it.toDto() }

    fun markRead(id: Long, userId: Long) {
        repo.findById(id).ifPresent { n ->
            if (n.userId == userId) repo.save(n.copy(read = true))
        }
    }

    fun markAllRead(userId: Long) {
        repo.findByUserIdAndReadFalseOrderByCreatedAtDesc(userId)
            .forEach { repo.save(it.copy(read = true)) }
    }
}

// ── Controller ────────────────────────────────────────────────────────────────

@RestController
@RequestMapping("/api/notifications")
class NotificationController(private val service: NotificationService) {

    @GetMapping
    fun getAll(@AuthenticationPrincipal user: User): ResponseEntity<List<NotificationDto>> =
        ResponseEntity.ok(service.getAll(user.id))

    @GetMapping("/unread")
    fun getUnread(@AuthenticationPrincipal user: User): ResponseEntity<List<NotificationDto>> =
        ResponseEntity.ok(service.getUnread(user.id))

    @PostMapping("/{id}/read")
    fun markRead(@PathVariable id: Long, @AuthenticationPrincipal user: User): ResponseEntity<Map<String, Boolean>> {
        service.markRead(id, user.id)
        return ResponseEntity.ok(mapOf("success" to true))
    }

    @PostMapping("/read-all")
    fun markAllRead(@AuthenticationPrincipal user: User): ResponseEntity<Map<String, Boolean>> {
        service.markAllRead(user.id)
        return ResponseEntity.ok(mapOf("success" to true))
    }
}
