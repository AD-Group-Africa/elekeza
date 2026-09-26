package com.elekeza.backend.guardian

import com.elekeza.backend.auth.User
import com.elekeza.backend.auth.UserRepository
import com.elekeza.backend.auth.UserRole
import com.elekeza.backend.institution.GuardianLink
import com.elekeza.backend.institution.GuardianLinkRepository
import com.elekeza.backend.institution.InstitutionRepository
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.bind.annotation.*
import org.springframework.web.server.ResponseStatusException
import java.time.Instant

/**
 * Guardian link lifecycle: schools (and only schools) revoke or restore the
 * guardian↔learner relationship, and grant temporary (expiring) links. The
 * learner experience is unchanged; revoked or expired links simply stop
 * granting ward access everywhere (finance, attendance, assignments, digest,
 * exams) because every check now consults [GuardianLink.currentlyActive].
 */
@Service
@Transactional
class GuardianLinkLifecycleService(
    private val guardianLinkRepository: GuardianLinkRepository,
    private val userRepository: UserRepository,
    private val institutionRepository: InstitutionRepository,
) {
    data class LinkView(
        val id: Long,
        val guardianId: Long,
        val guardianEmail: String,
        val learnerId: Long,
        val learnerName: String,
        val relationship: String,
        val active: Boolean,
        val revoked: Boolean,
        val expiresAt: String?,
    )

    fun listForLearner(actor: User, institutionId: Long, learnerId: Long): List<LinkView> {
        requireInstitutionAccess(actor, institutionId)
        val learner = userRepository.findById(learnerId).orElse(null)
            ?: throw ResponseStatusException(HttpStatus.NOT_FOUND, "Learner not found")
        if (learner.institutionId != institutionId) throw ResponseStatusException(HttpStatus.NOT_FOUND, "Learner not found")
        return guardianLinkRepository.findByLearnerId(learnerId).map { it.toView() }
    }

    /** Revoke a guardian's access to a learner (soft, reversible). */
    fun revoke(actor: User, institutionId: Long, learnerId: Long, guardianId: Long) {
        assertCanManage(actor, institutionId, learnerId)
        val link = findLink(guardianId, learnerId)
        if (link.revokedAt == null) {
            guardianLinkRepository.save(
                GuardianLink(
                    id = link.id,
                    guardianId = link.guardianId,
                    learnerId = link.learnerId,
                    relationship = link.relationship,
                    isActive = link.isActive,
                    expiresAt = link.expiresAt,
                    revokedAt = Instant.now(),
                )
            )
        }
    }

    /** Restore a revoked link. */
    fun restore(actor: User, institutionId: Long, learnerId: Long, guardianId: Long) {
        assertCanManage(actor, institutionId, learnerId)
        val link = findLink(guardianId, learnerId)
        if (link.revokedAt != null) {
            guardianLinkRepository.save(
                GuardianLink(
                    id = link.id,
                    guardianId = link.guardianId,
                    learnerId = link.learnerId,
                    relationship = link.relationship,
                    isActive = true,
                    expiresAt = link.expiresAt,
                    revokedAt = null,
                )
            )
        }
    }

    /**
     * Grant a temporary caregiving link that expires automatically — e.g. a
     * relative supporting a learner during a school holiday.
     */
    fun grantTemporary(actor: User, institutionId: Long, learnerId: Long, guardianId: Long, expiresAt: Instant): LinkView {
        assertCanManage(actor, institutionId, learnerId)
        val guardian = userRepository.findById(guardianId).orElse(null)
            ?: throw ResponseStatusException(HttpStatus.NOT_FOUND, "Guardian not found")
        if (guardian.institutionId != institutionId) throw ResponseStatusException(HttpStatus.NOT_FOUND, "Guardian not found")
        if (!expiresAt.isAfter(Instant.now())) {
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, "expiresAt must be in the future")
        }
        val existing = guardianLinkRepository.findByGuardianIdAndLearnerIdAndIsActiveTrue(guardianId, learnerId)
        val saved = guardianLinkRepository.save(
            GuardianLink(
                id = existing?.id ?: 0,
                guardianId = guardianId,
                learnerId = learnerId,
                relationship = existing?.relationship ?: "CAREGIVER",
                isActive = true,
                expiresAt = expiresAt,
                revokedAt = null,
            )
        )
        return saved.toView()
    }

    private fun findLink(guardianId: Long, learnerId: Long): GuardianLink {
        val link = guardianLinkRepository.findByGuardianIdAndLearnerIdAndIsActiveTrue(guardianId, learnerId)
            ?: guardianLinkRepository.findByGuardianId(guardianId).firstOrNull { it.learnerId == learnerId }
            ?: throw ResponseStatusException(HttpStatus.NOT_FOUND, "Guardian link not found")
        return link
    }

    private fun assertCanManage(actor: User, institutionId: Long, learnerId: Long) {
        requireInstitutionAccess(actor, institutionId)
        val learner = userRepository.findById(learnerId).orElse(null)
            ?: throw ResponseStatusException(HttpStatus.NOT_FOUND, "Learner not found")
        if (learner.institutionId != institutionId) throw ResponseStatusException(HttpStatus.NOT_FOUND, "Learner not found")
    }

    private fun requireInstitutionAccess(actor: User, institutionId: Long) {
        if (actor.role != UserRole.ADMIN && actor.institutionId != institutionId) {
            throw ResponseStatusException(HttpStatus.FORBIDDEN, "Not authorized to manage guardian links")
        }
    }

    private fun GuardianLink.toView() = LinkView(
        id = id,
        guardianId = guardianId,
        guardianEmail = userRepository.findById(guardianId).orElse(null)?.email ?: "",
        learnerId = learnerId,
        learnerName = userRepository.findById(learnerId).orElse(null)?.name ?: "",
        relationship = relationship,
        active = currentlyActive(),
        revoked = revokedAt != null,
        expiresAt = expiresAt?.toString(),
    )
}

