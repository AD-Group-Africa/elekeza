package com.elekeza.backend.institution

import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.security.access.prepost.PreAuthorize
import org.springframework.web.bind.annotation.*
import org.springframework.web.multipart.MultipartFile

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
        @RequestParam("file") file: MultipartFile,
    ): ResponseEntity<InstitutionService.ImportResult> {
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
    fun getStudents(@PathVariable institutionId: Long): ResponseEntity<List<InstitutionService.StudentSummary>> {
        return ResponseEntity.ok(institutionService.getStudents(institutionId))
    }
}
