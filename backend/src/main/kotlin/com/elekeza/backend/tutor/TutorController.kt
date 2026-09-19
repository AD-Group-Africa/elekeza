package com.elekeza.backend.tutor

import com.elekeza.backend.auth.User
import org.springframework.http.ResponseEntity
import org.springframework.security.access.prepost.PreAuthorize
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

/**
 * AI Tutor endpoints — STUDENT-only by design. The tutor is a learner
 * surface; teachers/guardians see aggregate usage signals through analytics,
 * never the tutor itself.
 */
@RestController
@RequestMapping("/api/tutor")
@PreAuthorize("hasRole('STUDENT')")
class TutorController(private val tutorService: TutorService) {

    @PostMapping
    fun ask(@AuthenticationPrincipal student: User, @RequestBody req: TutorRequest): ResponseEntity<TutorResponse> =
        ResponseEntity.ok(tutorService.handle(student, req))

    /** Honest capability signal for the UI ("AI-powered" vs "built-in helper"). */
    @GetMapping("/status")
    fun status(): Map<String, Any> = mapOf(
        "providerConfigured" to tutorService.providerConfigured,
        "actions" to TutorAction.values().map { it.name }
    )
}
