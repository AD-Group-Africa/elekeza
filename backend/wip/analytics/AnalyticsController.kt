package com.elekeza.analytics

import com.elekeza.user.User
import org.springframework.http.ResponseEntity
import org.springframework.security.access.prepost.PreAuthorize
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.web.bind.annotation.*

@RestController
@RequestMapping("/api/admin/analytics")
@PreAuthorize("hasAnyRole('ADMIN', 'SCHOOL_ADMIN')")
class AnalyticsController(
    private val analyticsService: AnalyticsService
) {
    @GetMapping
    fun getAnalytics(
        @AuthenticationPrincipal admin: User
    ): ResponseEntity<Map<String, Any>> {
        return ResponseEntity.ok(analyticsService.getInstitutionAnalytics(admin.institutionId))
    }
}