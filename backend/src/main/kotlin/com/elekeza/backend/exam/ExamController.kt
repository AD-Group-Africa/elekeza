package com.elekeza.backend.exam

import com.elekeza.backend.auth.User
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.security.access.prepost.PreAuthorize
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.web.bind.annotation.*
import org.springframework.web.server.ResponseStatusException

@RestController
@RequestMapping("/api/exams")
class ExamController(private val examService: ExamService) {

    // ── Teacher/Admin authoring ───────────────────────────────────────────────

    @GetMapping
    @PreAuthorize("hasAnyRole('TEACHER', 'SCHOOL_ADMIN', 'ADMIN')")
    fun listExams(@AuthenticationPrincipal staff: User): ResponseEntity<List<ExamSummaryDto>> =
        ResponseEntity.ok(examService.listExamsForStaff(staff))

    @PostMapping
    @PreAuthorize("hasAnyRole('TEACHER', 'SCHOOL_ADMIN', 'ADMIN')")
    fun createExam(@AuthenticationPrincipal staff: User, @RequestBody req: CreateExamRequest): ResponseEntity<ExamDetailDto> =
        ResponseEntity.status(HttpStatus.CREATED).body(examService.createExam(staff, req))

    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('TEACHER', 'SCHOOL_ADMIN', 'ADMIN')")
    fun getExam(@AuthenticationPrincipal staff: User, @PathVariable id: Long): ResponseEntity<ExamDetailDto> =
        ResponseEntity.ok(examService.getExamForStaff(staff, id))

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('TEACHER', 'SCHOOL_ADMIN', 'ADMIN')")
    fun updateExam(@AuthenticationPrincipal staff: User, @PathVariable id: Long, @RequestBody req: UpdateExamRequest): ResponseEntity<ExamDetailDto> =
        ResponseEntity.ok(examService.updateExam(staff, id, req))

    @PostMapping("/{id}/publish")
    @PreAuthorize("hasAnyRole('TEACHER', 'SCHOOL_ADMIN', 'ADMIN')")
    fun publish(@AuthenticationPrincipal staff: User, @PathVariable id: Long): ResponseEntity<ExamDetailDto> =
        ResponseEntity.ok(examService.publishExam(staff, id))

    @PostMapping("/{id}/close")
    @PreAuthorize("hasAnyRole('TEACHER', 'SCHOOL_ADMIN', 'ADMIN')")
    fun close(@AuthenticationPrincipal staff: User, @PathVariable id: Long): ResponseEntity<ExamDetailDto> =
        ResponseEntity.ok(examService.closeExam(staff, id))

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('TEACHER', 'SCHOOL_ADMIN', 'ADMIN')")
    fun delete(@AuthenticationPrincipal staff: User, @PathVariable id: Long): ResponseEntity<Void> {
        examService.deleteDraftExam(staff, id)
        return ResponseEntity.noContent().build()
    }

    @GetMapping("/{id}/results")
    @PreAuthorize("hasAnyRole('TEACHER', 'SCHOOL_ADMIN', 'ADMIN')")
    fun results(@AuthenticationPrincipal staff: User, @PathVariable id: Long): ResponseEntity<List<ExamResultDto>> =
        ResponseEntity.ok(examService.listExamResultsForStaff(staff, id))

    @GetMapping("/attempts/{attemptId}/integrity")
    @PreAuthorize("hasAnyRole('TEACHER', 'SCHOOL_ADMIN', 'ADMIN')")
    fun integrity(@AuthenticationPrincipal staff: User, @PathVariable attemptId: Long): ResponseEntity<List<ExamIntegrityEvent>> =
        ResponseEntity.ok(examService.listIntegrityEvents(staff, attemptId))

    @PostMapping("/attempts/{attemptId}/mark")
    @PreAuthorize("hasAnyRole('TEACHER', 'SCHOOL_ADMIN', 'ADMIN')")
    fun mark(@AuthenticationPrincipal staff: User, @PathVariable attemptId: Long, @RequestBody req: MarkShortAnswerRequest): ResponseEntity<ExamResultDto> =
        ResponseEntity.ok(examService.markShortAnswer(staff, attemptId, req))

    // ── Student experience ────────────────────────────────────────────────────

    @GetMapping("/available")
    @PreAuthorize("hasRole('STUDENT')")
    fun available(@AuthenticationPrincipal student: User): ResponseEntity<List<ExamSummaryDto>> =
        ResponseEntity.ok(examService.listAvailableExams(student))

    @PostMapping("/{id}/start")
    @PreAuthorize("hasRole('STUDENT')")
    fun start(@AuthenticationPrincipal student: User, @PathVariable id: Long): ResponseEntity<StartAttemptResponse> =
        ResponseEntity.ok(examService.startAttempt(student, id))

    @PostMapping("/attempts/{attemptId}/answers")
    @PreAuthorize("hasRole('STUDENT')")
    fun saveAnswer(@AuthenticationPrincipal student: User, @PathVariable attemptId: Long, @RequestBody req: SaveAnswerRequest): ResponseEntity<Void> {
        examService.saveAnswer(student, attemptId, req)
        return ResponseEntity.noContent().build()
    }

    @PostMapping("/attempts/{attemptId}/integrity")
    @PreAuthorize("hasRole('STUDENT')")
    fun integrity(@AuthenticationPrincipal student: User, @PathVariable attemptId: Long, @RequestBody req: IntegrityEventRequest): ResponseEntity<Void> {
        examService.recordIntegrityEvent(student, attemptId, req)
        return ResponseEntity.noContent().build()
    }

    @PostMapping("/attempts/{attemptId}/submit")
    @PreAuthorize("hasRole('STUDENT')")
    fun submit(@AuthenticationPrincipal student: User, @PathVariable attemptId: Long, @RequestBody req: SubmitExamRequest): ResponseEntity<AttemptDto> =
        ResponseEntity.ok(examService.submitAttempt(student, attemptId, req))

    @GetMapping("/results")
    @PreAuthorize("hasRole('STUDENT')")
    fun myResults(@AuthenticationPrincipal student: User): ResponseEntity<List<ExamResultDto>> =
        ResponseEntity.ok(examService.listMyResults(student))

    @GetMapping("/results/{attemptId}")
    @PreAuthorize("hasRole('STUDENT')")
    fun myResult(@AuthenticationPrincipal student: User, @PathVariable attemptId: Long): ResponseEntity<ExamResultDto> =
        ResponseEntity.ok(examService.getMyResult(student, attemptId))

    // ── Guardian results (scoped to their wards) ───────────────────────────────

    @GetMapping("/guardian/{wardId}/results")
    @PreAuthorize("hasRole('GUARDIAN')")
    fun wardResults(@AuthenticationPrincipal guardian: User, @PathVariable wardId: Long): ResponseEntity<List<ExamResultDto>> =
        ResponseEntity.ok(examService.listWardResults(guardian, wardId))

    @GetMapping("/guardian/{wardId}/results/{attemptId}")
    @PreAuthorize("hasRole('GUARDIAN')")
    fun wardResult(@AuthenticationPrincipal guardian: User, @PathVariable wardId: Long, @PathVariable attemptId: Long): ResponseEntity<ExamResultDto> =
        ResponseEntity.ok(examService.getWardResult(guardian, wardId, attemptId))
}
