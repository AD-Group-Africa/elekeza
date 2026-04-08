package com.elewa.backend.security

import com.elewa.backend.service.LearnerDetailsService
import jakarta.servlet.FilterChain
import jakarta.servlet.http.HttpServletRequest
import jakarta.servlet.http.HttpServletResponse
import org.slf4j.LoggerFactory
import org.springframework.beans.factory.annotation.Value
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken
import org.springframework.security.core.context.SecurityContextHolder
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource
import org.springframework.stereotype.Component
import org.springframework.web.filter.OncePerRequestFilter

@Component
class JwtAuthFilter(
    private val jwtUtil: JwtUtil,
    private val learnerDetailsService: LearnerDetailsService,
    @Value("\${security.jwt.cookie-name}") private val cookieName: String
) : OncePerRequestFilter() {

    private val log = LoggerFactory.getLogger(JwtAuthFilter::class.java)

    override fun doFilterInternal(
        request: HttpServletRequest,
        response: HttpServletResponse,
        filterChain: FilterChain
    ) {
        val token = request.cookies?.firstOrNull { it.name == cookieName }?.value
        if (token != null) {
            val parsed = jwtUtil.parse(token)
            if (parsed != null && parsed.type == TokenType.ACCESS) {
                try {
                    val userDetails = learnerDetailsService.loadUserByUsername(parsed.learnerId.toString())
                    val auth = UsernamePasswordAuthenticationToken(
                        userDetails, null, userDetails.authorities
                    ).also { it.details = WebAuthenticationDetailsSource().buildDetails(request) }
                    SecurityContextHolder.getContext().authentication = auth
                } catch (e: Exception) {
                    log.warn("JWT auth failed for ${parsed.learnerId}: ${e.message}")
                }
            }
        }
        filterChain.doFilter(request, response)
    }
}