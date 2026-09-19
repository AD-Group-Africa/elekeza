package com.elekeza.backend.common

import jakarta.persistence.*
import org.slf4j.LoggerFactory
import org.springframework.data.domain.PageRequest
import org.springframework.data.domain.Sort
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Modifying
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param
import org.springframework.scheduling.annotation.Async
import org.springframework.scheduling.annotation.Scheduled
import org.springframework.security.access.prepost.PreAuthorize
import org.springframework.stereotype.Repository
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.bind.annotation.*
import org.springframework.http.ResponseEntity
import java.time.LocalDateTime

// ── Entity ────────────────────────────────────────────────────────────────────

@Entity
@Table(name = "audit_logs")
data class AuditLog(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,

    @Column(name = "user_id")
    val userId: Long? = null,           // null for unauthenticated events

    @Column(nullable = false, length = 50)
    val action: String,                  // USER_LOGIN, CONTENT_UPLOAD, PAYMENT_INIT etc.

    @Column(nullable = false, length = 50)
    val category: String,                // AUTH | CONTENT | PAYMENT | ADMIN | QUIZ | LEARNER

    @Column(columnDefinition = "TEXT")
    val detail: String? = null,          // JSON-serialisable context — NO secrets, NO PII beyond userId

    @Column(name = "ip_address", length = 45)
    val ipAddress: String? = null,

    @Column(name = "request_id", length = 36)
    val requestId: String? = null,       // ties DB row to SLF4J log line via MDC

    val success: Boolean = true,

    @Column(name = "created_at")
    val createdAt: LocalDateTime = LocalDateTime.now()
)

// ── Repository ────────────────────────────────────────────────────────────────

@Repository
interface AuditLogRepository : JpaRepository<AuditLog, Long> {

    fun findByUserIdOrderByCreatedAtDesc(userId: Long, pageable: PageRequest): List<AuditLog>

    fun findByCategoryOrderByCreatedAtDesc(category: String, pageable: PageRequest): List<AuditLog>

    @Query("""
        SELECT a FROM AuditLog a
        WHERE a.action = :action AND a.success = false
          AND a.createdAt >= :since
        ORDER BY a.createdAt DESC
    """)
    fun findRecentFailures(
        @Param("action") action: String,
        @Param("since")  since: LocalDateTime
    ): List<AuditLog>

    @Query("SELECT COUNT(a) FROM AuditLog a WHERE a.userId = :userId AND a.action = :action AND a.createdAt >= :since")
    fun countRecentActions(
        @Param("userId") userId: Long,
        @Param("action") action: String,
        @Param("since")  since: LocalDateTime
    ): Long

    // Used by the purge job — bulk delete, no entity loading
    @Modifying
    @Query("DELETE FROM AuditLog a WHERE a.createdAt < :cutoff")
    fun deleteByCreatedAtBefore(@Param("cutoff") cutoff: LocalDateTime): Int
}

// ── Service ───────────────────────────────────────────────────────────────────

@Service
class AuditLogService(private val auditLogRepository: AuditLogRepository) {

    private val log = LoggerFactory.getLogger(AuditLogService::class.java)

    // @Async → audit write NEVER slows down the main request path.
    // If the audit write fails, the main request is unaffected — log the failure and move on.
    @Async
    fun log(
        action:    String,
        category:  String,
        userId:    Long?   = null,
        detail:    String? = null,
        ipAddress: String? = null,
        requestId: String? = null,
        success:   Boolean = true
    ) {
        try {
            if (success) {
                log.info("AUDIT action={} category={} userId={} requestId={}", action, category, userId, requestId)
            } else {
                log.warn("AUDIT FAILURE action={} category={} userId={} detail={}", action, category, userId, detail)
            }

            auditLogRepository.save(AuditLog(
                userId    = userId,
                action    = action,
                category  = category,
                detail    = detail,
                ipAddress = ipAddress,
                requestId = requestId,
                success   = success
            ))
        } catch (e: Exception) {
            // Audit failure must NEVER bubble up — log it and continue
            log.error("Audit log write failed (non-critical): {}", e.message)
        }
    }

    fun countRecentFailedLogins(userId: Long): Long =
        auditLogRepository.countRecentActions(
            userId, "USER_LOGIN_FAILED", LocalDateTime.now().minusMinutes(15)
        )

    // ── Retention policy ─────────────────────────────────────────────────────
    // Runs at 2am every day. Deletes audit records older than 90 days.
    // Storage optimistic: keeps the table bounded before it grows to millions of rows.
    // Add this BEFORE you have data, not after.
    //
    // To change retention: modify the minusDays(90) value.
    // To archive instead of delete: swap the DELETE for an INSERT INTO audit_logs_archive + DELETE.
    @Scheduled(cron = "0 0 2 * * *")  // 2:00 AM daily
    @Transactional
    fun purgeOldAuditLogs() {
        val cutoff  = LocalDateTime.now().minusDays(90)
        val deleted = auditLogRepository.deleteByCreatedAtBefore(cutoff)
        if (deleted > 0) {
            log.info("Audit log purge: deleted {} records older than {}", deleted, cutoff.toLocalDate())
        }
    }
}

// ── Admin controller ─────────────────────────────────────────────────────────

@RestController
@RequestMapping("/api/admin/audit")
class AuditLogController(private val auditLogRepository: AuditLogRepository) {

    @GetMapping
    @PreAuthorize("hasRole('ADMIN')")
    fun list(
        @RequestParam(required = false) userId:   Long?,
        @RequestParam(required = false) category: String?,
        @RequestParam(defaultValue = "0")  page: Int,
        @RequestParam(defaultValue = "50") size: Int
    ): ResponseEntity<*> {
        val pageable = PageRequest.of(page, size.coerceAtMost(100), Sort.by("createdAt").descending())
        val results  = when {
            userId   != null -> auditLogRepository.findByUserIdOrderByCreatedAtDesc(userId, pageable)
            category != null -> auditLogRepository.findByCategoryOrderByCreatedAtDesc(category, pageable)
            else             -> auditLogRepository.findAll(pageable).content
        }
        return ResponseEntity.ok(results)
    }
}
