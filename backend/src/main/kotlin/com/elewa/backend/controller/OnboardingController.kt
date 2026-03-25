package com.elewa.backend.controller

import com.elewa.backend.dto.*
import com.elewa.backend.service.OnboardingService
import org.springframework.http.ResponseEntity
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.security.core.userdetails.UserDetails
import org.springframework.web.bind.annotation.*
import java.util.UUID

@RestController
@RequestMapping("/api/onboarding")
class OnboardingController(
    private val onboardingService: OnboardingService
) {

    @PostMapping("/profile")
    fun saveProfile(
        @AuthenticationPrincipal principal: UserDetails,
        @RequestBody request: ProfileRequest
    ): ResponseEntity<OnboardingResponse> {
        val learnerId = UUID.fromString(principal.username)
        return ResponseEntity.ok(onboardingService.saveProfile(learnerId, request))
    }

    @PostMapping("/placement")
    fun savePlacement(
        @AuthenticationPrincipal principal: UserDetails,
        @RequestBody request: PlacementRequest
    ): ResponseEntity<PlacementResponse> {
        val learnerId = UUID.fromString(principal.username)
        return ResponseEntity.ok(onboardingService.savePlacement(learnerId, request))
    }

    @PostMapping("/complete")
    fun completeOnboarding(
        @AuthenticationPrincipal principal: UserDetails
    ): ResponseEntity<OnboardingResponse> {
        val learnerId = UUID.fromString(principal.username)
        return ResponseEntity.ok(onboardingService.completeOnboarding(learnerId))
    }

    @PostMapping("/guardian-link")
    fun linkGuardian(
        @AuthenticationPrincipal principal: UserDetails,
        @RequestBody request: GuardianLinkRequest
    ): ResponseEntity<GuardianLinkResponse> {
        val learnerId = UUID.fromString(principal.username)
        return ResponseEntity.ok(onboardingService.linkGuardian(learnerId, request))
    }
}