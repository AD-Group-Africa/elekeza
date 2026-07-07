package com.elekeza.backend.auth

import com.elekeza.backend.auth.dto.LoginRequest
import com.elekeza.backend.auth.dto.RegisterRequest
import com.elekeza.backend.auth.dto.UserDto
import jakarta.servlet.http.Cookie
import jakarta.servlet.http.HttpServletRequest
import jakarta.servlet.http.HttpServletResponse
import org.springframework.beans.factory.annotation.Value
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.web.bind.annotation.*
import org.springframework.web.server.ResponseStatusException
import java.security.MessageDigest
import java.time.OffsetDateTime

@RestController
@RequestMapping("/api/auth")
class AuthController(
    private val authService: AuthService,
    private val jwtUtil: JwtUtil,
    private val refreshTokenRepository: RefreshTokenRepository,
    @Value("\${jwt.refresh-expiration:604800000}") private val refreshExpirationMs: Long,
    @Value("\${app.secure-cookies:false}") private val secureCookies: Boolean
) {

    // â”€â”€ Register â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    @PostMapping("/register")
    fun register(
        @RequestBody req: RegisterRequest,
        response: HttpServletResponse
    ): ResponseEntity<Map<String, Any>> {
        val user = authService.register(req)
        return issueTokensAndRespond(user, response, HttpStatus.CREATED)
    }

    // â”€â”€ Login â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    @PostMapping("/login")
    fun login(
        @RequestBody req: LoginRequest,
        response: HttpServletResponse
    ): ResponseEntity<Map<String, Any>> {
        val user = authService.login(req)
        return issueTokensAndRespond(user, response, HttpStatus.OK)
    }

    // â”€â”€ Refresh â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // Reads refresh token from HttpOnly cookie OR Authorization header.
    // Issues a new access token (and rotates the refresh token).

    @PostMapping("/refresh")
    fun refresh(
        request: HttpServletRequest,
        response: HttpServletResponse
    ): ResponseEntity<Map<String, Any>> {
        val rawToken = resolveRefreshToken(request)
            ?: throw ResponseStatusException(HttpStatus.UNAUTHORIZED, "No refresh token provided")

        val hash = sha256(rawToken)
        val stored = refreshTokenRepository.findByTokenHash(hash)
            ?: throw ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid or expired refresh token")

        if (stored.revoked || stored.expiresAt.isBefore(OffsetDateTime.now())) {
            stored.revoked = true
            refreshTokenRepository.save(stored)
            clearRefreshCookie(response)
            throw ResponseStatusException(HttpStatus.UNAUTHORIZED, "Refresh token expired or revoked")
        }

        val user = stored.user

        // Rotate: revoke old, issue new
        stored.revoked = true
        refreshTokenRepository.save(stored)

        return issueTokensAndRespond(user, response, HttpStatus.OK)
    }

    // â”€â”€ Me â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    @GetMapping("/me")
    fun me(@AuthenticationPrincipal principal: User?): ResponseEntity<Map<String, Any>> {
        val user = principal
            ?: throw ResponseStatusException(HttpStatus.UNAUTHORIZED, "Not authenticated")
        return ResponseEntity.ok(buildAuthPayload(user))
    }

    // â”€â”€ Logout â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    @PostMapping("/logout")
    fun logout(
        request: HttpServletRequest,
        response: HttpServletResponse,
        @AuthenticationPrincipal principal: User?
    ): ResponseEntity<Map<String, String>> {
        // Revoke server-side refresh token if present
        resolveRefreshToken(request)?.let { raw ->
            val hash = sha256(raw)
            refreshTokenRepository.findByTokenHash(hash)?.let { stored ->
                stored.revoked = true
                refreshTokenRepository.save(stored)
            }
        }
        // Also revoke all tokens for the user if authenticated
        principal?.let { refreshTokenRepository.deleteByUser(it) }

        clearRefreshCookie(response)
        return ResponseEntity.ok(mapOf("message" to "Logged out successfully"))
    }

    // â”€â”€ Shared helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    private fun issueTokensAndRespond(
        user: User,
        response: HttpServletResponse,
        status: HttpStatus
    ): ResponseEntity<Map<String, Any>> {
        val accessToken  = jwtUtil.generateAccessToken(user.id.toString(), user.email)
        val refreshToken = jwtUtil.generateRefreshToken(user.id.toString())

        // Persist hashed refresh token
        val expiresAt = OffsetDateTime.now().plusSeconds(refreshExpirationMs / 1000)
        val entity = RefreshToken().apply {
            this.user      = user
            this.tokenHash = sha256(refreshToken)
            this.expiresAt = expiresAt
        }
        refreshTokenRepository.save(entity)

        // Set HttpOnly cookie for refresh token
        setRefreshCookie(response, refreshToken)

        return ResponseEntity.status(status).body(buildAuthPayload(user, accessToken))
    }

    private fun buildAuthPayload(user: User, accessToken: String? = null): Map<String, Any> =
        buildMap {
            put("learnerId",         user.id)
            put("email",             user.email)
            put("name",              user.name)
            put("role",              user.role.name)
            accessToken?.let { put("accessToken", it) }
        }

    private fun setRefreshCookie(response: HttpServletResponse, token: String) {
        val cookie = Cookie("elekeza_refresh", token).apply {
            isHttpOnly = true
            secure     = secureCookies
            path       = "/api/auth"
            maxAge     = (refreshExpirationMs / 1000).toInt()
            // SameSite=Strict â€” mitigates CSRF
        }
        response.addCookie(cookie)
        // Also set header for clients that need it explicitly
        response.addHeader("Set-Cookie",
            "elekeza_refresh=$token; Path=/api/auth; HttpOnly; SameSite=Strict; Max-Age=${refreshExpirationMs / 1000}${if (secureCookies) "; Secure" else ""}")
    }

    private fun clearRefreshCookie(response: HttpServletResponse) {
        val cookie = Cookie("elekeza_refresh", "").apply {
            isHttpOnly = true
            secure     = secureCookies
            path       = "/api/auth"
            maxAge     = 0
        }
        response.addCookie(cookie)
    }

    private fun resolveRefreshToken(request: HttpServletRequest): String? {
        // 1. HttpOnly cookie (preferred)
        request.cookies?.firstOrNull { it.name == "elekeza_refresh" }?.value
            ?.takeIf { it.isNotBlank() }?.let { return it }
        // 2. Request body / header fallback for API clients
        val authHeader = request.getHeader("X-Refresh-Token")
        if (!authHeader.isNullOrBlank()) return authHeader
        return null
    }

    private fun sha256(input: String): String {
        val digest = MessageDigest.getInstance("SHA-256").digest(input.toByteArray())
        return digest.joinToString("") { "%02x".format(it) }
    }
}

