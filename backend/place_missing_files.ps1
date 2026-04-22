# ============================================================
# place_missing_files.ps1
# Run AFTER fix_compile_errors.ps1
# Run from: C:\Users\thrillerpark\Desktop\ELEWA\backend\
#
# This script writes the 7 missing Kotlin files directly
# into the correct package locations.
# ============================================================

$src = "src\main\kotlin\com\elekeza\backend"

Write-Host "Writing missing Kotlin files..." -ForegroundColor Cyan

# -- auth/JwtUtil.kt -----------------------------------------------------------
Set-Content -Path "$src\auth\JwtUtil.kt" -Encoding UTF8 -Value @'
package com.elekeza.backend.auth

import io.jsonwebtoken.Claims
import io.jsonwebtoken.Jwts
import io.jsonwebtoken.security.Keys
import org.springframework.beans.factory.annotation.Value
import org.springframework.stereotype.Component
import java.nio.charset.StandardCharsets
import java.util.*

@Component
class JwtUtil(
    @Value("${jwt.secret}") private val secret: String,
    @Value("${jwt.expiration:86400000}") private val expirationMs: Long
) {
    private val key by lazy {
        Keys.hmacShaKeyFor(secret.toByteArray(StandardCharsets.UTF_8))
    }

    fun generateToken(email: String, role: String): String =
        Jwts.builder()
            .subject(email)
            .claim("role", role)
            .issuedAt(Date())
            .expiration(Date(System.currentTimeMillis() + expirationMs))
            .signWith(key)
            .compact()

    fun validateToken(token: String): Boolean = runCatching {
        getClaims(token)
        true
    }.getOrDefault(false)

    fun getEmail(token: String): String = getClaims(token).subject

    fun getRole(token: String): String = getClaims(token)["role"] as String

    private fun getClaims(token: String): Claims =
        Jwts.parser()
            .verifyWith(key)
            .build()
            .parseSignedClaims(token)
            .payload
}
'@
Write-Host "  WRITTEN: auth/JwtUtil.kt" -ForegroundColor Green

# -- auth/JwtAuthFilter.kt -----------------------------------------------------
Set-Content -Path "$src\auth\JwtAuthFilter.kt" -Encoding UTF8 -Value @'
package com.elekeza.backend.auth

import jakarta.servlet.FilterChain
import jakarta.servlet.http.HttpServletRequest
import jakarta.servlet.http.HttpServletResponse
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken
import org.springframework.security.core.authority.SimpleGrantedAuthority
import org.springframework.security.core.context.SecurityContextHolder
import org.springframework.security.core.userdetails.UserDetailsService
import org.springframework.stereotype.Component
import org.springframework.web.filter.OncePerRequestFilter

@Component
class JwtAuthFilter(
    private val jwtUtil: JwtUtil,
    private val userDetailsService: UserDetailsService
) : OncePerRequestFilter() {

    override fun doFilterInternal(
        request: HttpServletRequest,
        response: HttpServletResponse,
        chain: FilterChain
    ) {
        val token = resolveToken(request)

        if (token != null && jwtUtil.validateToken(token)) {
            val email = jwtUtil.getEmail(token)
            val role  = jwtUtil.getRole(token)

            val userDetails = userDetailsService.loadUserByUsername(email)
            val auth = UsernamePasswordAuthenticationToken(
                userDetails,
                null,
                listOf(SimpleGrantedAuthority("ROLE_$role"))
            )
            SecurityContextHolder.getContext().authentication = auth
        }

        chain.doFilter(request, response)
    }

    private fun resolveToken(request: HttpServletRequest): String? {
        val cookie = request.cookies?.find { it.name == "elekeza_access" }
        if (cookie != null) return cookie.value
        val header = request.getHeader("Authorization") ?: return null
        return if (header.startsWith("Bearer ")) header.substring(7) else null
    }
}
'@
Write-Host "  WRITTEN: auth/JwtAuthFilter.kt" -ForegroundColor Green

# -- auth/OAuth2SuccessHandler.kt ----------------------------------------------
Set-Content -Path "$src\auth\OAuth2SuccessHandler.kt" -Encoding UTF8 -Value @'
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
    @Value("${app.frontend-url:http://localhost:3000}") private val frontendUrl: String
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

        val token = jwtUtil.generateToken(user.email, user.role.name)

        val cookie = Cookie("elekeza_access", token).apply {
            isHttpOnly = true
            secure = request.isSecure
            path = "/"
            maxAge = 86400
        }
        response.addCookie(cookie)

        val redirect = if (user.onboardingComplete) "$frontendUrl/dashboard" else "$frontendUrl/onboarding"
        response.sendRedirect(redirect)
    }
}
'@
Write-Host "  WRITTEN: auth/OAuth2SuccessHandler.kt" -ForegroundColor Green

# -- content/SourceType.kt -----------------------------------------------------
Set-Content -Path "$src\content\SourceType.kt" -Encoding UTF8 -Value @'
package com.elekeza.backend.content

enum class SourceType {
    PDF,
    DOCX,
    TEXT,
    URL,
    IMAGE
}
'@
Write-Host "  WRITTEN: content/SourceType.kt" -ForegroundColor Green

# -- content/KeyTerm.kt --------------------------------------------------------
Set-Content -Path "$src\content\KeyTerm.kt" -Encoding UTF8 -Value @'
package com.elekeza.backend.content

import jakarta.persistence.*

@Entity
@Table(name = "key_terms")
data class KeyTerm(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "lesson_id", nullable = false)
    val lesson: Lesson,

    @Column(nullable = false, length = 100)
    val term: String,

    @Column(nullable = false, columnDefinition = "TEXT")
    val definition: String,

    @Column(name = "was_tapped", nullable = false)
    val wasTapped: Boolean = false
)
'@
Write-Host "  WRITTEN: content/KeyTerm.kt" -ForegroundColor Green

# -- learner/Guardian.kt -------------------------------------------------------
Set-Content -Path "$src\learner\Guardian.kt" -Encoding UTF8 -Value @'
package com.elekeza.backend.learner

import jakarta.persistence.*

@Entity
@Table(name = "guardians")
data class Guardian(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "learner_id", nullable = false)
    val learner: Learner,

    @Column(name = "full_name", nullable = false, length = 200)
    val fullName: String,

    @Column(nullable = false, length = 50)
    val relationship: String,

    @Column(length = 20)
    val phone: String? = null,

    @Column(length = 255)
    val email: String? = null
)
'@
Write-Host "  WRITTEN: learner/Guardian.kt" -ForegroundColor Green

# -- learner/LiteracyLevel.kt --------------------------------------------------
Set-Content -Path "$src\learner\LiteracyLevel.kt" -Encoding UTF8 -Value @'
package com.elekeza.backend.learner

enum class LiteracyLevel {
    BEGINNER,
    ELEMENTARY,
    INTERMEDIATE,
    ADVANCED
}
'@
Write-Host "  WRITTEN: learner/LiteracyLevel.kt" -ForegroundColor Green

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "All missing files written." -ForegroundColor Cyan
Write-Host "Now run: .\gradlew compileKotlin" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Cyan