@RestController
@RequestMapping("/api/institutions/{institutionId}/learners/{learnerId}/guardian-links")
class GuardianLinkLifecycleController(
    private val service: GuardianLinkLifecycleService,
) {
    @GetMapping
    fun list(
        @AuthenticationPrincipal actor: User,
        @PathVariable institutionId: Long,
        @PathVariable learnerId: Long,
    ) = ResponseEntity.ok(service.listForLearner(actor, institutionId, learnerId))

    @PostMapping("/{guardianId}/revoke")
    fun revoke(
        @AuthenticationPrincipal actor: User,
        @PathVariable institutionId: Long,
        @PathVariable learnerId: Long,
        @PathVariable guardianId: Long,
    ): ResponseEntity<Map<String, String>> {
        service.revoke(actor, institutionId, learnerId, guardianId)
        return ResponseEntity.ok(mapOf("message" to "Guardian access revoked"))
    }

    @PostMapping("/{guardianId}/restore")
    fun restore(
        @AuthenticationPrincipal actor: User,
        @PathVariable institutionId: Long,
        @PathVariable learnerId: Long,
        @PathVariable guardianId: Long,
    ): ResponseEntity<Map<String, String>> {
        service.restore(actor, institutionId, learnerId, guardianId)
        return ResponseEntity.ok(mapOf("message" to "Guardian access restored"))
    }

    @PostMapping("/{guardianId}/temporary")
    fun grantTemporary(
        @AuthenticationPrincipal actor: User,
        @PathVariable institutionId: Long,
        @PathVariable learnerId: Long,
        @PathVariable guardianId: Long,
        @RequestParam expiresAt: String,
    ): ResponseEntity<GuardianLinkLifecycleService.LinkView> {
        val expiry = runCatching { Instant.parse(expiresAt) }.getOrElse {
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, "expiresAt must be an ISO-8601 timestamp")
        }
        return ResponseEntity.ok(service.grantTemporary(actor, institutionId, learnerId, guardianId, expiry))
    }
}
