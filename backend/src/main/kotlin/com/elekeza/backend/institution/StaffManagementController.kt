package com.elekeza.backend.institution

import com.elekeza.backend.auth.User
import org.springframework.http.ResponseEntity
import org.springframework.security.access.prepost.PreAuthorize
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.web.bind.annotation.*

/**
 * School-level staff administration API. All routes are tenant-scoped: a
 * SCHOOL_ADMIN can only see and manage accounts belonging to their own
 * institution; the platform ADMIN bypass is the same one used by the rest of
 * the institution domain. No route can create or touch a platform ADMIN.
 */
@RestController
@RequestMapping("/api/institutions/{institutionId}/staff")
class StaffManagementController(
    private val staffManagementService: StaffManagementService,
) {
    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'SCHOOL_ADMIN')")
    fun listStaff(
        @PathVariable institutionId: Long,
        @AuthenticationPrincipal actor: User,
    ): ResponseEntity<List<StaffManagementService.StaffView>> =
        ResponseEntity.ok(staffManagementService.listStaff(actor, institutionId))

    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'SCHOOL_ADMIN')")
    fun createStaff(
        @PathVariable institutionId: Long,
        @AuthenticationPrincipal actor: User,
        @RequestBody req: StaffManagementService.CreateStaffRequest,
    ): ResponseEntity<StaffManagementService.StaffView> =
        ResponseEntity.status(201).body(staffManagementService.createStaff(actor, institutionId, req))

    @PatchMapping("/{userId}/active")
    @PreAuthorize("hasAnyRole('ADMIN', 'SCHOOL_ADMIN')")
    fun setActive(
        @PathVariable institutionId: Long,
        @PathVariable userId: Long,
        @RequestParam active: Boolean,
        @AuthenticationPrincipal actor: User,
    ): ResponseEntity<StaffManagementService.StaffView> =
        ResponseEntity.ok(staffManagementService.setActive(actor, institutionId, userId, active))

    @PostMapping("/{userId}/password-reset")
    @PreAuthorize("hasAnyRole('ADMIN', 'SCHOOL_ADMIN')")
    fun requestPasswordReset(
        @PathVariable institutionId: Long,
        @PathVariable userId: Long,
        @AuthenticationPrincipal actor: User,
    ): ResponseEntity<Map<String, String>> {
        staffManagementService.adminResetPassword(actor, institutionId, userId)
        return ResponseEntity.ok(mapOf("message" to "A password reset notice has been sent to the user's email."))
    }
}
