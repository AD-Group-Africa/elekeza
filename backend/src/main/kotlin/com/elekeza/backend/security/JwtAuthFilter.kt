package com.elekeza.backend.auth

import jakarta.servlet.FilterChain
import jakarta.servlet.http.HttpServletRequest
import jakarta.servlet.http.HttpServletResponse
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken
import org.springframework.security.core.authority.SimpleGrantedAuthority
import org.springframework.security.core.context.SecurityContextHolder
import org.springframework.stereotype.Component
import org.springframework.web.filter.OncePerRequestFilter

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
        if (token != null && jwtUtil.validateToken(token)) {
            runCatching {
                val email = jwtUtil.getEmail(token)
                val user  = userRepository.findByEmail(email)
                if (user != null) {
                    val auth = UsernamePasswordAuthenticationToken(
                        user, null,
                        listOf(SimpleGrantedAuthority("ROLE_${user.role.name}"))
                    )
                    SecurityContextHolder.getContext().authentication = auth
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