package com.elekeza.backend.auth

import com.elekeza.backend.auth.dto.LoginRequest
import com.elekeza.backend.auth.dto.RegisterRequest
import org.slf4j.LoggerFactory
import org.springframework.http.HttpStatus
import org.springframework.security.crypto.password.PasswordEncoder
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.server.ResponseStatusException
import com.elekeza.backend.common.EmailProvider

@Service
@Transactional
class AuthService(
    private val userRepository: UserRepository,
    private val passwordEncoder: PasswordEncoder,
    private val emailProvider: EmailProvider
) {
    private val log = LoggerFactory.getLogger(AuthService::class.java)

    fun register(req: RegisterRequest): User {
        val emailClean = req.email.lowercase().trim()
        if (!EMAIL_PATTERN.matches(emailClean)) {
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, "A valid email address is required")
        }
        val password = req.password
        if (password.length < MIN_PASSWORD_LENGTH) {
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, "Password must be at least $MIN_PASSWORD_LENGTH characters")
        }
        if (!password.any { it.isLetter() } || !password.any { it.isDigit() }) {
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, "Password must contain at least one letter and one number")
        }
        if (req.name.isBlank()) {
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, "Name is required")
        }
        if (!req.termsAccepted) {
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, "Terms must be accepted")
        }
        if (userRepository.existsByEmail(emailClean)) {
            // Generic message — do not reveal account existence beyond the
            // conflict itself, which is inherent to open self-registration.
            throw ResponseStatusException(HttpStatus.CONFLICT, "Email already registered")
        }
        val user = User(
            email = emailClean,
            name = req.name.trim(),
            password = passwordEncoder.encode(password),
            role = UserRole.STUDENT,
            gender = req.gender,
            phone = req.phone
        )
        return userRepository.save(user)
    }

    companion object {
        private val EMAIL_PATTERN = Regex("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$")
        private const val MIN_PASSWORD_LENGTH = 8
    }

    fun forgotPassword(email: String) {
        val emailClean = email.lowercase().trim()
        val frontendUrl =
            (System.getenv("FRONTEND_URL") ?: System.getProperty("frontend.url") ?: "").trim().takeIf { it.isNotBlank() }
        // Anti-enumeration: the response is uniform whether or not the email
        // belongs to a registered account. When the email provider is configured,
        // a reset handle would be dispatched only for registered addresses.
        if (frontendUrl != null) {
            userRepository.findByEmail(emailClean)?.let { user ->
                emailProvider.sendPasswordReset(emailClean, "$frontendUrl/reset-password")
                    ?: throw ResponseStatusException(
                        HttpStatus.INTERNAL_SERVER_ERROR,
                        "Password reset email could not be sent for the given address."
                    )
            }
        }
    }

    fun login(req: LoginRequest): User {
        val emailClean = req.email.lowercase().trim()
        val user = userRepository.findByEmail(emailClean)
            ?: throw ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid email or password")
        if (!passwordEncoder.matches(req.password, user.password)) {
            throw ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid email or password")
        }
        return user
    }
}
