package com.elekeza.backend.security

import com.elekeza.backend.model.User           // Verify if 'model' or 'models'
import com.elekeza.backend.repository.UserRepository // FIX: Check if 'repository' or 'repositories'
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
        val email = oauthUser.getAttribute<String>("email") ?: throw IllegalStateException("Email not found from Google")

        // 1. Just-In-Time Registration logic
        val user = userRepository.findByEmail(email) ?: run {
            // FIX: Ensure you pass ALL required parameters for your User constructor here
            val newUser = User(
                email = email,
                name = oauthUser.getAttribute<String>("name") ?: "Google User",
                // role = "USER", // Add other required fields if your User class needs them
                // provider = "GOOGLE"
            )
            userRepository.save(newUser)
        }

        // 2. Generate Token
        val token = jwtUtil.generateAccessToken(user.id.toString(), user.email)

        // 3. Set Cookie and Redirect
        val cookie = Cookie("elekeza_access", token).apply {
            isHttpOnly = true
            secure = true // Crucial for Vercel/Railway HTTPS
            path = "/"
            maxAge = 86400
        }
        response.addCookie(cookie)
        response.sendRedirect("$frontendUrl/dashboard")
    }
}
