package com.elekeza.backend.timetable

import com.elekeza.backend.auth.User
import org.springframework.http.ResponseEntity
import org.springframework.security.access.prepost.PreAuthorize
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.web.bind.annotation.*

/**
 * Persisted timetable API. Learners/guardians get read access through their
 * class relationships elsewhere; this controller serves staff and admins.
 */
@RestController
@RequestMapping("/api/timetable")
class TimetableController(
    private val timetableService: TimetableService,
) {
    @GetMapping("/{classId}")
    @PreAuthorize("hasAnyRole('TEACHER', 'SCHOOL_ADMIN', 'ADMIN', 'STUDENT', 'GUARDIAN')")
    fun getTimetable(
        @PathVariable classId: Long,
        @AuthenticationPrincipal actor: User,
    ): ResponseEntity<List<TimetableEntry>> =
        ResponseEntity.ok(timetableService.getTimetable(actor, classId))

    @PostMapping("/slot")
    @PreAuthorize("hasAnyRole('TEACHER', 'SCHOOL_ADMIN', 'ADMIN')")
    fun setSlot(
        @AuthenticationPrincipal actor: User,
        @RequestBody req: TimetableService.SlotRequest,
    ): ResponseEntity<TimetableEntry> =
        ResponseEntity.ok(timetableService.setSlot(actor, req))

    @DeleteMapping("/{classId}/{day}/{period}")
    @PreAuthorize("hasAnyRole('TEACHER', 'SCHOOL_ADMIN', 'ADMIN')")
    fun clearSlot(
        @PathVariable classId: Long,
        @PathVariable day: String,
        @PathVariable period: Int,
        @AuthenticationPrincipal actor: User,
    ): ResponseEntity<Map<String, String>> {
        timetableService.clearSlot(actor, classId, day, period)
        return ResponseEntity.ok(mapOf("message" to "Slot cleared"))
    }
}
