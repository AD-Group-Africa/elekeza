package com.elekeza.backend.assignments

import com.elekeza.backend.auth.User
import org.springframework.http.HttpStatus
import org.springframework.security.access.prepost.PreAuthorize
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.web.bind.annotation.*
import org.springframework.web.server.ResponseStatusException

@RestController("learnerAssignmentController")
@RequestMapping("/api/assignments")
class AssignmentController(private val assignmentService: AssignmentService) {

    // ── Teacher / admin ─────────────────────────────────────────────────────

    @PostMapping
    @PreAuthorize("hasAnyRole('TEACHER', 'SCHOOL_ADMIN', 'ADMIN')")
    fun create(@AuthenticationPrincipal user: User, @RequestBody req: CreateAssignmentRequest): AssignmentDto =
        assignmentService.create(user, req)

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('TEACHER', 'SCHOOL_ADMIN', 'ADMIN')")
    fun update(@AuthenticationPrincipal user: User, @PathVariable id: Long, @RequestBody req: UpdateAssignmentRequest): AssignmentDto =
        assignmentService.update(user, id, req)

    @GetMapping("/classes/{classId}")
    @PreAuthorize("hasAnyRole('TEACHER', 'SCHOOL_ADMIN', 'ADMIN', 'STUDENT')")
    fun classAssignments(@AuthenticationPrincipal user: User, @PathVariable classId: Long): List<AssignmentDto> =
        assignmentService.classAssignments(user, classId)

    @GetMapping("/{id}/submissions")
    @PreAuthorize("hasAnyRole('TEACHER', 'SCHOOL_ADMIN', 'ADMIN')")
    fun submissions(@AuthenticationPrincipal user: User, @PathVariable id: Long): List<SubmissionDto> =
        assignmentService.submissionsForAssignment(user, id)

    @PostMapping("/submissions/{submissionId}/grade")
    @PreAuthorize("hasAnyRole('TEACHER', 'SCHOOL_ADMIN', 'ADMIN')")
    fun grade(
        @AuthenticationPrincipal user: User,
        @PathVariable submissionId: Long,
        @RequestBody req: GradeSubmissionRequest
    ): SubmissionDto = assignmentService.grade(user, submissionId, req)

    // ── Learner ──────────────────────────────────────────────────────────────

    @GetMapping("/learner/mine")
    @PreAuthorize("hasRole('STUDENT')")
    fun myAssignments(@AuthenticationPrincipal user: User): List<AssignmentDto> =
        assignmentService.myLearnerAssignments(user)

    @PostMapping("/{id}/submit")
    @PreAuthorize("hasRole('STUDENT')")
    fun submit(@AuthenticationPrincipal user: User, @PathVariable id: Long, @RequestBody req: SubmitAssignmentRequest): SubmissionDto =
        assignmentService.submit(user, id, req)

    @GetMapping("/learner/submissions")
    @PreAuthorize("hasRole('STUDENT')")
    fun mySubmissions(@AuthenticationPrincipal user: User): List<SubmissionDto> =
        assignmentService.mySubmissions(user)

    // ── Guardian (read-only ward evidence) ───────────────────────────────────

    @GetMapping("/guardian/wards/{learnerId}/submissions")
    @PreAuthorize("hasRole('GUARDIAN')")
    fun wardSubmissions(@AuthenticationPrincipal user: User, @PathVariable learnerId: Long): List<SubmissionDto> =
        assignmentService.wardSubmissions(user, learnerId)
}
