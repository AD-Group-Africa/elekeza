package com.elekeza.backend.security

import com.elekeza.backend.auth.User
import com.elekeza.backend.auth.UserRepository
import com.elekeza.backend.auth.JwtUtil
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
    @Value("\${app.frontend-url}") private val frontendUrl: String
) : AuthenticationSuccessHandler {

    override fun onAuthenticationSuccess(
        request: HttpServletRequest,
        response: HttpServletResponse,
        authentication: Authentication
    ) {
        val oauthUser = authentication.principal as OAuth2User
        val email = oauthUser.getAttribute<String>("email") ?: throw IllegalStateException("Email not found")

        val user = userRepository.findByEmail(email) ?: run {
            // CORRECTED: Matches your User.kt constructor (name, email, password)
            val newUser = User(
                name = oauthUser.getAttribute<String>("name") ?: "Google User",
                email = email,
                password = "" // OAuth users don't have a local password
            ).apply {
                onboardingComplete = false
            }
            userRepository.save(newUser)
        }

        val token = jwtUtil.generateAccessToken(user.id.toString(), user.email)

        val cookie = Cookie("elekeza_access", token).apply {
            isHttpOnly = true
            secure = true 
            path = "/"
            maxAge = 86400
        }
        response.addCookie(cookie)
        response.sendRedirect("$frontendUrl/dashboard")
    }
}
