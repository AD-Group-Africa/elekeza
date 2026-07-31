package com.elekeza.backend.auth

import jakarta.servlet.FilterChain
import jakarta.servlet.http.HttpServletRequest
import jakarta.servlet.http.HttpServletResponse
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken
import org.springframework.security.core.authority.SimpleGrantedAuthority
import org.springframework.security.core.context.SecurityContextHolder
import org.springframework.stereotype.Component
import org.springframework.web.filter.OncePerRequestFilter

/**
 * JWT authentication filter.
 *
 * PLACEMENT: This file lives at src/main/kotlin/com/elekeza/backend/security/JwtAuthFilter.kt
 * but its package declaration MUST be com.elekeza.backend.auth to match the import in
 * SecurityConfig. The physical path and the package declaration were mismatched in v6 —
 * this file corrects the package so the project compiles.
 *
 * Copy this file to: backend/src/main/kotlin/com/elekeza/backend/security/JwtAuthFilter.kt
 * (replacing the existing file that declared the wrong package)
 */
@Component
class JwtAuthFilter(
    private val jwtUtil: JwtUtil,
    private val userRepository: UserRepository
) : OncePerRequestFilter() {

    override fun doFilterInternal(
        request: HttpServletRequest,
        response: HttpServletResponse,
        chain: FilterChain
    ) {
        val token = resolveToken(request)
        if (token != null) {
            val valid = jwtUtil.validateToken(token)
            println("JWT VALIDATION: token=$token, valid=$valid")
            if (valid) {
                runCatching {
                    val email = jwtUtil.getEmail(token)
                    val user  = userRepository.findByEmail(email)
                    println("JWT AUTHENTICATING: email=$email, userFound=${user != null}")
                    if (user != null) {
                        val auth = UsernamePasswordAuthenticationToken(
                            user, null,
                            listOf(SimpleGrantedAuthority("ROLE_${user.role.name}"))
                        )
                        SecurityContextHolder.getContext().authentication = auth
                    }
                }.onFailure { e ->
                    println("JWT AUTHENTICATION ERROR: ${e.message}")
                    e.printStackTrace()
                }
            }
        }
        chain.doFilter(request, response)
    }

    private fun resolveToken(request: HttpServletRequest): String? {
        val bearer = request.getHeader("Authorization")
        if (!bearer.isNullOrBlank() && bearer.startsWith("Bearer ")) {
            return bearer.substring(7)
        }
        return request.cookies?.firstOrNull { it.name == "elekeza_access" }?.value
    }
}
