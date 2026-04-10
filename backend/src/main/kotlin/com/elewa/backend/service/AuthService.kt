package com.elewa.backend.service

import com.elewa.backend.dto.AuthResponse
import com.elewa.backend.dto.LoginRequest
import com.elewa.backend.dto.RegisterRequest
import com.elewa.backend.model.Learner
import com.elewa.backend.model.RefreshToken
import com.elewa.backend.repository.LearnerRepository
import com.elewa.backend.repository.RefreshTokenRepository
import com.elewa.backend.security.JwtUtil
import com.elewa.backend.security.TokenType
import jakarta.servlet.http.Cookie
import jakarta.servlet.http.HttpServletResponse
import org.slf4j.LoggerFactory
import org.springframework.beans.factory.annotation.Value
import org.springframework.core.env.Environment
import org.springframework.security.authentication.AuthenticationManager
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken
import org.springframework.security.crypto.password.PasswordEncoder
import org.springframework.stereotype.Service
import jakarta.persistence.EntityManager
import org.springframework.transaction.annotation.Transactional
import java.security.MessageDigest
import java.time.OffsetDateTime
import java.util.Base64
import java.util.UUID

@Service
class AuthService(
    private val entityManager: EntityManager,
    private val learnerRepository: LearnerRepository,
    private val refreshTokenRepository: RefreshTokenRepository,
    private val passwordEncoder: PasswordEncoder,
    private val authenticationManager: AuthenticationManager,
    private val jwtUtil: JwtUtil,
    private val environment: Environment,
    @Value("\${security.jwt.cookie-name}")             private val accessCookieName: String,
    @Value("\${security.jwt.refresh-cookie-name}")     private val refreshCookieName: String,
    @Value("\${security.jwt.access-token-expiry-ms}")  private val accessExpiryMs: Long,
    @Value("\${security.jwt.refresh-token-expiry-ms}") private val refreshExpiryMs: Long
) {
    private val log = LoggerFactory.getLogger(AuthService::class.java)

    // Secure cookies only in Docker/prod — plain HTTP on local dev
    private val isSecure: Boolean
        get() = environment.activeProfiles.contains("docker")

    @Transactional
    fun register(request: RegisterRequest, response: HttpServletResponse): AuthResponse {
        if (learnerRepository.existsByEmail(request.email))
            throw IllegalArgumentException("Email already registered")
        val saved = learnerRepository.save(Learner().apply {
            email        = request.email
            passwordHash = passwordEncoder.encode(request.password)
            fullName     = request.fullName ?: ""
            cognitiveProfiles = request.cognitiveProfiles.map { it.trim().lowercase() }
                .filter { it.isNotBlank() }
                .distinct()
                .toList()
        })
        issueTokenCookies(saved, response)
        log.info("Registered: ${saved.id}")
        return saved.toAuthResponse("Registration successful")
    }

    @Transactional
    fun login(request: LoginRequest, response: HttpServletResponse): AuthResponse {
        authenticationManager.authenticate(
            UsernamePasswordAuthenticationToken(request.email, request.password)
        )
        val learner = learnerRepository.findByEmail(request.email)
            .orElseThrow { IllegalStateException("Learner missing after auth") }
        issueTokenCookies(learner, response)
        log.info("Login: ${learner.id}")
        return learner.toAuthResponse("Login successful")
    }

    @Transactional
    fun refresh(refreshTokenValue: String?, response: HttpServletResponse): AuthResponse {
        val parsed = refreshTokenValue?.let { jwtUtil.parse(it) }
            ?: throw IllegalArgumentException("Missing or invalid refresh token")
        if (parsed.type != TokenType.REFRESH)
            throw IllegalArgumentException("Token is not a refresh token")
        val stored = refreshTokenRepository.findByTokenHash(hashToken(refreshTokenValue))
            ?: throw IllegalArgumentException("Refresh token not recognised")
        if (stored.revoked || stored.expiresAt.isBefore(OffsetDateTime.now()))
            throw IllegalArgumentException("Refresh token expired or revoked")
        stored.revoked = true
        refreshTokenRepository.save(stored)
        issueTokenCookies(stored.learner, response)
        return stored.learner.toAuthResponse("Token refreshed")
    }

    @Transactional
    fun logout(learnerId: UUID, response: HttpServletResponse) {
        refreshTokenRepository.revokeAllByLearnerId(learnerId)
        clearCookies(response)
        log.info("Logout: $learnerId")
    }

    private fun issueTokenCookies(learner: Learner, response: HttpServletResponse) {
        refreshTokenRepository.deleteAllByLearnerId(learner.id)
        entityManager.flush()
        val accessToken  = jwtUtil.generateAccessToken(learner.id, learner.email)
        val refreshToken = jwtUtil.generateRefreshToken(learner.id)
        refreshTokenRepository.save(RefreshToken().apply {
            this.learner   = learner
            this.tokenHash = hashToken(refreshToken)
            this.expiresAt = OffsetDateTime.now().plusSeconds(refreshExpiryMs / 1000)
        })
        response.addCookie(cookie(accessCookieName,  accessToken,  (accessExpiryMs  / 1000).toInt()))
        response.addCookie(cookie(refreshCookieName, refreshToken, (refreshExpiryMs / 1000).toInt()))
    }

    private fun cookie(name: String, value: String, maxAge: Int) =
        Cookie(name, value).apply {
            isHttpOnly  = true
            secure      = isSecure
            path        = "/"
            this.maxAge = maxAge
        }

    private fun clearCookies(response: HttpServletResponse) =
        listOf(accessCookieName, refreshCookieName).forEach { name ->
            response.addCookie(Cookie(name, "").apply {
                isHttpOnly = true
                secure     = isSecure
                path       = "/"
                maxAge     = 0
            })
        }

    // New instance per call — MessageDigest is NOT thread-safe
    private fun hashToken(token: String): String {
        val bytes = MessageDigest.getInstance("SHA-256").digest(token.toByteArray(Charsets.UTF_8))
        return Base64.getEncoder().encodeToString(bytes)
    }

    private fun Learner.toAuthResponse(message: String) = AuthResponse(
        learnerId          = id,
        email              = email,
        fullName           = fullName,
        cognitiveProfiles  = cognitiveProfiles.toList(),
        onboardingComplete = onboardingComplete,
        message            = message
    )
}



