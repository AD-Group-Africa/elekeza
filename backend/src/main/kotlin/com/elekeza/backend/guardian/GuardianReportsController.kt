package com.elekeza.backend.guardian

import org.springframework.http.ResponseEntity
import org.springframework.security.access.prepost.PreAuthorize
import org.springframework.web.bind.annotation.*

@RestController
@RequestMapping("/api/guardian")
class GuardianReportsController {

    @GetMapping("/reports")
    @PreAuthorize("hasAnyRole('GUARDIAN', 'ADMIN')")
    fun getReports(): ResponseEntity<List<Map<String, String>>> {
        // Return empty list for now; replace with real report generation
        return ResponseEntity.ok(emptyList())
    }
}
