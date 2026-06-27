package com.elekeza.backend.auth

import com.elekeza.backend.auth.dto.RegisterRequest
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.security.crypto.password.PasswordEncoder
import org.springframework.web.bind.annotation.*
import org.springframework.web.server.ResponseStatusException

@RestController
@RequestMapping("/api/auth")
class AuthController(
    private val userRepository: UserRepository,
    private val passwordEncoder: PasswordEncoder
) {
    @PostMapping("/register")
    fun register(@RequestBody req: RegisterRequest): Map<String, Any> {
        if (userRepository.existsByEmail(req.email.lowercase().trim())) {
            throw ResponseStatusException(HttpStatus.CONFLICT, "Email already registered")
        }
        val role = try { UserRole.valueOf(req.role?.uppercase() ?: "STUDENT") } catch (e: Exception) { UserRole.STUDENT }
        val user = User(
            name = req.name?.trim() ?: "Unknown",
            email = req.email.lowercase().trim(),
            password = passwordEncoder.encode(req.password),
            role = role
        )
        userRepository.save(user)
        return mapOf(
            "learnerId" to user.id,
            "email" to user.email,
            "name" to user.name,
            "role" to user.role.name,
            "onboardingComplete" to user.onboardingComplete
        )
    }

    @PostMapping("/login")
    fun login(@RequestBody req: Map<String, String>): Map<String, Any> {
        val email = (req["email"] ?: "").lowercase().trim()
        val password = req["password"] ?: ""
        val user = userRepository.findByEmail(email)
            ?: throw ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid email or password")
        if (!passwordEncoder.matches(password, user.password)) {
            throw ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid email or password")
        }
        return mapOf(
            "learnerId" to user.id,
            "email" to user.email,
            "name" to user.name,
            "role" to user.role.name,
            "onboardingComplete" to user.onboardingComplete
        )
    }

    @PostMapping("/logout")
    fun logout(): Map<String, String> = mapOf("message" to "Logged out")
}
