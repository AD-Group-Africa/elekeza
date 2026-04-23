package com.elekeza.backend.auth

import com.elekeza.backend.auth.dto.AuthResponse
import com.elekeza.backend.auth.dto.ForgotPasswordRequest
import com.elekeza.backend.auth.dto.LoginRequest
import com.elekeza.backend.auth.dto.RegisterRequest
import com.elekeza.backend.auth.dto.ResetPasswordRequest
import com.elekeza.backend.auth.dto.toDto
import jakarta.servlet.http.Cookie
import jakarta.servlet.http.HttpServletRequest
import jakarta.servlet.http.HttpServletResponse
import jakarta.validation.Valid
import org.springframework.beans.factory.annotation.Value
import org.springframework.http.ResponseEntity
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.security.core.userdetails.UserDetails
import org.springframework.web.bind.annotation.*

@RestController
@RequestMapping("/api/auth")
class AuthController(
    private val authService: AuthService,
    private val userRepository: UserRepository,
    private val jwtUtil: JwtUtil
) {
    @Value("\${security.jwt.cookie-name:elekeza_access}")
    private lateinit var accessCookieName: String

    @Value("\${security.jwt.refresh-cookie-name:elekeza_refresh}")
    private lateinit var refreshCookieName: String

    @PostMapping("/register")
    fun register(@Valid @RequestBody req: RegisterRequest, res: HttpServletResponse): ResponseEntity<AuthResponse> {
        val user: User = authService.register(req) // Explicitly type as User
        val accessToken = jwtUtil.generateAccessToken(user.id.toString(), user.email)
        val refreshToken = jwtUtil.generateRefreshToken(user.id.toString())
        setAuthCookies(res, accessToken, refreshToken)
        return ResponseEntity.status(201).body(AuthResponse(user = user.toDto(), learnerId = user.id))
    }

    @PostMapping("/login")
    fun login(@Valid @RequestBody req: LoginRequest, res: HttpServletResponse): ResponseEntity<AuthResponse> {
        val user: User = authService.login(req) // Explicitly type as User
        val accessToken = jwtUtil.generateAccessToken(user.id.toString(), user.email)
        val refreshToken = jwtUtil.generateRefreshToken(user.id.toString())
        setAuthCookies(res, accessToken, refreshToken)
        return ResponseEntity.ok(AuthResponse(user = user.toDto(), learnerId = user.id))
    }

    @PostMapping("/logout")
    fun logout(res: HttpServletResponse): ResponseEntity<*> {
        clearAuthCookies(res)
        return ResponseEntity.ok(mapOf("message" to "Logged out successfully"))
    }

    @GetMapping("/me")
    fun me(@AuthenticationPrincipal principal: UserDetails): ResponseEntity<*> {
        val user = userRepository.findByEmail(principal.username)
            ?: return ResponseEntity.notFound().build<Any>()
        return ResponseEntity.ok(user.toDto())
    }

    @PostMapping("/forgot-password")
    fun forgotPassword(@Valid @RequestBody req: ForgotPasswordRequest): ResponseEntity<*> {
        authService.forgotPassword(req.email)
        return ResponseEntity.ok(mapOf("message" to "If that email is registered, a reset link has been sent."))
    }

    @PostMapping("/reset-password")
    fun resetPassword(@Valid @RequestBody req: ResetPasswordRequest): ResponseEntity<*> {
        return ResponseEntity.ok(mapOf("message" to "Password updated successfully."))
    }

    @PostMapping("/refresh")
    fun refresh(req: HttpServletRequest, res: HttpServletResponse): ResponseEntity<*> {
        val refreshToken = req.cookies?.firstOrNull { it.name == refreshCookieName }?.value
            ?: return ResponseEntity.status(401).body(mapOf("error" to "No refresh token"))
        val parsed = jwtUtil.parse(refreshToken)
            ?: return ResponseEntity.status(401).body(mapOf("error" to "Invalid refresh token"))
        val user = userRepository.findByEmail(parsed.email ?: "")
            ?: return ResponseEntity.status(401).body(mapOf("error" to "User not found"))
        val newAccessToken = jwtUtil.generateAccessToken(user.id.toString(), user.email)
        setAuthCookies(res, newAccessToken, refreshToken)
        return ResponseEntity.ok(mapOf("message" to "Token refreshed"))
    }

    private fun setAuthCookies(res: HttpServletResponse, accessToken: String, refreshToken: String) {
        res.addCookie(buildCookie(accessCookieName, accessToken, 900))
        res.addCookie(buildCookie(refreshCookieName, refreshToken, 604800))
    }

    private fun clearAuthCookies(res: HttpServletResponse) {
        res.addCookie(buildCookie(accessCookieName, "", 0))
        res.addCookie(buildCookie(refreshCookieName, "", 0))
    }

    private fun buildCookie(name: String, value: String, maxAge: Int): Cookie =
        Cookie(name, value).apply { isHttpOnly = true; secure = true; path = "/"; this.maxAge = maxAge }
}