package com.elekeza.backend.privacy

import com.elekeza.backend.analytics.EngagementEventRepository
import com.elekeza.backend.auth.PasswordResetTokenRepository
import com.elekeza.backend.auth.RefreshTokenRepository
import com.elekeza.backend.notification.NotificationRepository
import org.slf4j.LoggerFactory
import org.springframework.scheduling.annotation.Scheduled
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.Instant
import java.time.OffsetDateTime
import java.time.temporal.ChronoUnit

/**
 * Data retention.
 *
 * The policy is a set of explicit windows, not an implicit "we never delete
 * anything". Each window is chosen so the record stops being useful to the
 * school before it becomes a liability:
 *
 * | Data                     | Window                          | Why |
 * |--------------------------|---------------------------------|-----|
 * | Password reset tokens    | on expiry                       | Single-use; expired means unusable |
 * | Refresh tokens           | on expiry                       | Session artefact |
 * | Notifications            | 365 days                        | Operational messages, not records |
 * | Engagement events        | 365 days                        | Telemetry for pilot evidence only |
 * | Withdrawn consent rows   | 730 days after withdrawal       | Proof of consent, then no longer needed |
 * | Audit logs               | 90 days                         | Owned by AuditLogService (existing job) |
 *
 * Nothing here deletes a learner's academic record, a guardian link that is
 * still live, or anything else a school is accountable for. Automatic deletion
 * of school records is a policy decision for the school, not a side effect of
 * deploying code.
 *
 * Every sweep writes a `retention_runs` row — including dry runs — so the
 * policy can be evidenced rather than asserted. The scheduled sweep runs daily
 * at 03:30, after the existing audit purge at 02:00.
 */
@Service
class RetentionService(
    private val passwordResetTokenRepository: PasswordResetTokenRepository,
    private val refreshTokenRepository: RefreshTokenRepository,
    private val notificationRepository: NotificationRepository,
    private val engagementEventRepository: EngagementEventRepository,
    private val consentRepository: ConsentRepository,
    private val retentionRunRepository: RetentionRunRepository
) {
    private val logger = LoggerFactory.getLogger(RetentionService::class.java)

    companion object {
        const val NOTIFICATION_RETENTION_DAYS = 365L
        const val ENGAGEMENT_RETENTION_DAYS = 365L
        const val WITHDRAWN_CONSENT_RETENTION_DAYS = 730L

        val POLICY: List<Triple<String, String, String>> = listOf(
            Triple("password_reset_tokens", "deleted on expiry", "single-use credential"),
            Triple("refresh_tokens", "deleted on expiry", "session artefact"),
            Triple("notifications", "$NOTIFICATION_RETENTION_DAYS days", "operational message"),
            Triple("engagement_events", "$ENGAGEMENT_RETENTION_DAYS days", "pilot telemetry"),
            Triple("consent_records", "$WITHDRAWN_CONSENT_RETENTION_DAYS days after withdrawal", "proof of consent"),
            Triple("audit_logs", "90 days", "owned by AuditLogService.purgeOldAuditLogs")
        )

        private const val DRY_RUN_BATCH_CAP = 10_000
    }

    @Scheduled(cron = "0 30 3 * * *") // 03:30 daily, after the 02:00 audit purge
    @Transactional
    fun scheduledSweep() {
        val run = run(dryRun = false)
        logger.info("Retention sweep: deleted {} rows {}", run.totalDeleted, run.id)
    }

    /**
     * Execute (or simulate) one retention sweep.
     *
     * @param dryRun when true, counts what *would* be removed and writes a
     *               retention_runs row marked dry_run, changing no data.
     */
    @Transactional
    fun run(dryRun: Boolean): RetentionRun {
        val now = Instant.now()
        val nowOffset = OffsetDateTime.now()

        val resetTokens = if (dryRun) {
            passwordResetTokenRepository.countByExpiresAtBefore(nowOffset).toInt()
        } else {
            passwordResetTokenRepository.deleteByExpiresAtBefore(nowOffset)
        }

        val sessions = if (dryRun) {
            refreshTokenRepository.countByExpiresAtBefore(nowOffset).toInt()
        } else {
            refreshTokenRepository.deleteByExpiresAtBefore(nowOffset)
        }

        val notifCutoff = now.minus(NOTIFICATION_RETENTION_DAYS, ChronoUnit.DAYS)
        val notifications = if (dryRun) {
            notificationRepository.countByCreatedAtBefore(notifCutoff).toInt()
        } else {
            notificationRepository.deleteByCreatedAtBefore(notifCutoff)
        }

        val eventCutoff = now.minus(ENGAGEMENT_RETENTION_DAYS, ChronoUnit.DAYS)
        val events = if (dryRun) {
            engagementEventRepository.countByCreatedAtBefore(eventCutoff).toInt()
        } else {
            engagementEventRepository.deleteByCreatedAtBefore(eventCutoff)
        }

        val consentCutoff = now.minus(WITHDRAWN_CONSENT_RETENTION_DAYS, ChronoUnit.DAYS)
        val consents = if (dryRun) {
            consentRepository.countByWithdrawnAtIsNotNullAndWithdrawnAtBefore(consentCutoff).toInt()
        } else {
            consentRepository.deleteByWithdrawnAtBefore(consentCutoff)
        }

        val total = resetTokens + sessions + notifications + events + consents

        return retentionRunRepository.save(
            RetentionRun(
                startedAt = now,
                finishedAt = Instant.now(),
                dryRun = dryRun,
                passwordResetTokens = resetTokens,
                refreshTokens = sessions,
                notifications = notifications,
                engagementEvents = events,
                consentRecords = consents,
                totalDeleted = total
            )
        )
    }

    fun recentRuns(): List<RetentionRun> = retentionRunRepository.findTop20ByOrderByStartedAtDesc()
}
