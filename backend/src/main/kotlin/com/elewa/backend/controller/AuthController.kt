package com.elewa.backend.controller

import com.elewa.backend.dto.AuthResponse
import com.elewa.backend.dto.LoginRequest
import com.elewa.backend.dto.RegisterRequest
import com.elewa.backend.service.AuthService
import jakarta.servlet.http.HttpServletRequest
import jakarta.servlet.http.HttpServletResponse
import jakarta.validation.Valid
import org.springframework.http.ResponseEntity
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.security.core.userdetails.UserDetails
import org.springframework.web.bind.annotation.*
import java.util.UUID

@RestController
@RequestMapping("/api/auth")
class AuthController(private val authService: AuthService) {

    @PostMapping("/register")
    fun register(@Valid @RequestBody req: RegisterRequest, res: HttpServletResponse): ResponseEntity<AuthResponse> =
        ResponseEntity.ok(authService.register(req, res))

    @PostMapping("/login")
    fun login(@Valid @RequestBody req: LoginRequest, res: HttpServletResponse): ResponseEntity<AuthResponse> =
        ResponseEntity.ok(authService.login(req, res))

    @PostMapping("/refresh")
    fun refresh(req: HttpServletRequest, res: HttpServletResponse): ResponseEntity<AuthResponse> {
        val token = req.cookies?.firstOrNull { it.name == "elewa_refresh" }?.value
        return ResponseEntity.ok(authService.refresh(token, res))
    }

    @PostMapping("/logout")
    fun logout(@AuthenticationPrincipal user: UserDetails, res: HttpServletResponse): ResponseEntity<Void> {
        authService.logout(UUID.fromString(user.username), res)
        return ResponseEntity.noContent().build()
    }
}