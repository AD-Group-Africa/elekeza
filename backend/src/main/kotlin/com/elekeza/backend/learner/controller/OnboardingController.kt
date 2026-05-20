package com.elekeza.backend.learner.controller

import com.elekeza.backend.auth.UserRepository
import com.elekeza.backend.learner.*
import com.elekeza.backend.learner.dto.*
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.security.core.userdetails.UserDetails
import org.springframework.web.bind.annotation.*
import org.springframework.web.server.ResponseStatusException

/**
 * FIX: The original controller called UUID.fromString(principal.username).
 * principal.username is the user's EMAIL (set by Spring Security UserDetailsService),
 * NOT a UUID. This caused IllegalArgumentException on every onboarding call.
 *
 * We resolve the Long user ID via UserRepository.findByEmail() which is correct.
 */
@RestController
@RequestMapping("/api/onboarding")
class OnboardingController(
    private val onboardingService: OnboardingService,
    private val userRepository: UserRepository
) {
    // Resolve the Long user ID from the JWT principal's email (username field)
    private fun resolveUserId(principal: UserDetails): Long =
        userRepository.findByEmail(principal.username)?.id
            ?: throw ResponseStatusException(HttpStatus.UNAUTHORIZED, "User not found")

    @PostMapping("/profile")
    fun saveProfile(
        @AuthenticationPrincipal principal: UserDetails,
        @RequestBody req: ProfileRequest
    ): ResponseEntity<OnboardingResponse> {
        val userId = resolveUserId(principal)
        return ResponseEntity.ok(onboardingService.saveProfile(userId, req))
    }

    @PostMapping("/placement")
    fun savePlacement(
        @AuthenticationPrincipal principal: UserDetails,
        @RequestBody req: PlacementRequest
    ): ResponseEntity<PlacementResponse> {
        val userId = resolveUserId(principal)
        return ResponseEntity.ok(onboardingService.savePlacement(userId, req))
    }

    @PostMapping("/complete")
    fun complete(
        @AuthenticationPrincipal principal: UserDetails
    ): ResponseEntity<OnboardingResponse> {
        val userId = resolveUserId(principal)
        return ResponseEntity.ok(onboardingService.completeOnboarding(userId))
    }

    @PostMapping("/guardian")
    fun linkGuardian(
        @AuthenticationPrincipal principal: UserDetails,
        @RequestBody req: GuardianLinkRequest
    ): ResponseEntity<GuardianLinkResponse> {
        val userId = resolveUserId(principal)
        return ResponseEntity.ok(onboardingService.linkGuardian(userId, req))
    }
}