package com.elekeza.backend.privacy

import com.elekeza.backend.auth.User
import com.elekeza.backend.common.AuditLogService
import com.elekeza.backend.institution.GuardianLinkRepository
import org.springframework.http.HttpStatus
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.server.ResponseStatusException
import java.time.Instant

/**
 * Consent capture for guardians (and anyone consenting about their own data).
 *
 * Rules this service enforces:
 *  * A consent for a learner requires a **currently active** guardian link to
 *    that learner — `currentlyActive()` (not the bare `isActive` flag), so
 *    revoked and expired links cannot be used to consent on a child's behalf.
 *  * Granting the same consent twice is idempotent and returns the existing
 *    record instead of creating a duplicate history row.
 *  * Withdrawal never deletes history; it stamps `withdrawn_at`.
 *  * Only the owner of a consent record may withdraw it.
 */
@Service
class ConsentService(
    private val consentRepository: ConsentRepository,
    private val guardianLinkRepository: GuardianLinkRepository,
    private val auditLogService: AuditLogService
) {
    companion object {
        /**
         * Bump when the consent wording changes. Every record keeps the version
         * that was actually presented, so a later policy cannot be retro-fitted
         * to an older agreement.
         */
        const val POLICY_VERSION = "2026-11-15"

        val POLICY_TEXT = mapOf(
            ConsentType.GUARDIAN_DATA_PROCESSING to
                "Elekeza may process my account details (name, email, phone) to operate the service.",
            ConsentType.LEARNER_DATA_PROCESSING to
                "Elekeza may process my child's school information (attendance, assignments, progress, school dates) for the purpose of supporting their learning.",
            ConsentType.GUARDIAN_COMMUNICATIONS to
                "Elekeza may contact me about my child's school activity. This can be withdrawn at any time."
        )
    }

    @Transactional
    fun grant(
        actor: User,
        type: ConsentType,
        subjectUserId: Long?,
        note: String? = null,
        source: String = "API"
    ): ConsentRecord {
        if (subjectUserId != null) {
            val link = guardianLinkRepository
                .findByGuardianIdAndLearnerIdAndIsActiveTrue(actor.id, subjectUserId)
            if (link == null || !link.currentlyActive()) {
                throw ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "No active guardian link to learner $subjectUserId"
                )
            }
        }

        // Idempotent: an identical active consent is returned, not duplicated.
        consentRepository
            .findByUserIdAndConsentTypeAndWithdrawnAtIsNull(actor.id, type)
            .firstOrNull { it.subjectUserId == subjectUserId }
            ?.let { return it }

        val record = consentRepository.save(
            ConsentRecord(
                userId = actor.id,
                consentType = type,
                subjectUserId = subjectUserId,
                institutionId = actor.institutionId,
                policyVersion = POLICY_VERSION,
                note = note?.trim()?.take(255)?.ifEmpty { null },
                source = source
            )
        )

        auditLogService.log(
            action = "CONSENT_GRANTED",
            category = "PRIVACY",
            userId = actor.id,
            detail = "type=${type.name} subject=${subjectUserId ?: "self"} policy=$POLICY_VERSION"
        )
        return record
    }

    @Transactional
    fun withdraw(actor: User, consentId: Long): ConsentRecord {
        val record = consentRepository.findById(consentId).orElseThrow {
            ResponseStatusException(HttpStatus.NOT_FOUND, "Consent record not found")
        }
        if (record.userId != actor.id) {
            // Deliberately 404-shaped: do not confirm the existence of another
            // person's consent record.
            throw ResponseStatusException(HttpStatus.FORBIDDEN, "This consent record is not yours")
        }
        if (record.withdrawnAt == null) {
            record.withdrawnAt = Instant.now()
            consentRepository.save(record)
            auditLogService.log(
                action = "CONSENT_WITHDRAWN",
                category = "PRIVACY",
                userId = actor.id,
                detail = "type=${record.consentType.name} subject=${record.subjectUserId ?: "self"}"
            )
        }
        return record
    }

    fun listMine(userId: Long): List<ConsentRecord> =
        consentRepository.findByUserIdOrderByGrantedAtDesc(userId)

    /** Active consents, optionally narrowed to one learner. */
    fun activeConsents(userId: Long, subjectUserId: Long? = null): List<ConsentRecord> =
        consentRepository.findByUserIdAndConsentTypeAndWithdrawnAtIsNull(userId, ConsentType.LEARNER_DATA_PROCESSING)
            .filter { subjectUserId == null || it.subjectUserId == subjectUserId } +
            ConsentType.entries
                .filter { it != ConsentType.LEARNER_DATA_PROCESSING }
                .flatMap { type ->
                    consentRepository.findByUserIdAndConsentTypeAndWithdrawnAtIsNull(userId, type)
                        .filter { subjectUserId == null || it.subjectUserId == subjectUserId }
                }

    fun hasActiveConsent(userId: Long, type: ConsentType, subjectUserId: Long? = null): Boolean =
        consentRepository.findByUserIdAndConsentTypeAndWithdrawnAtIsNull(userId, type)
            .any { it.subjectUserId == subjectUserId }
}
