package com.elekeza.backend.calendar

import com.elekeza.backend.auth.User
import com.elekeza.backend.auth.UserRole
import com.elekeza.backend.institution.InstitutionRepository
import com.elekeza.backend.auth.UserRepository
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.security.access.prepost.PreAuthorize
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.web.bind.annotation.*
import org.springframework.web.server.ResponseStatusException
import java.time.Instant
import java.time.format.DateTimeParseException

@RestController
@RequestMapping("/api/deadlines")
class DeadlineController(
    private val repo: DeadlineRepository,
    private val userRepo: UserRepository,
    private val institutionRepo: InstitutionRepository,
    private val visibility: DeadlineVisibility,
) {

    private val logger = org.slf4j.LoggerFactory.getLogger(DeadlineController::class.java)

    data class CreateDeadlineRequest(
        val title: String,
        val deadlineType: DeadlineType,
        val scope: DeadlineScope = DeadlineScope.INSTITUTION,
        val dueAt: String,
        val description: String? = null,
        val userId: Long? = null,
        val institutionId: Long? = null,
        /** Required to make a REGIONAL deadline visible; see V20. */
        val county: String? = null,
    )

    /**
     * Visible deadlines depend on role and scope:
     *  - ADMIN sees everything (platform operator).
     *  - NATIONAL dates are public reference dates for any authenticated user.
     *  - REGIONAL dates are visible only where the deadline's county matches an
     *    institution the viewer is entitled to (a guardian's actively linked
     *    wards). A regional row without a county matches nobody.
     *  - INSTITUTION/CLASS rows require the viewer's institutionId to match the
     *    deadline's institutionId (CLASS rows carry no class target — see the
     *    creation policy; they behave like institution rows until a class
     *    target model exists).
     *  - INDIVIDUAL rows are visible ONLY to the targeted user.
     * Guardians have no institutionId, so school-dated visibility for them is
     * served through the active-guardian-link rule in
     * [com.elekeza.backend.guardian.GuardianScheduleController].
     */
    @GetMapping
    fun list(@AuthenticationPrincipal user: User): ResponseEntity<List<Deadline>> {
        // One shared rule for both endpoints (DeadlineVisibility); see V20 for
        // the county model that makes REGIONAL dates scopeable at all.
        return ResponseEntity.ok(visibility.visibleDeadlines(user))
    }

    /**
     * Server-side authorization for deadline creation. Client-supplied IDs are
     * never treated as proof of authorization:
     *
     *  - NATIONAL/REGIONAL: ADMIN only. The governance register documents that
     *    national/county official roles are NOT IMPLEMENTED, so no policy
     *    grants SCHOOL_ADMIN or TEACHER ministry-scale publishing rights. (A
     *    region model does not exist yet either — see the report.)
     *  - INSTITUTION: a SCHOOL_ADMIN/TEACHER may only target their OWN
     *    institution; a global ADMIN (no institution of their own) must name
     *    an existing institution explicitly.
     *  - INDIVIDUAL: a real target user is required; staff may only target
     *    themselves or users inside their own institution (ADMIN may target
     *    anyone). The stored institutionId comes from the target, and a
     *    client-supplied conflicting institutionId is rejected.
     *  - CLASS: the Deadline entity has no class target — creating CLASS rows
     *    via the API is rejected until the data model supports one.
     */
    @PostMapping
    @PreAuthorize("hasAnyRole('TEACHER','ADMIN','SCHOOL_ADMIN')")
    fun create(
        @AuthenticationPrincipal user: User,
        @RequestBody request: CreateDeadlineRequest,
    ): ResponseEntity<Deadline> {
        if (request.title.isBlank()) {
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, "title is required")
        }
        val dueAt = try {
            Instant.parse(request.dueAt)
        } catch (e: DateTimeParseException) {
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, "dueAt must be an ISO-8601 timestamp (e.g. 2026-01-31T12:00:00Z)")
        }

        when (request.scope) {
            DeadlineScope.NATIONAL, DeadlineScope.REGIONAL -> {
                if (user.role != UserRole.ADMIN) {
                    throw ResponseStatusException(HttpStatus.FORBIDDEN, "Only ADMIN may create national or regional deadlines")
                }
            }
            DeadlineScope.INSTITUTION -> {
                val targetInstitutionId = request.institutionId ?: user.institutionId
                    ?: throw ResponseStatusException(HttpStatus.BAD_REQUEST, "institutionId is required for institution-scoped deadlines")
                if (user.role != UserRole.ADMIN && user.institutionId != null && request.institutionId != null && request.institutionId != user.institutionId) {
                    throw ResponseStatusException(HttpStatus.FORBIDDEN, "Deadlines can only be created for your own institution")
                }
                if (user.role != UserRole.ADMIN && user.institutionId == null) {
                    throw ResponseStatusException(HttpStatus.BAD_REQUEST, "Your account is not linked to an institution")
                }
                if (user.role == UserRole.ADMIN && institutionRepo.findById(targetInstitutionId).orElse(null) == null) {
                    throw ResponseStatusException(HttpStatus.NOT_FOUND, "Institution not found")
                }
            }
            DeadlineScope.INDIVIDUAL -> {
                val targetId = request.userId
                    ?: throw ResponseStatusException(HttpStatus.BAD_REQUEST, "userId is required for individual deadlines")
                if (request.institutionId != null) {
                    throw ResponseStatusException(HttpStatus.BAD_REQUEST, "institutionId must not be set for individual deadlines")
                }
                val target = userRepo.findById(targetId).orElse(null)
                    ?: throw ResponseStatusException(HttpStatus.NOT_FOUND, "Target user not found")
                val authorized = target.id == user.id ||
                    user.role == UserRole.ADMIN ||
                    (user.institutionId != null && user.institutionId == target.institutionId)
                if (!authorized) {
                    throw ResponseStatusException(HttpStatus.FORBIDDEN, "Not authorized to create a deadline for this user")
                }
            }
            DeadlineScope.CLASS -> {
                // Unresolved product decision: the Deadline entity has no class
                // target, so a CLASS-scope deadline cannot be scoped, validated
                // or rendered correctly. Reject creation until a class target
                // model exists (no migration invented here).
                throw ResponseStatusException(HttpStatus.BAD_REQUEST, "CLASS-scope deadlines are not supported yet (no class target model)")
            }
        }

        val institutionId = when (request.scope) {
            DeadlineScope.INDIVIDUAL -> null
            DeadlineScope.INSTITUTION -> request.institutionId ?: user.institutionId
            else -> null
        }
        // County scoping (V20). Only REGIONAL deadlines carry a county. A value
        // that normalises to nothing is rejected rather than stored; an absent
        // value is accepted but the row becomes invisible to everyone until an
        // administrator assigns a county. A missing county is never global.
        val countyCode = CountyKey.normalize(request.county)
        if (request.scope == DeadlineScope.REGIONAL) {
            if (request.county != null && countyCode == null) {
                throw ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "county must contain at least one letter or digit"
                )
            }
            if (countyCode == null) {
                logger.warn(
                    "Creating REGIONAL deadline '{}' without a county: it is stored but visible to nobody until corrected",
                    request.title
                )
            }
        } else if (request.county != null) {
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, "county is only valid for REGIONAL deadlines")
        }

        val deadline = repo.save(Deadline(
            title = request.title,
            deadlineType = request.deadlineType,
            scope = request.scope,
            dueAt = dueAt,
            description = request.description,
            userId = request.userId,
            institutionId = institutionId,
            countyCode = countyCode,
            createdBy = user.id,
        ))
        return ResponseEntity.ok(deadline)
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('TEACHER','ADMIN','SCHOOL_ADMIN')")
    fun delete(@PathVariable id: Long, @AuthenticationPrincipal user: User): ResponseEntity<Map<String, Boolean>> {
        val deadline = repo.findById(id).orElse(null) ?: return ResponseEntity.ok(mapOf("success" to false))
        if (user.role != UserRole.ADMIN && deadline.createdBy != user.id) {
            return ResponseEntity.status(403).body(mapOf("success" to false))
        }
        repo.delete(deadline)
        return ResponseEntity.ok(mapOf("success" to true))
    }
}
