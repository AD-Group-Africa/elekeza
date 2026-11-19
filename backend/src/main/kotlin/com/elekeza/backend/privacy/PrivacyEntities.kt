package com.elekeza.backend.privacy

import jakarta.persistence.*
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Modifying
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param
import java.time.Instant

/**
 * The consents Elekeza can record. Adding a value is a product decision: each
 * one needs wording a guardian actually reads, and a policy version.
 */
enum class ConsentType {
    /** The guardian agreed to Elekeza processing their own account data. */
    GUARDIAN_DATA_PROCESSING,

    /** The guardian agreed to Elekeza processing this learner's data. */
    LEARNER_DATA_PROCESSING,

    /** The guardian agreed to be contacted about school activity. */
    GUARDIAN_COMMUNICATIONS;

    companion object {
        fun parse(raw: String?): ConsentType =
            entries.firstOrNull { it.name.equals(raw?.trim(), ignoreCase = true) }
                ?: throw IllegalArgumentException(
                    "Unknown consent type '$raw'. Valid values: ${entries.joinToString(", ")}"
                )
    }
}

/**
 * Append-only consent history. Withdrawal sets [withdrawnAt]; a withdrawn row
 * is never deleted on withdrawal, because the school may need to prove what a
 * guardian agreed to and when.
 *
 * [subjectUserId] distinguishes "for myself" (null) from "for this learner".
 */
@Entity
@Table(name = "consent_records")
data class ConsentRecord(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,

    @Column(name = "user_id", nullable = false)
    val userId: Long,

    @Enumerated(EnumType.STRING)
    @Column(name = "consent_type", nullable = false, length = 40)
    val consentType: ConsentType,

    @Column(name = "subject_user_id")
    val subjectUserId: Long? = null,

    @Column(name = "institution_id")
    val institutionId: Long? = null,

    @Column(name = "policy_version", nullable = false, length = 20)
    val policyVersion: String,

    @Column(nullable = false)
    val granted: Boolean = true,

    @Column(name = "granted_at", nullable = false)
    val grantedAt: Instant = Instant.now(),

    @Column(name = "withdrawn_at")
    var withdrawnAt: Instant? = null,

    @Column(nullable = false, length = 40)
    val source: String = "API",

    val note: String? = null
)

/** Evidence that an erasure ran. Identifiers and counts only — never PII. */
@Entity
@Table(name = "data_erasure_log")
data class ErasureLog(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,

    @Column(name = "user_id", nullable = false)
    val userId: Long,

    @Column(name = "actor_id")
    val actorId: Long? = null,

    @Column(nullable = false, length = 255)
    val reason: String,

    @Column(name = "requested_at", nullable = false)
    val requestedAt: Instant = Instant.now(),

    @Column(name = "completed_at")
    val completedAt: Instant? = null,

    @Column(name = "links_revoked", nullable = false)
    val linksRevoked: Int = 0,

    @Column(name = "consents_withdrawn", nullable = false)
    val consentsWithdrawn: Int = 0,

    @Column(name = "already_erased", nullable = false)
    val alreadyErased: Boolean = false
)

/** One row per retention sweep, so the policy can be evidenced. */
@Entity
@Table(name = "retention_runs")
data class RetentionRun(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,

    @Column(name = "started_at", nullable = false)
    val startedAt: Instant = Instant.now(),

    @Column(name = "finished_at")
    val finishedAt: Instant? = null,

    @Column(name = "dry_run", nullable = false)
    val dryRun: Boolean = true,

    @Column(name = "password_reset_tokens", nullable = false)
    val passwordResetTokens: Int = 0,

    @Column(name = "refresh_tokens", nullable = false)
    val refreshTokens: Int = 0,

    @Column(nullable = false)
    val notifications: Int = 0,

    @Column(name = "engagement_events", nullable = false)
    val engagementEvents: Int = 0,

    @Column(name = "consent_records", nullable = false)
    val consentRecords: Int = 0,

    @Column(name = "total_deleted", nullable = false)
    val totalDeleted: Int = 0
)

// ── Repositories ─────────────────────────────────────────────────────────────

interface ConsentRepository : JpaRepository<ConsentRecord, Long> {
    fun findByUserIdOrderByGrantedAtDesc(userId: Long): List<ConsentRecord>
    fun findByUserIdAndConsentTypeAndWithdrawnAtIsNull(userId: Long, consentType: ConsentType): List<ConsentRecord>

    @Modifying
    @Query("UPDATE ConsentRecord c SET c.withdrawnAt = :at WHERE c.userId = :userId AND c.withdrawnAt IS NULL")
    fun withdrawAllFor(@Param("userId") userId: Long, @Param("at") at: Instant): Int

    @Modifying
    @Query("DELETE FROM ConsentRecord c WHERE c.withdrawnAt IS NOT NULL AND c.withdrawnAt < :cutoff")
    fun deleteByWithdrawnAtBefore(@Param("cutoff") cutoff: Instant): Int

    fun countByWithdrawnAtIsNotNullAndWithdrawnAtBefore(cutoff: Instant): Long
}

interface ErasureLogRepository : JpaRepository<ErasureLog, Long> {
    fun findByUserIdOrderByRequestedAtDesc(userId: Long): List<ErasureLog>
}

interface RetentionRunRepository : JpaRepository<RetentionRun, Long> {
    fun findTop20ByOrderByStartedAtDesc(): List<RetentionRun>
}
