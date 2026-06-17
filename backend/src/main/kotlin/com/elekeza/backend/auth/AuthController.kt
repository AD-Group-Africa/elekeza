package com.elekeza.backend.auth

import jakarta.servlet.http.Cookie
import jakarta.servlet.http.HttpServletResponse
import jakarta.validation.Valid
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.*
import com.elekeza.backend.auth.dto.*

@RestController
@RequestMapping("/api/auth")
class AuthController(
    private val authService: AuthService,
    private val jwtUtil: com.elekeza.backend.shared.security.JwtUtil
) {
    @PostMapping("/register")
    fun register(@Valid @RequestBody req: RegisterRequest, res: HttpServletResponse): ResponseEntity<AuthResponse> {
        val user = authService.register(req)
        val accessToken = jwtUtil.generateAccessToken(user.id.toString(), user.email)
        val refreshToken = jwtUtil.generateRefreshToken(user.id.toString())
        setAuthCookies(res, accessToken, refreshToken)
        return ResponseEntity.status(201).body(user.toDto().toAuthResponse())
    }

    @PostMapping("/login")
    fun login(@Valid @RequestBody req: LoginRequest, res: HttpServletResponse): ResponseEntity<AuthResponse> {
        val user = authService.login(req)
        val accessToken = jwtUtil.generateAccessToken(user.id.toString(), user.email)
        val refreshToken = jwtUtil.generateRefreshToken(user.id.toString())
        setAuthCookies(res, accessToken, refreshToken)
        return ResponseEntity.ok(user.toDto().toAuthResponse())
    }

    @PostMapping("/logout")
    fun logout(res: HttpServletResponse): ResponseEntity<Map<String,String>> {
        clearAuthCookies(res)
        return ResponseEntity.ok(mapOf("message" to "Logged out"))
    }

    private fun setAuthCookies(res: HttpServletResponse, access: String, refresh: String) {
        res.addCookie(buildCookie("elekeza_access", access, 900))
        res.addCookie(buildCookie("elekeza_refresh", refresh, 604800))
    }

    private fun clearAuthCookies(res: HttpServletResponse) {
        res.addCookie(buildCookie("elekeza_access", "", 0))
        res.addCookie(buildCookie("elekeza_refresh", "", 0))
    }

    private fun buildCookie(name: String, value: String, maxAge: Int): Cookie {
        val isProduction = System.getenv("SPRING_PROFILES_ACTIVE")?.contains("prod") == true
        return Cookie(name, value).apply {
            isHttpOnly = true
            secure = isProduction
            path = "/"
            this.maxAge = maxAge
        }
    }
}
