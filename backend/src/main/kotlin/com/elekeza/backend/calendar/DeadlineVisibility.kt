package com.elekeza.backend.calendar

import com.elekeza.backend.auth.User
import com.elekeza.backend.auth.UserRepository
import com.elekeza.backend.auth.UserRole
import com.elekeza.backend.institution.GuardianLinkRepository
import com.elekeza.backend.institution.InstitutionRepository
import org.springframework.stereotype.Component

/**
 * The single visibility rule for school dates, shared by `/api/deadlines` and
 * `/api/guardian/schedule`.
 *
 * Before this rule existed in one place, the two endpoints each carried their
 * own copy and disagreed — guardians saw REGIONAL dates that the deadline
 * endpoint had already stopped serving (see
 * docs/audit/ELEKEZA_REGIONAL_SCHOOL_DATES_REGRESSION_REVIEW.md). Any future
 * change to who sees what belongs here, not in a controller.
 *
 * ## Contract
 *
 * | Scope | Visible to |
 * |---|---|
 * | `NATIONAL` | every authenticated user |
 * | `REGIONAL` | only when [Deadline.countyCode] matches the county of an institution the viewer is entitled to — for a guardian, an institution attended by one of their **actively linked** wards |
 * | `INSTITUTION`, `CLASS` | only when `institutionId` is an institution the viewer is entitled to |
 * | `INDIVIDUAL` | only the targeted user |
 *
 * `ADMIN` is the platform operator and sees everything.
 *
 * ## Fail-closed rules
 * * A regional row with a null/blank `countyCode` matches nothing.
 * * An institution with a null/blank `county` contributes nothing.
 * * A guardian with no **active** link, or whose wards have no institution,
 *   gets no regional and no institution-scoped dates.
 *
 * A missing county is never treated as "matches everything".
 *
 * ## Entitlement
 * * Guardians: institutions of their currently active guardian links only
 *   (revoked, deactivated and expired links grant nothing).
 * * Staff / learners: their own institution.
 */
@Component
class DeadlineVisibility(
    private val deadlineRepo: DeadlineRepository,
    private val guardianLinkRepo: GuardianLinkRepository,
    private val userRepo: UserRepository,
    private val institutionRepo: InstitutionRepository,
) {

    /** The institutions and counties a viewer is entitled to. */
    data class Scope(
        val institutionIds: Set<Long> = emptySet(),
        val countyKeys: Set<String> = emptySet(),
    )

    fun resolveScope(viewer: User): Scope {
        val institutionIds: Set<Long> = when (viewer.role) {
            UserRole.GUARDIAN -> guardianLinkRepo.findByGuardianId(viewer.id)
                .filter { it.currentlyActive() }
                .mapNotNull { link -> userRepo.findById(link.learnerId).orElse(null)?.institutionId }
                .toSet()
            else -> setOfNotNull(viewer.institutionId)
        }
        if (institutionIds.isEmpty()) return Scope()
        val countyKeys = institutionRepo.findAllById(institutionIds)
            .mapNotNull { CountyKey.normalize(it.county) }
            .toSet()
        return Scope(institutionIds, countyKeys)
    }

    fun visibleDeadlines(viewer: User): List<Deadline> {
        if (viewer.role == UserRole.ADMIN) {
            return deadlineRepo.findAll().sortedBy { it.dueAt }
        }

        val scope = resolveScope(viewer)

        val national = deadlineRepo.findByScopeOrderByDueAtAsc(DeadlineScope.NATIONAL)

        val regional = if (scope.countyKeys.isEmpty()) {
            emptyList()
        } else {
            deadlineRepo.findByScopeAndCountyCodeInOrderByDueAtAsc(DeadlineScope.REGIONAL, scope.countyKeys)
        }

        val institutional = if (scope.institutionIds.isEmpty()) {
            emptyList()
        } else {
            deadlineRepo.findByScopeInAndInstitutionIdInOrderByDueAtAsc(
                listOf(DeadlineScope.INSTITUTION, DeadlineScope.CLASS),
                scope.institutionIds
            )
        }

        val personal = deadlineRepo.findByUserIdOrderByDueAtAsc(viewer.id)

        return (national + regional + institutional + personal)
            .distinctBy { it.id }
            .sortedBy { it.dueAt }
    }
}
