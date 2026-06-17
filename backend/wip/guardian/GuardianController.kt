package com.elekeza.guardian

import org.springframework.http.ResponseEntity
import org.springframework.security.access.prepost.PreAuthorize
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.web.bind.annotation.*
import com.elekeza.user.User

@RestController
@RequestMapping("/api/guardian")
@PreAuthorize("hasAnyRole('GUARDIAN', 'PARENT')")
class GuardianController(
    private val guardianService: GuardianService,
) {
    @GetMapping("/children")
    fun getChildren(
        @AuthenticationPrincipal guardian: User,
    ): ResponseEntity<List<GuardianService.ChildProgress>> {
        return ResponseEntity.ok(guardianService.getChildren(guardian.id))
    }
}