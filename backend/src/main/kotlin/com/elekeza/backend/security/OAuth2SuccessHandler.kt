package com.elekeza.backend.auth

import com.elekeza.backend.models.User  // Ensure correct path to your User entity
import com.elekeza.backend.repositories.UserRepository // Ensure correct path
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

        // FIX: Find the user, or create a new one if they don't exist
        val user = userRepository.findByEmail(email) ?: run {
            val newUser = User().apply {
                this.email = email
                this.fullName = oauthUser.getAttribute<String>("name") ?: "New User"
                // If you have a 'provider' or 'authProvider' field, set it here
                // this.provider = "GOOGLE" 
                this.enabled = true
            }
            userRepository.save(newUser)
        }

        val token = jwtUtil.generateAccessToken(user.id.toString(), user.email)
        
        val cookie = Cookie("elekeza_access", token).apply {
            isHttpOnly = true
            // If on Railway/Vercel, we need Secure=true. request.isSecure works 
            // if SERVER_FORWARD_HEADERS_STRATEGY=native is set in Railway.
            secure = true 
            path = "/"
            maxAge = 86400
            // For cross-site frontend/backend (Vercel/Railway), SameSite=None is often required
            // response.setHeader("Set-Cookie", "elekeza_access=$token; Max-Age=86400; Path=/; HttpOnly; Secure; SameSite=None")
        }
        
        response.addCookie(cookie)
        response.sendRedirect("$frontendUrl/dashboard")
    }
}
