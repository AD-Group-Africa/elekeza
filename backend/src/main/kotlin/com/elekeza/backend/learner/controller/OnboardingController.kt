package com.elekeza.backend.learner.controller

import com.elekeza.backend.learner.*
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
    private fun learnerId(principal: UserDetails) = UUID.fromString(principal.username)

    @PostMapping("/profile")
    fun saveProfile(@AuthenticationPrincipal p: UserDetails, @RequestBody req: ProfileRequest): ResponseEntity<OnboardingResponse> =
        ResponseEntity.ok(onboardingService.saveProfile(learnerId(p), req))

    @PostMapping("/placement")
    fun savePlacement(@AuthenticationPrincipal p: UserDetails, @RequestBody req: PlacementRequest): ResponseEntity<PlacementResponse> =
        ResponseEntity.ok(onboardingService.savePlacement(learnerId(p), req))

    @PostMapping("/complete")
    fun complete(@AuthenticationPrincipal p: UserDetails): ResponseEntity<OnboardingResponse> =
        ResponseEntity.ok(onboardingService.completeOnboarding(learnerId(p)))

    @PostMapping("/guardian")
    fun linkGuardian(@AuthenticationPrincipal p: UserDetails, @RequestBody req: GuardianLinkRequest): ResponseEntity<GuardianLinkResponse> =
        ResponseEntity.ok(onboardingService.linkGuardian(learnerId(p), req))
}