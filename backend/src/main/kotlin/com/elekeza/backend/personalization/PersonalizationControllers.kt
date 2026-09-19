package com.elekeza.backend.personalization

import com.elekeza.backend.auth.User
import com.elekeza.backend.auth.UserRepository
import com.elekeza.backend.auth.UserRole
import com.elekeza.backend.content.ContentAccessGuard
import com.elekeza.backend.content.ContentRepository
import org.springframework.http.ResponseEntity
import org.springframework.security.access.prepost.PreAuthorize
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.web.bind.annotation.*
import org.springframework.web.server.ResponseStatusException

// ── Learner: "How I learn" preferences ───────────────────────────────────────

@RestController
@RequestMapping("/api/learner")
class LearnerPreferencesController(private val service: PersonalizationService) {

    data class PreferenceUpdate(val key: String, val value: String)

    @GetMapping("/preferences")
    fun get(@AuthenticationPrincipal user: User): Map<String, Any> = mapOf(
        "learnerId" to user.id,
        "effective" to service.readEffective(user)
    )

    /** The learner always has final say over their own presentation. */
    @PutMapping("/preferences")
    @PreAuthorize("hasRole('STUDENT')")
    fun update(@AuthenticationPrincipal user: User, @RequestBody req: PreferenceUpdate): Map<String, Any> {
        val entry = service.writePreference(user, req.key, req.value, Source.EXPLICIT, allowDowngrade = true)
        return mapOf(
            "key" to req.key,
            "value" to entry.value,
            "source" to entry.source.name,
            "effective" to service.readEffective(user)
        )
    }
}

// ── Learner: adaptive content + feedback ─────────────────────────────────────

@RestController
class ContentAdaptationController(
    private val contentRepo: ContentRepository,
    private val accessGuard: ContentAccessGuard,
    private val adaptationService: ContentAdaptationService
) {
    @GetMapping("/api/content/lessons/{id}/adapted")
    fun adapted(
        @PathVariable id: Long,
        @RequestParam(required = false) code: String?,
        @AuthenticationPrincipal user: User
    ): Map<String, Any> {
        val content = contentRepo.findById(id)
            .orElseThrow { ResponseStatusException(org.springframework.http.HttpStatus.NOT_FOUND, "Lesson not found") }
        accessGuard.requireAccess(user, content)
        return adaptationService.getVariant(user, content, code)
    }

    data class FeedbackRequest(val helpful: Boolean, val code: String? = null)

    @PostMapping("/api/content/lessons/{id}/feedback")
    fun feedback(
        @PathVariable id: Long,
        @RequestBody req: FeedbackRequest,
        @AuthenticationPrincipal user: User
    ): Map<String, Any> {
        val content = contentRepo.findById(id)
            .orElseThrow { ResponseStatusException(org.springframework.http.HttpStatus.NOT_FOUND, "Lesson not found") }
        accessGuard.requireAccess(user, content)
        adaptationService.recordFeedback(user, id, req.helpful, req.code)
        return mapOf("recorded" to true)
    }
}

// ── Teacher: learning-support summary + guidance ─────────────────────────────

@RestController
@RequestMapping("/api/teacher")
class TeacherLearningSupportController(
    private val service: PersonalizationService,
    private val userRepo: UserRepository
) {
    data class GuidanceUpdate(val key: String, val value: String)

    @GetMapping("/student/{studentId}/learning-support")
    @PreAuthorize("hasAnyRole('TEACHER', 'SCHOOL_ADMIN', 'ADMIN')")
    fun support(@AuthenticationPrincipal teacher: User, @PathVariable studentId: Long): Map<String, Any> =
        service.teacherSupportSummary(teacher, studentId)

    /** Teacher guidance never overrides a preference the learner chose explicitly. */
    @PostMapping("/student/{studentId}/learning-preferences")
    @PreAuthorize("hasAnyRole('TEACHER', 'SCHOOL_ADMIN', 'ADMIN')")
    fun guide(@AuthenticationPrincipal teacher: User, @PathVariable studentId: Long, @RequestBody req: GuidanceUpdate): Map<String, Any> {
        val student = userRepo.findById(studentId)
            .orElseThrow { ResponseStatusException(org.springframework.http.HttpStatus.NOT_FOUND, "Student not found") }
        if (student.role != UserRole.STUDENT || student.institutionId != teacher.institutionId) {
            throw ResponseStatusException(org.springframework.http.HttpStatus.FORBIDDEN, "Student not in your institution")
        }
        val entry = service.writePreference(student, req.key, req.value, Source.TEACHER, allowDowngrade = false)
        return mapOf("key" to req.key, "value" to entry.value, "source" to entry.source.name)
    }
}

// ── Guardian: plain-language ward support summary ────────────────────────────

@RestController
@RequestMapping("/api/guardian")
class GuardianLearningSupportController(private val service: PersonalizationService) {

    @GetMapping("/wards/{wardId}/learning-support")
    @PreAuthorize("hasAnyRole('GUARDIAN', 'ADMIN')")
    fun support(@AuthenticationPrincipal guardian: User, @PathVariable wardId: Long): Map<String, Any> =
        service.guardianSupportSummary(guardian, wardId)
}
