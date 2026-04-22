package com.elekeza.backend.auth

import jakarta.servlet.http.Cookie
import jakarta.servlet.http.HttpServletRequest
import jakarta.servlet.http.HttpServletResponse
import org.springframework.beans.factory.annotation.Value
import org.springframework.security.core.Authentication
import org.springframework.security.oauth2.core.user.OAuth2User
import org.springframework.security.web.authentication.AuthenticationSuccessHandler
import org.springframework.stereotype.Component

@Component
class OAuth2SuccessHandler(
    private val jwtUtil: JwtUtil,
    private val userRepository: UserRepository,
    @Value("\${app.frontend-url:http://localhost:3000}") private val frontendUrl: String
) : AuthenticationSuccessHandler {

    override fun onAuthenticationSuccess(
        request: HttpServletRequest,
        response: HttpServletResponse,
        authentication: Authentication
    ) {
        val oauthUser = authentication.principal as OAuth2User
        val email = oauthUser.getAttribute<String>("email") ?: run {
            response.sendError(HttpServletResponse.SC_BAD_REQUEST, "Email not provided")
            return
        }
        val user = userRepository.findByEmail(email) ?: run {
            response.sendError(HttpServletResponse.SC_UNAUTHORIZED, "User not registered")
            return
        }
        val token = jwtUtil.generateAccessToken(user.id.toString(), user.email)
        val cookie = Cookie("elekeza_access", token).apply {
            isHttpOnly = true
            secure     = request.isSecure
            path       = "/"
            maxAge     = 86400
        }
        response.addCookie(cookie)
        response.sendRedirect("$frontendUrl/dashboard")
    }
}