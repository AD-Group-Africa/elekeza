package com.elekeza.backend.auth

import com.elekeza.backend.auth.dto.LoginRequest
import com.elekeza.backend.auth.dto.RegisterRequest
import jakarta.servlet.http.HttpServletRequest
import jakarta.servlet.http.HttpServletResponse
import org.springframework.beans.factory.annotation.Value
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.http.ResponseCookie
import org.springframework.security.web.csrf.CsrfToken
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.bind.annotation.*
import org.springframework.web.server.ResponseStatusException
import java.security.MessageDigest
import java.time.OffsetDateTime
import com.elekeza.backend.auth.dto.ForgotPasswordRequest

@RestController
@RequestMapping("/api/auth")
class AuthController(
    private val authService: AuthService,
    private val jwtUtil: JwtUtil,
    private val refreshTokenRepository: RefreshTokenRepository,
    private val loginRateLimiter: LoginRateLimiter,
    @Value("\${jwt.refresh-expiration:604800000}") private val refreshExpirationMs: Long,
    @Value("\${app.secure-cookies:false}") private val secureCookies: Boolean
) {

    @PostMapping("/register")
    fun register(@RequestBody req: RegisterRequest, response: HttpServletResponse): ResponseEntity<Map<String, Any>> {
        val user = authService.register(req)
        return issueTokensAndRespond(user, response, HttpStatus.CREATED)
    }

    @PostMapping("/login")
    fun login(
        @RequestBody req: LoginRequest,
        request: HttpServletRequest,
        response: HttpServletResponse
    ): ResponseEntity<Map<String, Any>> {
        // Per-account+IP quota so password spraying cannot exhaust real users'
        // budget and account enumeration stays as hard as guessing. The 429 is
        // returned before any user lookup, so the response never reveals
        // whether the email exists.
        val key = "login:${req.email.lowercase().trim()}:${request.remoteAddr ?: "unknown"}"
        if (!loginRateLimiter.tryAcquire(key)) {
            throw ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "Too many login attempts. Please try again later.")
        }
        val user = authService.login(req)
        return issueTokensAndRespond(user, response, HttpStatus.OK)
    }

    @PostMapping("/refresh")
    fun refresh(request: HttpServletRequest, response: HttpServletResponse): ResponseEntity<Map<String, Any>> {
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
        stored.revoked = true
        refreshTokenRepository.save(stored)
        return issueTokensAndRespond(user, response, HttpStatus.OK)
    }

    @PostMapping("/forgot-password")
    fun forgotPassword(@RequestBody @jakarta.validation.Valid req: ForgotPasswordRequest): ResponseEntity<Map<String, Any>> {
        // Minimal safe endpoint: only confirm whether the email belongs to a
        // registered account, and queue a reset flow. We never reveal existence
        // of an account via the response shape.
        authService.forgotPassword(req.email.trim())
        return ResponseEntity.ok(mapOf("message" to "If that email is registered, a reset link has been sent."))
    }

    @GetMapping("/me")
    fun me(@AuthenticationPrincipal principal: User?): ResponseEntity<Map<String, Any>> {
        val user = principal ?: throw ResponseStatusException(HttpStatus.UNAUTHORIZED, "Not authenticated")
        return ResponseEntity.ok(buildAuthPayload(user))
    }

    @PostMapping("/logout")
    @Transactional
    fun logout(
        request: HttpServletRequest,
        response: HttpServletResponse,
        @AuthenticationPrincipal principal: User?
    ): ResponseEntity<Map<String, String>> {
        resolveRefreshToken(request)?.let { raw ->
            val hash = sha256(raw)
            refreshTokenRepository.findByTokenHash(hash)?.let { stored ->
                stored.revoked = true
                refreshTokenRepository.save(stored)
            }
        }
        principal?.let { refreshTokenRepository.deleteByUser(it) }
        clearRefreshCookie(response)
        return ResponseEntity.ok(mapOf("message" to "Logged out successfully"))
    }

    @GetMapping("/csrf")
    fun csrf(@RequestAttribute("_csrf") csrfToken: CsrfToken): Map<String, String> =
        mapOf("token" to csrfToken.token)

    private fun issueTokensAndRespond(
        user: User,
        response: HttpServletResponse,
        status: HttpStatus
    ): ResponseEntity<Map<String, Any>> {
        val accessToken = jwtUtil.generateAccessToken(user.id.toString(), user.email)
        val refreshToken = java.util.UUID.randomUUID().toString()
        val expiresAt = OffsetDateTime.now().plusSeconds(refreshExpirationMs / 1000)
        val entity = RefreshToken().apply {
            this.user = user
            this.tokenHash = sha256(refreshToken)
            this.expiresAt = expiresAt
        }
        refreshTokenRepository.save(entity)
        setAccessCookie(response, accessToken)
        setRefreshCookie(response, refreshToken)
        return ResponseEntity.status(status).body(buildAuthPayload(user))
    }

    private fun buildAuthPayload(user: User): Map<String, Any> =
        buildMap {
            put("learnerId", user.id)
            put("email", user.email)
            put("name", user.name)
            put("role", user.role.name)
            put("title", user.title)
            put("gender", user.gender ?: "")
            // Institution context the frontend needs for tenant-scoped calls
            // (e.g. CSV student import). Absent for platform-level admins.
            user.institutionId?.let { put("institutionId", it) }
        }

    private fun setAccessCookie(response: HttpServletResponse, token: String) {
        response.addHeader("Set-Cookie", ResponseCookie.from("elekeza_access", token)
            .httpOnly(true).secure(secureCookies).sameSite("Lax").path("/")
            .maxAge(900).build().toString())
    }

    private fun setRefreshCookie(response: HttpServletResponse, token: String) {
        response.addHeader("Set-Cookie", ResponseCookie.from("elekeza_refresh", token)
            .httpOnly(true).secure(secureCookies).sameSite("Strict").path("/api/auth")
            .maxAge(refreshExpirationMs / 1000).build().toString())
    }

    private fun clearRefreshCookie(response: HttpServletResponse) {
        response.addHeader("Set-Cookie", ResponseCookie.from("elekeza_refresh", "")
            .httpOnly(true).secure(secureCookies).sameSite("Strict").path("/api/auth").maxAge(0).build().toString())
        response.addHeader("Set-Cookie", ResponseCookie.from("elekeza_access", "")
            .httpOnly(true).secure(secureCookies).sameSite("Lax").path("/").maxAge(0).build().toString())
    }

    private fun resolveRefreshToken(request: HttpServletRequest): String? {
        request.cookies?.firstOrNull { it.name == "elekeza_refresh" }?.value?.takeIf { it.isNotBlank() }?.let { return it }
        val authHeader = request.getHeader("X-Refresh-Token")
        if (!authHeader.isNullOrBlank()) return authHeader
        return null
    }

    private fun sha256(input: String): String {
        val digest = MessageDigest.getInstance("SHA-256").digest(input.toByteArray())
        return digest.joinToString("") { "%02x".format(it) }
    }
}
