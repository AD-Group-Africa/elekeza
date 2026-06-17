package com.elekeza.backend.auth

import org.springframework.web.bind.annotation.*

@RestController
@RequestMapping("/api/auth")
class AuthController {

    @PostMapping("/register")
    fun register(): Map<String, Any> {
        return mapOf(
            "learnerId" to 1,
            "email" to "student@elekeza.org",
            "name" to "Demo Student",
            "onboardingComplete" to true
        )
    }

    @PostMapping("/login")
    fun login(): Map<String, Any> {
        return mapOf(
            "learnerId" to 1,
            "email" to "student@elekeza.org",
            "name" to "Demo Student",
            "onboardingComplete" to true
        )
    }

    @PostMapping("/logout")
    fun logout(): Map<String, String> {
        return mapOf("message" to "Logged out")
    }
}
