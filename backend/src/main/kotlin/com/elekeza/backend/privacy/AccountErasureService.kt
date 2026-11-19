package com.elekeza.backend.privacy

import com.elekeza.backend.auth.PasswordResetTokenRepository
import com.elekeza.backend.auth.RefreshTokenRepository
import com.elekeza.backend.auth.User
import com.elekeza.backend.auth.UserRepository
import com.elekeza.backend.common.AuditLogService
import com.elekeza.backend.institution.GuardianLinkRepository
import org.springframework.http.HttpStatus
import org.springframework.security.crypto.password.PasswordEncoder
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.server.ResponseStatusException
import java.time.Instant
import java.util.UUID

/**
 * Account erasure.
 *
 * What "erasure" means here, deliberately:
 *  * **Identifying data is destroyed** — email, name, phone, gender, password —
 *    and the account is deactivated so it can never be logged into again.
 *  * **Access is destroyed** — every guardian link on either side of the
 *    account is revoked, active consents are withdrawn, refresh tokens and
 *    password-reset tokens are deleted.
 *  * **The row itself survives, anonymised**, because school records (attendance,
 *    submissions, deadlines) reference it. Deleting the row would either break
 *    those records or cascade-delete a school's academic history, which is not
 *    what a guardian consenting to erasure is asking for. The school's records
 *    stay; the person becomes unidentifiable.
 *
 * This is a defensible technical position, not a legal ruling. A Kenyan
 * data-protection review may require more (e.g. actual deletion of academic
 * rows after a retention window) — see
 * docs/operations/ELEKEZA_PRIVACY_CONSENT_ERASURE_RETENTION.md.
 */
@Service
class AccountErasureService(
    private val userRepository: UserRepository,
    private val guardianLinkRepository: GuardianLinkRepository,
    private val refreshTokenRepository: RefreshTokenRepository,
    private val passwordResetTokenRepository: PasswordResetTokenRepository,
    private val consentRepository: ConsentRepository,
    private val erasureLogRepository: ErasureLogRepository,
    private val passwordEncoder: PasswordEncoder,
    private val auditLogService: AuditLogService
) {
    companion object {
        const val ERASED_EMAIL_PREFIX = "erased-"
        const val ERASED_NAME = "Erased account"
    }

    data class ErasureResult(
        val userId: Long,
        val alreadyErased: Boolean,
        val linksRevoked: Int,
        val consentsWithdrawn: Int,
        val tokensDeleted: Int
    )

    @Transactional
    fun erase(target: User, actorId: Long?, reason: String): ErasureResult {
        if (target.email.startsWith(ERASED_EMAIL_PREFIX)) {
            // Idempotent: erasing an already-erased account is not an error and
            // must not overwrite the original evidence row.
            erasureLogRepository.save(
                ErasureLog(
                    userId = target.id,
                    actorId = actorId,
                    reason = reason.trim().take(255).ifEmpty { "ALREADY_ERASED" },
                    completedAt = Instant.now(),
                    alreadyErased = true
                )
            )
            return ErasureResult(target.id, alreadyErased = true, 0, 0, 0)
        }

        val now = Instant.now()

        // 1. Destroy access on both sides of every guardianship.
        val revokedAsGuardian = guardianLinkRepository.revokeAllForGuardian(target.id, now)
        val revokedAsLearner = guardianLinkRepository.revokeAllForLearner(target.id, now)
        val linksRevoked = revokedAsGuardian + revokedAsLearner

        // 2. Withdraw consents (history is kept — it is the proof they existed).
        val consentsWithdrawn = consentRepository.withdrawAllFor(target.id, now)

        // 3. Remove session and reset artefacts.
        val tokensBefore = refreshTokenRepository.countByUser(target)
        refreshTokenRepository.deleteByUser(target)
        passwordResetTokenRepository.deleteByUserId(target.id)

        // 4. Scrub identity. A random password is written so even an accidental
        //    reactivation cannot be logged into with a known/blank secret.
        userRepository.anonymize(
            id = target.id,
            email = "$ERASED_EMAIL_PREFIX${target.id}@erased.invalid",
            name = ERASED_NAME,
            password = passwordEncoder.encode(UUID.randomUUID().toString()),
            updatedAt = now
        )

        erasureLogRepository.save(
            ErasureLog(
                userId = target.id,
                actorId = actorId,
                reason = reason.trim().take(255).ifEmpty { "USER_REQUEST" },
                requestedAt = now,
                completedAt = Instant.now(),
                linksRevoked = linksRevoked,
                consentsWithdrawn = consentsWithdrawn
            )
        )

        auditLogService.log(
            action = "ACCOUNT_ERASED",
            category = "PRIVACY",
            userId = actorId,
            detail = "targetUserId=${target.id} linksRevoked=$linksRevoked consentsWithdrawn=$consentsWithdrawn " +
                "sessionsRevoked=$tokensBefore"
        )

        return ErasureResult(
            userId = target.id,
            alreadyErased = false,
            linksRevoked = linksRevoked,
            consentsWithdrawn = consentsWithdrawn,
            tokensDeleted = tokensBefore.toInt()
        )
    }

    /** Self-service erasure. */
    @Transactional
    fun eraseSelf(actor: User, reason: String?): ErasureResult =
        erase(target = actor, actorId = actor.id, reason = reason ?: "USER_REQUEST")

    /** Administrative erasure of another account (ADMIN only, enforced at the edge). */
    @Transactional
    fun eraseByAdmin(actor: User, targetUserId: Long, reason: String?): ErasureResult {
        val target = userRepository.findById(targetUserId).orElseThrow {
            ResponseStatusException(HttpStatus.NOT_FOUND, "User not found")
        }
        if (target.id == actor.id) {
            throw ResponseStatusException(
                HttpStatus.BAD_REQUEST,
                "Use the self-service erasure endpoint for your own account"
            )
        }
        return erase(target, actor.id, reason ?: "ADMIN_REQUEST")
    }

    /**
     * Erasure evidence for one account. The log stores reasons and counts, never
     * names or contact details, so this is safe to show the account holder.
     */
    fun historyFor(userId: Long): List<Map<String, Any?>> =
        erasureLogRepository.findByUserIdOrderByRequestedAtDesc(userId).map {
            mapOf(
                "id" to it.id,
                "reason" to it.reason,
                "requestedAt" to it.requestedAt,
                "completedAt" to it.completedAt,
                "linksRevoked" to it.linksRevoked,
                "consentsWithdrawn" to it.consentsWithdrawn,
                "alreadyErased" to it.alreadyErased
            )
        }
}
