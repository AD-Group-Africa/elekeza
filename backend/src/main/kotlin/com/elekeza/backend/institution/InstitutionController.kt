package com.elekeza.backend.institution

import com.elekeza.backend.auth.User
import com.elekeza.backend.auth.UserRole
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.security.access.prepost.PreAuthorize
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.web.bind.annotation.*
import org.springframework.web.multipart.MultipartFile
import org.springframework.web.server.ResponseStatusException

@RestController
@RequestMapping("/api/institutions")
class InstitutionController(
    private val institutionService: InstitutionService,
) {
    @PostMapping("/register")
    fun register(@RequestBody request: InstitutionService.InstitutionRegistrationRequest): ResponseEntity<Institution> {
        val institution = institutionService.registerInstitution(request)
        return ResponseEntity.status(HttpStatus.CREATED).body(institution)
    }

    @PostMapping("/{institutionId}/students/import")
    @PreAuthorize("hasAnyRole('ADMIN', 'SCHOOL_ADMIN')")
    fun importStudents(
        @PathVariable institutionId: Long,
        @AuthenticationPrincipal user: User,
        @RequestParam("file") file: MultipartFile,
    ): ResponseEntity<InstitutionService.ImportResult> {
        requireInstitutionAccess(user, institutionId)
        val result = institutionService.importStudentsFromCsv(institutionId, file)
        return ResponseEntity.ok(result)
    }

    @GetMapping
    @PreAuthorize("hasRole('ADMIN')")
    fun listInstitutions(): ResponseEntity<List<Institution>> {
        return ResponseEntity.ok(institutionService.listInstitutions())
    }

    @GetMapping("/{institutionId}/students")
    @PreAuthorize("hasAnyRole('ADMIN', 'SCHOOL_ADMIN')")
    fun getStudents(
        @PathVariable institutionId: Long,
        @AuthenticationPrincipal user: User
    ): ResponseEntity<List<InstitutionService.StudentSummary>> {
        requireInstitutionAccess(user, institutionId)
        return ResponseEntity.ok(institutionService.getStudents(institutionId))
    }

    /**
     * SCHOOL_ADMINs may only read/manage their own institution. A path
     * institutionId that is not the caller's own institution is rejected,
     * regardless of role, preventing cross-institution roster access.
     */
    private fun requireInstitutionAccess(user: User, institutionId: Long) {
        if (user.role != UserRole.ADMIN && user.institutionId != institutionId) {
            throw ResponseStatusException(
                HttpStatus.FORBIDDEN,
                "You don't have permission to access this institution"
            )
        }
    }
}
