package com.elekeza.backend.guardian

import org.springframework.http.ResponseEntity
import org.springframework.security.access.prepost.PreAuthorize
import org.springframework.web.bind.annotation.*

@RestController
@RequestMapping("/api/guardian")
class GuardianScheduleController {

    @GetMapping("/schedule")
    @PreAuthorize("hasAnyRole('GUARDIAN', 'ADMIN')")
    fun getSchedule(): ResponseEntity<List<Map<String, String>>> {
        // Return empty list for now
        return ResponseEntity.ok(emptyList())
    }
}
