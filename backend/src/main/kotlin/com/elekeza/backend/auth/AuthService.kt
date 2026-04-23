package com.elekeza.backend.auth

import com.elekeza.backend.auth.dto.LoginRequest
import com.elekeza.backend.auth.dto.RegisterRequest
import com.elekeza.backend.auth.JwtUtil
import com.elekeza.backend.auth.UserRole
import org.slf4j.LoggerFactory
import org.springframework.http.HttpStatus
import org.springframework.mail.SimpleMailMessage
import org.springframework.mail.javamail.JavaMailSender
import org.springframework.security.authentication.AuthenticationManager
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken
import org.springframework.security.crypto.password.PasswordEncoder
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.server.ResponseStatusException
import java.security.SecureRandom
import java.util.Base64

@Service
@Transactional
class AuthService(
    private val userRepository: UserRepository,
    private val jwtUtil: JwtUtil,
    private val passwordEncoder: PasswordEncoder,
    private val authenticationManager: AuthenticationManager,
    private val mailSender: JavaMailSender
) {
    private val log = LoggerFactory.getLogger(AuthService::class.java)

    fun register(req: RegisterRequest): User {
        val emailClean = req.email.lowercase().trim()

        if (userRepository.existsByEmail(emailClean)) {
            throw ResponseStatusException(HttpStatus.CONFLICT, "Email already registered")
        }

        // Use the standard User entity constructor
        val user = User(
            name = req.name.trim(),
            email = emailClean,
            password = passwordEncoder.encode(req.password),
            // Convert the string to the Enum type safely
            role = try {
                // Use .toString() to ensure we have a String object for uppercase()
                val roleStr = req.role?.toString()?.uppercase() ?: "STUDENT"
                UserRole.valueOf(roleStr)
            } catch (e: Exception) {
                UserRole.STUDENT // Fallback to STUDENT since LEARNER doesn't exist
            }
        )

        return userRepository.save(user)
    }

    fun login(req: LoginRequest): User {
        val emailClean = req.email.lowercase().trim()

        // 1. Verify credentials via Spring Security
        try {
            authenticationManager.authenticate(
                UsernamePasswordAuthenticationToken(emailClean, req.password)
            )
        } catch (e: Exception) {
            throw ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid email or password")
        }

        // 2. Retrieve and return the User entity
        // The Controller will use this to generate tokens and the AuthResponse
        return userRepository.findByEmail(emailClean)
            ?: throw ResponseStatusException(HttpStatus.UNAUTHORIZED, "User not found")
    }

    fun forgotPassword(email: String) {
        val user = userRepository.findByEmail(email.lowercase().trim()) ?: run {
            log.info("Password reset requested for unknown email (suppressed)")
            return
        }
        val raw = generateSecureToken()
        sendResetEmail(user.email, raw)
        log.info("Password reset token issued for userId={}", user.id)
    }

    private fun generateSecureToken(): String {
        val bytes = ByteArray(32)
        SecureRandom().nextBytes(bytes)
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes)
    }

    private fun sendResetEmail(toEmail: String, rawToken: String) {
        runCatching {
            val msg = SimpleMailMessage().apply {
                setTo(toEmail)
                setFrom("noreply@elekeza.app")
                subject = "Elekeza - Reset your password"
                text    = "Reset link (expires 1hr):\n\nhttps://elekeza.app/auth/reset-password?token=$rawToken"
            }
            mailSender.send(msg)
        }.onFailure { log.error("Failed to send password reset email", it) }
    }
}