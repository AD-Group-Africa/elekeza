package com.elekeza.backend.learner

import jakarta.validation.Valid
import org.springframework.http.HttpStatus
import org.springframework.security.access.prepost.PreAuthorize
import org.springframework.security.core.Authentication
import org.springframework.web.bind.annotation.*
import org.springframework.web.server.ResponseStatusException
import java.util.UUID

/**
 * Onboarding endpoints for learners. Wraps [OnboardingService]; the learner
 * identity comes from the authenticated principal — a learner can only ever
 * read or modify their own onboarding state.
 */
@RestController
@RequestMapping("/api/onboarding")
class OnboardingController(private val onboardingService: OnboardingService) {

    // Learner records live in a separate table keyed by the auth user's email.
    // get-or-create: self-registered learners have no learners row until their
    // first onboarding call (see OnboardingService.findLearnerByEmail).
    // NOTE: auth.name resolves to User.toString() (Kotlin data class, no
    // getName override), NOT the email — resolve the principal to the User
    // entity and use its email explicitly.
    private fun currentLearner(auth: Authentication): Learner {
        val principal = auth.principal
        val email = (principal as? com.elekeza.backend.auth.User)?.email
            ?: throw ResponseStatusException(HttpStatus.UNAUTHORIZED, "Not authenticated")
        return onboardingService.findLearnerByEmail(email)
    }

    @PostMapping("/profile")
    @PreAuthorize("hasRole('STUDENT')")
    fun saveProfile(@Valid @RequestBody request: ProfileRequest, auth: Authentication): OnboardingResponse =
        onboardingService.saveProfile(currentLearner(auth).id, request)

    @PostMapping("/placement")
    @PreAuthorize("hasRole('STUDENT')")
    fun savePlacement(@RequestBody request: PlacementRequest, auth: Authentication): PlacementResponse =
        onboardingService.savePlacement(currentLearner(auth).id, request)

    @PostMapping("/guardian-link")
    @PreAuthorize("hasRole('STUDENT')")
    fun linkGuardian(@RequestBody request: GuardianLinkRequest, auth: Authentication): GuardianLinkResponse =
        onboardingService.linkGuardian(currentLearner(auth).id, request)

    @GetMapping("/{learnerId}")
    @PreAuthorize("hasRole('STUDENT')")
    fun getOnboarding(@PathVariable learnerId: UUID, auth: Authentication): Map<String, Any> {
        val learner = currentLearner(auth)
        if (learner.id != learnerId) {
            throw ResponseStatusException(HttpStatus.FORBIDDEN, "You can only view your own onboarding")
        }
        return mapOf(
            "learnerId" to learner.id,
            "onboardingComplete" to learner.onboardingComplete,
            "preferredLanguage" to (learner.preferredLanguage ?: ""),
            "ageGroup" to (learner.ageGroup?.name ?: ""),
            "literacyLevel" to (learner.literacyLevel?.name ?: ""),
            "learningGoal" to (learner.learningGoal ?: ""),
            "cognitiveProfiles" to learner.cognitiveProfiles
        )
    }

    @PostMapping("/complete")
    @PreAuthorize("hasRole('STUDENT')")
    fun complete(auth: Authentication): OnboardingResponse =
        onboardingService.completeOnboarding(currentLearner(auth).id)
}
