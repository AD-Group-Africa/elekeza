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
import java.security.MessageDigest
import java.security.SecureRandom
import java.time.Duration
import java.time.OffsetDateTime
import java.util.Base64

@Service
@Transactional
class AuthService(
    private val userRepository: UserRepository,
    private val passwordEncoder: PasswordEncoder,
    private val emailProvider: EmailProvider,
    private val passwordResetTokenRepository: PasswordResetTokenRepository,
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

    fun login(req: LoginRequest): User {
        val emailClean = req.email.lowercase().trim()
        val user = userRepository.findByEmail(emailClean)
            ?: throw ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid email or password")
        if (!passwordEncoder.matches(req.password, user.password)) {
            throw ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid email or password")
        }
        if (!user.active) {
            // Deactivated by the school. Deliberately the SAME message as a
            // wrong password so account status is not revealed to strangers.
            throw ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid email or password")
        }
        return user
    }

    /**
     * Complete forgot-password flow: for a registered email, invalidate any
     * outstanding tokens, issue a fresh single-use token (only its SHA-256
     * hash is stored), and email the raw token as the reset handle. The
     * calling endpoint's response is uniform in every case — no enumeration.
     */
    fun forgotPassword(email: String) {
        val emailClean = email.lowercase().trim()
        val frontendUrl =
            (System.getenv("FRONTEND_URL") ?: System.getProperty("frontend.url")
                ?: "http://localhost:3000").trim().trimEnd('/')
        val user = userRepository.findByEmail(emailClean) ?: return  // uniform behaviour

        // One live token per user: issuing a new one invalidates the old.
        passwordResetTokenRepository.deleteByUserId(user.id)
        val rawToken = Base64.getUrlEncoder().withoutPadding()
            .encodeToString(ByteArray(32).also { SecureRandom().nextBytes(it) })
        passwordResetTokenRepository.save(
            PasswordResetToken(
                userId = user.id,
                tokenHash = sha256(rawToken),
                expiresAt = OffsetDateTime.now().plus(RESET_TOKEN_TTL),
            )
        )

        val sent = emailProvider.sendPasswordReset(emailClean, "$frontendUrl/reset-password?token=$rawToken")
        if (!sent) {
            throw ResponseStatusException(
                HttpStatus.INTERNAL_SERVER_ERROR,
                "Password reset email could not be sent for the given address."
            )
        }
    }

    /**
     * Complete reset flow: validate single-use + expiry, replace the password,
     * mark the token consumed, and invalidate every outstanding token for the
     * user. (Refresh-token revocation happens in the controller.)
     */
    fun resetPassword(token: String, newPassword: String) {
        if (newPassword.length < MIN_PASSWORD_LENGTH) {
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, "Password must be at least $MIN_PASSWORD_LENGTH characters")
        }
        if (!newPassword.any { it.isLetter() } || !newPassword.any { it.isDigit() }) {
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, "Password must contain at least one letter and one number")
        }
        val failure = ResponseStatusException(
            HttpStatus.BAD_REQUEST,
            "This password reset link is invalid or has expired. Please request a new one."
        )
        val stored = passwordResetTokenRepository.findByTokenHash(sha256(token.trim())) ?: throw failure
        if (stored.usedAt != null || stored.expiresAt.isBefore(OffsetDateTime.now())) throw failure
        val user = userRepository.findById(stored.userId).orElse(null) ?: throw failure

        val consumed = PasswordResetToken(
            id = stored.id,
            userId = stored.userId,
            tokenHash = stored.tokenHash,
            expiresAt = stored.expiresAt,
            usedAt = OffsetDateTime.now(),
        )
        passwordResetTokenRepository.save(consumed)
        user.password = passwordEncoder.encode(newPassword)
        userRepository.save(user)
        // Invalidate any other outstanding reset tokens for this user.
        passwordResetTokenRepository.deleteByUserId(user.id)
        log.info("Password reset completed for user {}", user.id)
    }

    private fun sha256(input: String): String {
        val digest = MessageDigest.getInstance("SHA-256").digest(input.toByteArray())
        return digest.joinToString("") { "%02x".format(it) }
    }

    companion object {
        private val EMAIL_PATTERN = Regex("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$")
        private const val MIN_PASSWORD_LENGTH = 8
        private val RESET_TOKEN_TTL: Duration = Duration.ofHours(1)
    }
}
