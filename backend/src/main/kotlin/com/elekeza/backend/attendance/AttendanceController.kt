package com.elekeza.backend.attendance

import com.elekeza.backend.auth.User
import org.springframework.format.annotation.DateTimeFormat
import org.springframework.http.ResponseEntity
import org.springframework.security.access.prepost.PreAuthorize
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.web.bind.annotation.*
import java.time.LocalDate

@RestController
@RequestMapping("/api/attendance")
class AttendanceController(private val attendanceService: AttendanceService) {

    /** Classes for the register picker (teachers/admins). */
    @GetMapping("/classes")
    @PreAuthorize("hasAnyRole('TEACHER', 'SCHOOL_ADMIN', 'ADMIN')")
    fun classes(@AuthenticationPrincipal user: User): List<ClassDto> =
        attendanceService.listClasses(user)

    /** Roster with any existing marks for a class + date. */
    @GetMapping("/classes/{classId}/roster")
    @PreAuthorize("hasAnyRole('TEACHER', 'SCHOOL_ADMIN', 'ADMIN')")
    fun roster(
        @AuthenticationPrincipal user: User,
        @PathVariable classId: Long,
        @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) date: LocalDate
    ): List<ClassRosterEntry> =
        attendanceService.classRoster(user, classId, date)

    /** Save (create or update) the register for a class + date. */
    @PostMapping("/classes/{classId}/sessions")
    @PreAuthorize("hasAnyRole('TEACHER', 'SCHOOL_ADMIN', 'ADMIN')")
    fun save(
        @AuthenticationPrincipal user: User,
        @PathVariable classId: Long,
        @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) date: LocalDate,
        @RequestBody body: SaveAttendanceRequest
    ): AttendanceSessionDto =
        attendanceService.saveAttendance(user, classId, date, body.records)

    /** Learner attendance history: self, same-institution staff, or linked guardian. */
    @GetMapping("/learners/{learnerId}")
    @PreAuthorize("isAuthenticated()")
    fun learnerHistory(
        @AuthenticationPrincipal user: User,
        @PathVariable learnerId: Long
    ): LearnerAttendanceDto =
        attendanceService.learnerAttendance(user, learnerId)

    /** Institution-wide summary (admins), optional date range. */
    @GetMapping("/summary")
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN', 'ADMIN')")
    fun summary(
        @AuthenticationPrincipal user: User,
        @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) from: LocalDate?,
        @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) to: LocalDate?
    ): Map<String, Any> {
        val to_ = to ?: LocalDate.now()
        val from_ = from ?: to_.minusDays(30)
        return attendanceService.institutionSummary(user, from_, to_)
    }
}
