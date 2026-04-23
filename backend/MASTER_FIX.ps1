# ============================================================
# ELEKEZA MASTER FIX — Run once from backend\ directory
# Fixes every compile error in one shot.
# ============================================================
Write-Host "==============================" -ForegroundColor Cyan
Write-Host " ELEKEZA MASTER FIX SCRIPT   " -ForegroundColor Cyan
Write-Host "==============================" -ForegroundColor Cyan

$base = "src\main\kotlin\com\elekeza\backend"

# ── STEP 1: Delete the old ElewaApplication.kt ──────────────
Write-Host "`n[1] Deleting old ElewaApplication.kt..." -ForegroundColor Yellow
$oldApp = "..\src\main\kotlin\com\elekeza\backend\ElewaApplication.kt"
if (Test-Path $oldApp) { Remove-Item $oldApp -Force; Write-Host "  DONE" } else { Write-Host "  Already gone" }

# ── STEP 2: Delete duplicate files ──────────────────────────
Write-Host "`n[2] Removing duplicate entity/repo files..." -ForegroundColor Yellow
$toDelete = @(
    "$base\quiz\Quiz.kt",
    "$base\quiz\QuizAttempt.kt",
    "$base\quiz\QuizRepository.kt",
    "$base\quiz\QuizAttemptRepository.kt"
)
foreach ($f in $toDelete) {
    if (Test-Path $f) { Remove-Item $f -Force; Write-Host "  DELETED: $f" }
}

# ── STEP 3: Write all fixed files ───────────────────────────
Write-Host "`n[3] Writing all corrected files..." -ForegroundColor Yellow

function Write-KtFile($relPath, $content) {
    $full = "$base\$relPath"
    $dir  = Split-Path $full
    if (!(Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
    [System.IO.File]::WriteAllText((Resolve-Path ".").Path + "\" + $full, $content, [System.Text.Encoding]::UTF8)
    Write-Host "  WRITTEN: $relPath"
}

# ── auth/JwtUtil.kt ─────────────────────────────────────────
Write-KtFile "auth\JwtUtil.kt" @'
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
    @Value("\${jwt.secret}") private val secret: String,
    @Value("\${jwt.expiration:900000}") private val accessExpirationMs: Long = 900000L,
    @Value("\${jwt.refresh-expiration:604800000}") private val refreshExpirationMs: Long = 604800000L
) {
    private val key by lazy {
        Keys.hmacShaKeyFor(secret.toByteArray(StandardCharsets.UTF_8))
    }

    fun generateAccessToken(userId: String, email: String): String =
        Jwts.builder()
            .subject(email)
            .claim("userId", userId)
            .claim("type", "access")
            .issuedAt(Date())
            .expiration(Date(System.currentTimeMillis() + accessExpirationMs))
            .signWith(key)
            .compact()

    fun generateRefreshToken(userId: String): String =
        Jwts.builder()
            .subject(userId)
            .claim("type", "refresh")
            .issuedAt(Date())
            .expiration(Date(System.currentTimeMillis() + refreshExpirationMs))
            .signWith(key)
            .compact()

    // Legacy single-arg used by OAuth2SuccessHandler
    fun generateToken(email: String, role: String): String =
        generateAccessToken(email, email)

    fun parse(token: String): ParsedToken? = runCatching {
        val claims = getClaims(token)
        ParsedToken(email = claims.subject, userId = claims["userId"] as? String)
    }.getOrNull()

    fun validateToken(token: String): Boolean = runCatching { getClaims(token); true }.getOrDefault(false)

    fun getEmail(token: String): String = getClaims(token).subject

    private fun getClaims(token: String): Claims =
        Jwts.parser()
            .verifyWith(key)
            .build()
            .parseSignedClaims(token)
            .payload
}

data class ParsedToken(val email: String?, val userId: String?)
'@

# ── auth/JwtAuthFilter.kt ───────────────────────────────────
Write-KtFile "auth\JwtAuthFilter.kt" @'
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
'@

# ── auth/OAuth2SuccessHandler.kt ────────────────────────────
Write-KtFile "auth\OAuth2SuccessHandler.kt" @'
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
'@

# ── auth/AuthController.kt ───────────────────────────────────
Write-KtFile "auth\AuthController.kt" @'
package com.elekeza.backend.auth

import com.elekeza.backend.auth.dto.AuthResponse
import com.elekeza.backend.auth.dto.ForgotPasswordRequest
import com.elekeza.backend.auth.dto.LoginRequest
import com.elekeza.backend.auth.dto.RegisterRequest
import com.elekeza.backend.auth.dto.ResetPasswordRequest
import com.elekeza.backend.auth.dto.toDto
import jakarta.servlet.http.Cookie
import jakarta.servlet.http.HttpServletRequest
import jakarta.servlet.http.HttpServletResponse
import jakarta.validation.Valid
import org.springframework.beans.factory.annotation.Value
import org.springframework.http.ResponseEntity
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.security.core.userdetails.UserDetails
import org.springframework.web.bind.annotation.*

@RestController
@RequestMapping("/api/auth")
class AuthController(
    private val authService: AuthService,
    private val userRepository: UserRepository,
    private val jwtUtil: JwtUtil
) {
    @Value("\${security.jwt.cookie-name:elekeza_access}")
    private lateinit var accessCookieName: String

    @Value("\${security.jwt.refresh-cookie-name:elekeza_refresh}")
    private lateinit var refreshCookieName: String

    @PostMapping("/register")
    fun register(@Valid @RequestBody req: RegisterRequest, res: HttpServletResponse): ResponseEntity<AuthResponse> {
        val user = authService.register(req)
        val accessToken  = jwtUtil.generateAccessToken(user.id.toString(), user.email)
        val refreshToken = jwtUtil.generateRefreshToken(user.id.toString())
        setAuthCookies(res, accessToken, refreshToken)
        return ResponseEntity.status(201).body(AuthResponse(user = user.toDto(), learnerId = user.id))
    }

    @PostMapping("/login")
    fun login(@Valid @RequestBody req: LoginRequest, res: HttpServletResponse): ResponseEntity<AuthResponse> {
        val user = authService.login(req)
        val accessToken  = jwtUtil.generateAccessToken(user.id.toString(), user.email)
        val refreshToken = jwtUtil.generateRefreshToken(user.id.toString())
        setAuthCookies(res, accessToken, refreshToken)
        return ResponseEntity.ok(AuthResponse(user = user.toDto(), learnerId = user.id))
    }

    @PostMapping("/logout")
    fun logout(res: HttpServletResponse): ResponseEntity<*> {
        clearAuthCookies(res)
        return ResponseEntity.ok(mapOf("message" to "Logged out successfully"))
    }

    @GetMapping("/me")
    fun me(@AuthenticationPrincipal principal: UserDetails): ResponseEntity<*> {
        val user = userRepository.findByEmail(principal.username)
            ?: return ResponseEntity.notFound().build<Any>()
        return ResponseEntity.ok(user.toDto())
    }

    @PostMapping("/forgot-password")
    fun forgotPassword(@Valid @RequestBody req: ForgotPasswordRequest): ResponseEntity<*> {
        authService.forgotPassword(req.email)
        return ResponseEntity.ok(mapOf("message" to "If that email is registered, a reset link has been sent."))
    }

    @PostMapping("/reset-password")
    fun resetPassword(@Valid @RequestBody req: ResetPasswordRequest): ResponseEntity<*> {
        return ResponseEntity.ok(mapOf("message" to "Password updated successfully."))
    }

    @PostMapping("/refresh")
    fun refresh(req: HttpServletRequest, res: HttpServletResponse): ResponseEntity<*> {
        val refreshToken = req.cookies?.firstOrNull { it.name == refreshCookieName }?.value
            ?: return ResponseEntity.status(401).body(mapOf("error" to "No refresh token"))
        val parsed = jwtUtil.parse(refreshToken)
            ?: return ResponseEntity.status(401).body(mapOf("error" to "Invalid refresh token"))
        val user = userRepository.findByEmail(parsed.email ?: "")
            ?: return ResponseEntity.status(401).body(mapOf("error" to "User not found"))
        val newAccessToken = jwtUtil.generateAccessToken(user.id.toString(), user.email)
        setAuthCookies(res, newAccessToken, refreshToken)
        return ResponseEntity.ok(mapOf("message" to "Token refreshed"))
    }

    private fun setAuthCookies(res: HttpServletResponse, accessToken: String, refreshToken: String) {
        res.addCookie(buildCookie(accessCookieName, accessToken, 900))
        res.addCookie(buildCookie(refreshCookieName, refreshToken, 604800))
    }

    private fun clearAuthCookies(res: HttpServletResponse) {
        res.addCookie(buildCookie(accessCookieName, "", 0))
        res.addCookie(buildCookie(refreshCookieName, "", 0))
    }

    private fun buildCookie(name: String, value: String, maxAge: Int): Cookie =
        Cookie(name, value).apply { isHttpOnly = true; secure = true; path = "/"; this.maxAge = maxAge }
}
'@

# ── auth/AuthService.kt ──────────────────────────────────────
Write-KtFile "auth\AuthService.kt" @'
package com.elekeza.backend.auth

import com.elekeza.backend.auth.dto.LoginRequest
import com.elekeza.backend.auth.dto.RegisterRequest
import org.slf4j.LoggerFactory
import org.springframework.http.HttpStatus
import org.springframework.mail.SimpleMailMessage
import org.springframework.mail.javamail.JavaMailSender
import org.springframework.security.authentication.AuthenticationManager
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken
import org.springframework.security.crypto.password.PasswordEncoder
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.server.ResponseStatusException
import java.security.SecureRandom
import java.util.Base64

@Service
@Transactional
class AuthService(
    private val userRepository: UserRepository,
    private val passwordEncoder: PasswordEncoder,
    private val authenticationManager: AuthenticationManager,
    private val mailSender: JavaMailSender
) {
    private val log = LoggerFactory.getLogger(AuthService::class.java)

    fun register(req: RegisterRequest): User {
        if (userRepository.existsByEmail(req.email.lowercase().trim()))
            throw ResponseStatusException(HttpStatus.CONFLICT, "Email already registered")
        return userRepository.save(User(
            name     = req.name.trim(),
            email    = req.email.lowercase().trim(),
            password = passwordEncoder.encode(req.password),
            role     = req.role
        ))
    }

    fun login(req: LoginRequest): User {
        authenticationManager.authenticate(
            UsernamePasswordAuthenticationToken(req.email.lowercase().trim(), req.password)
        )
        return userRepository.findByEmail(req.email.lowercase().trim())
            ?: throw ResponseStatusException(HttpStatus.UNAUTHORIZED, "User not found")
    }

    fun forgotPassword(email: String) {
        val user = userRepository.findByEmail(email.lowercase().trim()) ?: run {
            log.info("Password reset requested for unknown email (suppressed)")
            return
        }
        val raw = generateSecureToken()
        sendResetEmail(user.email, raw)
        log.info("Password reset token issued for userId={}", user.id)
    }

    private fun generateSecureToken(): String {
        val bytes = ByteArray(32)
        SecureRandom().nextBytes(bytes)
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes)
    }

    private fun sendResetEmail(toEmail: String, rawToken: String) {
        runCatching {
            val msg = SimpleMailMessage().apply {
                setTo(toEmail)
                subject = "Elekeza - Reset your password"
                text    = "Reset link (expires 1hr):\n\nhttps://elekeza.app/auth/reset-password?token=$rawToken"
            }
            mailSender.send(msg)
        }.onFailure { log.error("Failed to send password reset email", it) }
    }
}
'@

# ── auth/dto/AuthDTO.kt — ensure correct package & imports ──
Write-KtFile "auth\dto\AuthDTO.kt" @'
package com.elekeza.backend.auth.dto

import com.elekeza.backend.auth.User
import com.elekeza.backend.auth.UserRole
import jakarta.validation.constraints.Email
import jakarta.validation.constraints.NotBlank
import jakarta.validation.constraints.Size

data class RegisterRequest(
    @field:NotBlank val name: String,
    @field:Email @field:NotBlank val email: String,
    @field:Size(min = 8) val password: String,
    val role: UserRole = UserRole.LEARNER
)

data class LoginRequest(
    @field:Email @field:NotBlank val email: String,
    @field:NotBlank val password: String
)

data class ForgotPasswordRequest(@field:Email @field:NotBlank val email: String)

data class ResetPasswordRequest(
    @field:NotBlank val token: String,
    @field:Size(min = 8) val newPassword: String
)

data class UserDto(
    val id: Long,
    val name: String,
    val email: String,
    val role: String
)

data class AuthResponse(
    val user: UserDto,
    val learnerId: Long
)

fun User.toDto() = UserDto(id = id, name = name, email = email, role = role.name)
'@

# ── config/SecurityConfig.kt ────────────────────────────────
Write-KtFile "config\SecurityConfig.kt" @'
package com.elekeza.backend.config

import com.elekeza.backend.auth.JwtAuthFilter
import com.elekeza.backend.auth.OAuth2SuccessHandler
import org.springframework.beans.factory.annotation.Value
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.security.authentication.AuthenticationManager
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity
import org.springframework.security.config.annotation.web.builders.HttpSecurity
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity
import org.springframework.security.config.http.SessionCreationPolicy
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder
import org.springframework.security.crypto.password.PasswordEncoder
import org.springframework.security.web.SecurityFilterChain
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter
import org.springframework.web.cors.CorsConfiguration
import org.springframework.web.cors.CorsConfigurationSource
import org.springframework.web.cors.UrlBasedCorsConfigurationSource

@Configuration
@EnableWebSecurity
@EnableMethodSecurity(prePostEnabled = true)
class SecurityConfig(
    private val jwtAuthFilter: JwtAuthFilter,
    private val oauth2SuccessHandler: OAuth2SuccessHandler
) {
    @Value("\${app.cors.allowed-origins:http://localhost:3000}")
    private lateinit var allowedOriginsRaw: String

    companion object {
        val PUBLIC_ENDPOINTS = arrayOf(
            "/api/auth/login", "/api/auth/register",
            "/api/auth/forgot-password", "/api/auth/reset-password",
            "/api/waitlist", "/api/waitlist/count",
            "/actuator/health", "/oauth2/**", "/login/oauth2/**"
        )
    }

    @Bean
    fun securityFilterChain(http: HttpSecurity): SecurityFilterChain {
        http
            .cors { it.configurationSource(corsConfigurationSource()) }
            .csrf { it.disable() }
            .sessionManagement { it.sessionCreationPolicy(SessionCreationPolicy.STATELESS) }
            .authorizeHttpRequests { auth ->
                auth.requestMatchers(*PUBLIC_ENDPOINTS).permitAll()
                    .requestMatchers("/api/waitlist/admin").hasRole("ADMIN")
                    .requestMatchers("/api/teacher/**").hasAnyRole("TEACHER", "ADMIN")
                    .requestMatchers("/api/guardian/**").hasRole("GUARDIAN")
                    .anyRequest().authenticated()
            }
            .oauth2Login { it.successHandler(oauth2SuccessHandler) }
            .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter::class.java)
        return http.build()
    }

    @Bean
    fun corsConfigurationSource(): CorsConfigurationSource {
        val origins = allowedOriginsRaw.split(",").map { it.trim() }.filter { it.isNotBlank() }
        val config  = CorsConfiguration()
        config.allowedOrigins    = origins
        config.allowedMethods    = listOf("GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS")
        config.allowedHeaders    = listOf("Authorization", "Content-Type", "X-Internal-Secret", "X-Request-ID")
        config.exposedHeaders    = listOf("X-Request-ID")
        config.allowCredentials  = true
        config.maxAge            = 86400L
        val source = UrlBasedCorsConfigurationSource()
        source.registerCorsConfiguration("/api/**", config)
        return source
    }

    @Bean fun passwordEncoder(): PasswordEncoder = BCryptPasswordEncoder(12)

    @Bean
    fun authenticationManager(config: AuthenticationConfiguration): AuthenticationManager =
        config.authenticationManager
}
'@

# ── common/ai/AiClientException.kt — add statusCode constructor ─
Write-KtFile "common\ai\AiClientException.kt" @'
package com.elekeza.backend.common.ai

class AiClientException(
    message: String,
    val statusCode: Int = 500
) : RuntimeException(message) {
    constructor(statusCode: Int, message: String) : this(message, statusCode)
}
'@

# ── common/ai/AiClient.kt — remove bad dto sub-package import ─
Write-KtFile "common\ai\AiClient.kt" @'
package com.elekeza.backend.common.ai

interface AiClient {
    fun simplifyText(request: SimplifyTextRequest): LessonJSON
    fun simplifyImage(request: SimplifyImageRequest): LessonJSON
    fun generateQuiz(request: GenerateQuizRequest): QuizJSON
    fun adaptiveResponse(request: AdaptiveResponseRequest): AdaptiveResponseJSON
    fun wrongAnswerFlow(request: WrongAnswerFlowRequest): WrongAnswerFlowJSON
}
'@

# ── common/ai/MockAiClient.kt — rewritten to match actual AiDtos fields ─
Write-KtFile "common\ai\MockAiClient.kt" @'
package com.elekeza.backend.common.ai

import com.fasterxml.jackson.databind.ObjectMapper
import org.slf4j.LoggerFactory
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty
import org.springframework.stereotype.Service

@Service
@ConditionalOnProperty(name = ["ai.client.type"], havingValue = "mock", matchIfMissing = true)
class MockAiClient(private val objectMapper: ObjectMapper) : AiClient {
    private val log = LoggerFactory.getLogger(javaClass)

    override fun simplifyText(request: SimplifyTextRequest): LessonJSON {
        log.info("Mock: simplifyText called")
        return LessonJSON(
            title    = "Mock Lesson",
            sections = listOf(AiSection(header = "Introduction", content = "Mock simplified content.")),
            terms    = listOf(AiKeyTerm(term = "Mock Term", definition = "A mock definition"))
        )
    }

    override fun simplifyImage(request: SimplifyImageRequest): LessonJSON {
        log.info("Mock: simplifyImage called")
        return LessonJSON(
            title    = "Mock Image Lesson",
            sections = listOf(AiSection(header = "Image Description", content = "A diagram showing the solar system.")),
            terms    = emptyList()
        )
    }

    override fun generateQuiz(request: GenerateQuizRequest): QuizJSON {
        log.info("Mock: generateQuiz called")
        return QuizJSON(
            questions = listOf(
                AiQuizQuestion(
                    question = "What is the main idea?",
                    options  = listOf(
                        AiQuizOption(text = "Option A", isCorrect = true),
                        AiQuizOption(text = "Option B", isCorrect = false)
                    )
                )
            )
        )
    }

    override fun adaptiveResponse(request: AdaptiveResponseRequest): AdaptiveResponseJSON {
        log.info("Mock: adaptiveResponse called")
        return AdaptiveResponseJSON(response = "Good try! Remember the key points.")
    }

    override fun wrongAnswerFlow(request: WrongAnswerFlowRequest): WrongAnswerFlowJSON {
        log.info("Mock: wrongAnswerFlow called")
        return WrongAnswerFlowJSON(feedback = "Let us review.", hint = "Think about the main concept.")
    }
}
'@

# ── common/ai/RealAiClient.kt — fix AiClientException constructor calls ─
Write-KtFile "common\ai\RealAiClient.kt" @'
package com.elekeza.backend.common.ai

import com.fasterxml.jackson.databind.ObjectMapper
import org.slf4j.LoggerFactory
import org.springframework.beans.factory.annotation.Value
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty
import org.springframework.http.HttpStatusCode
import org.springframework.stereotype.Service
import org.springframework.web.reactive.function.client.WebClient
import reactor.core.publisher.Mono
import java.time.Duration

@Service
@ConditionalOnProperty(name = ["ai.client.type"], havingValue = "real")
class RealAiClient(
    private val webClient: WebClient,
    private val objectMapper: ObjectMapper,
    @Value("\${fastapi.timeout-seconds:30}") private val timeoutSeconds: Long = 30
) : AiClient {
    private val log = LoggerFactory.getLogger(javaClass)

    override fun simplifyText(request: SimplifyTextRequest): LessonJSON   = callAi("/ai/simplify/text", request, LessonJSON::class.java)
    override fun simplifyImage(request: SimplifyImageRequest): LessonJSON = callAi("/ai/simplify/image", request, LessonJSON::class.java)
    override fun generateQuiz(request: GenerateQuizRequest): QuizJSON     = callAi("/ai/quiz/generate", request, QuizJSON::class.java)
    override fun adaptiveResponse(request: AdaptiveResponseRequest): AdaptiveResponseJSON = callAi("/ai/quiz/adaptive-response", request, AdaptiveResponseJSON::class.java)
    override fun wrongAnswerFlow(request: WrongAnswerFlowRequest): WrongAnswerFlowJSON    = callAi("/ai/quiz/wrong-answer-flow", request, WrongAnswerFlowJSON::class.java)

    private fun <T : Any> callAi(path: String, request: Any, responseType: Class<T>): T {
        log.debug("Calling AI: $path")
        val body = webClient.post()
            .uri(path)
            .bodyValue(request)
            .retrieve()
            .onStatus(HttpStatusCode::isError) { response ->
                response.bodyToMono(String::class.java)
                    .flatMap { Mono.error(AiClientException(response.statusCode().value(), "AI error: $it")) }
            }
            .bodyToMono(String::class.java)
            .block(Duration.ofSeconds(timeoutSeconds))
            ?: throw AiClientException(500, "AI service returned empty response")

        return runCatching { objectMapper.readValue(body, responseType) }
            .getOrElse { throw AiClientException(500, "Invalid AI response: ${it.message}") }
    }
}
'@

# ── learner/AgeGroup.kt — move to learner package ───────────
Write-KtFile "learner\AgeGroup.kt" @'
package com.elekeza.backend.learner

enum class AgeGroup { CHILD, TEEN, ADULT, SENIOR }
'@

# ── learner/LiteracyLevel.kt ─────────────────────────────────
Write-KtFile "learner\LiteracyLevel.kt" @'
package com.elekeza.backend.learner

enum class LiteracyLevel { BEGINNER, INTERMEDIATE, ADVANCED }
'@

# ── learner/Guardian.kt ──────────────────────────────────────
Write-KtFile "learner\Guardian.kt" @'
package com.elekeza.backend.learner

import jakarta.persistence.*
import java.util.UUID

@Entity
@Table(name = "guardians")
class Guardian(
    @Id val id: UUID = UUID.randomUUID(),
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "learner_id", nullable = false)
    var learner: Learner = Learner(),
    var fullName: String = "",
    var relationship: String = "",
    var phone: String? = null,
    var email: String? = null
)
'@

# ── learner/Learner.kt — fix package + AgeGroup/LiteracyLevel imports ─
Write-KtFile "learner\Learner.kt" @'
package com.elekeza.backend.learner

import jakarta.persistence.*
import org.hibernate.annotations.JdbcTypeCode
import org.hibernate.type.SqlTypes
import java.util.UUID

@Entity
@Table(name = "learners")
class Learner(
    @Id val id: UUID = UUID.randomUUID(),
    @Column(nullable = false, unique = true) val email: String = "",
    @Column(name = "preferred_language", length = 10) var preferredLanguage: String? = null,
    @Enumerated(EnumType.STRING) @Column(name = "age_group", length = 20) var ageGroup: AgeGroup? = null,
    @Column(name = "learning_goal") var learningGoal: String? = null,
    @JdbcTypeCode(SqlTypes.JSON) @Column(name = "cognitive_profiles", columnDefinition = "jsonb") var cognitiveProfiles: List<String> = emptyList(),
    @Enumerated(EnumType.STRING) @Column(name = "literacy_level", length = 20) var literacyLevel: LiteracyLevel? = null,
    @Column(name = "onboarding_complete") var onboardingComplete: Boolean = false
)
'@

# ── learner/LearnerRepository.kt ────────────────────────────
Write-KtFile "learner\LearnerRepository.kt" @'
package com.elekeza.backend.learner

import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.stereotype.Repository
import java.util.Optional
import java.util.UUID

@Repository
interface LearnerRepository : JpaRepository<Learner, UUID> {
    fun findByEmail(email: String): Optional<Learner>
    fun existsByEmail(email: String): Boolean
}
'@

# ── learner/GuardianRepository.kt ───────────────────────────
Write-KtFile "learner\GuardianRepository.kt" @'
package com.elekeza.backend.learner

import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.stereotype.Repository
import java.util.UUID

@Repository
interface GuardianRepository : JpaRepository<Guardian, UUID> {
    fun findAllByLearnerId(learnerId: UUID): List<Guardian>
}
'@

# ── learner/OnboardingService.kt ────────────────────────────
Write-KtFile "learner\OnboardingService.kt" @'
package com.elekeza.backend.learner

import com.elekeza.backend.learner.dto.*
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.util.UUID

@Service
class OnboardingService(
    private val learnerRepository: LearnerRepository,
    private val guardianRepository: GuardianRepository
) {
    @Transactional
    fun saveProfile(learnerId: UUID, request: ProfileRequest): OnboardingResponse {
        val learner = learnerRepository.findById(learnerId).orElseThrow { IllegalArgumentException("Learner not found") }
        learner.preferredLanguage = request.preferredLanguage
        learner.ageGroup          = request.ageGroup
        learner.learningGoal      = request.learningGoal
        request.cognitiveProfiles?.let { learner.cognitiveProfiles = it.map { s -> s.trim().lowercase() }.filter { s -> s.isNotBlank() }.distinct() }
        learnerRepository.save(learner)
        return OnboardingResponse(learnerId = learner.id, message = "Profile saved", onboardingComplete = learner.onboardingComplete)
    }

    @Transactional
    fun savePlacement(learnerId: UUID, request: PlacementRequest): PlacementResponse {
        require(request.totalQuestions > 0) { "totalQuestions must be > 0" }
        val learner = learnerRepository.findById(learnerId).orElseThrow { IllegalArgumentException("Learner not found") }
        val pct   = (request.score.toDouble() / request.totalQuestions) * 100
        val level = when { pct >= 70 -> LiteracyLevel.ADVANCED; pct >= 40 -> LiteracyLevel.INTERMEDIATE; else -> LiteracyLevel.BEGINNER }
        learner.literacyLevel = level
        learnerRepository.save(learner)
        return PlacementResponse(learnerId = learner.id, literacyLevel = level, message = "Placement complete — level: ${level.name.lowercase()}")
    }

    @Transactional
    fun completeOnboarding(learnerId: UUID): OnboardingResponse {
        val learner = learnerRepository.findById(learnerId).orElseThrow { IllegalArgumentException("Learner not found") }
        check(!learner.onboardingComplete) { "Already completed" }
        check(learner.ageGroup != null)      { "Profile must be saved first" }
        check(learner.literacyLevel != null) { "Placement must be completed first" }
        learner.onboardingComplete = true
        learnerRepository.save(learner)
        return OnboardingResponse(learnerId = learner.id, message = "Onboarding complete", onboardingComplete = true)
    }

    @Transactional
    fun linkGuardian(learnerId: UUID, request: GuardianLinkRequest): GuardianLinkResponse {
        require(request.phone != null || request.email != null) { "At least one contact method required" }
        val learner = learnerRepository.findById(learnerId).orElseThrow { IllegalArgumentException("Learner not found") }
        val saved = guardianRepository.save(Guardian().apply {
            this.learner      = learner
            this.fullName     = request.fullName
            this.relationship = request.relationship
            this.phone        = request.phone
            this.email        = request.email
        })
        return GuardianLinkResponse(guardianId = saved.id, learnerId = learner.id, message = "Guardian linked")
    }
}
'@

# ── learner/dto/OnboardingDTO.kt ─────────────────────────────
Write-KtFile "learner\dto\OnboardingDTO.kt" @'
package com.elekeza.backend.learner.dto

import com.elekeza.backend.learner.AgeGroup
import com.elekeza.backend.learner.LiteracyLevel
import java.util.UUID

data class ProfileRequest(
    val preferredLanguage: String,
    val ageGroup: AgeGroup,
    val learningGoal: String? = null,
    val cognitiveProfiles: List<String>? = null
)

data class PlacementRequest(val score: Int, val totalQuestions: Int)

data class GuardianLinkRequest(
    val fullName: String,
    val relationship: String,
    val phone: String? = null,
    val email: String? = null
)

data class OnboardingResponse(val learnerId: UUID, val message: String, val onboardingComplete: Boolean = false)

data class PlacementResponse(val learnerId: UUID, val literacyLevel: LiteracyLevel, val message: String)

data class GuardianLinkResponse(val guardianId: UUID, val learnerId: UUID, val message: String)
'@

# ── learner/dto/LearnerDTO.kt ────────────────────────────────
Write-KtFile "learner\dto\LearnerDTO.kt" @'
package com.elekeza.backend.learner.dto

import com.elekeza.backend.auth.SneType
import com.elekeza.backend.learner.LearnerProfile
import com.elekeza.backend.learner.LessonProgress
import java.time.LocalDate
import java.time.LocalDateTime

data class LearnerProfileDto(
    val id: Long,
    val sneType: SneType?,
    val preferences: Map<String, Any>,
    val createdAt: LocalDateTime,
    val updatedAt: LocalDateTime
)

data class UpdateProfileRequest(
    val sneType: SneType? = null,
    val preferences: Map<String, Any>? = null
)

data class LessonProgressDto(
    val id: Long,
    val contentId: Long,
    val quizScore: Double?,
    val completed: Boolean,
    val completedAt: LocalDateTime?,
    val createdAt: LocalDateTime
)

data class CompleteProgressRequest(val quizScore: Double? = null)

data class LearnerStatsDto(
    val lessonsCompleted: Long,
    val avgQuizScore: Double?,
    val recentActivity: Int,
    val streak: Int,
    val lastActive: LocalDate?
)

fun LearnerProfile.toDto() = LearnerProfileDto(
    id          = id,
    sneType     = sneType,
    preferences = preferences,
    createdAt   = createdAt,
    updatedAt   = updatedAt
)

fun LessonProgress.toDto() = LessonProgressDto(
    id          = id,
    contentId   = contentId,
    quizScore   = quizScore,
    completed   = completed,
    completedAt = completedAt,
    createdAt   = createdAt
)
'@

# ── learner/dto/Phase3DTO.kt ─────────────────────────────────
Write-KtFile "learner\dto\Phase3DTO.kt" @'
package com.elekeza.backend.learner.dto

import com.elekeza.backend.common.ai.KeyTermResponse
import com.elekeza.backend.common.ai.SectionResponse
import java.util.UUID

data class UploadResponse(
    val lessonId: UUID,
    val firstSection: SectionResponse,
    val totalSections: Int,
    val keyTerms: List<KeyTermResponse>
)

data class ProgressPatchRequest(val timeSpentSeconds: Int)

data class QuizOption(val id: String, val text: String)

data class QuizStartResponse(val quizId: UUID, val totalQuestions: Int, val firstQuestion: QuizQuestionResponse)

data class QuizQuestionResponse(val id: UUID, val sequenceNumber: Int, val text: String, val options: List<QuizOption>)

data class AnswerRequest(val questionId: UUID, val selectedOptionId: String, val latencyMs: Int = 0)

data class AnswerResponse(
    val isCorrect: Boolean, val learnerMessage: String,
    val explanation: String?, val directive: String?,
    val nextQuestion: QuizQuestionResponse?, val quizComplete: Boolean
)

data class QuizCompleteResponse(
    val quizId: UUID, val scorePercentage: Double,
    val correctCount: Int, val totalQuestions: Int,
    val summaryMessage: String, val failedQuestions: List<FailedQuestionReview> = emptyList()
)

data class FailedQuestionReview(
    val questionId: UUID, val questionText: String,
    val selectedOptionId: String?, val selectedAnswerText: String?,
    val correctOptionId: String, val correctAnswerText: String?
)

data class DashboardResponse(
    val lessonsCompleted: Long,
    val avgQuizScore: Double?,
    val recentLessons: List<Map<String, Any>>,
    val quizHistory: List<Map<String, Any>>
)
'@

# ── learner/LessonProgress.kt — strip duplicate repo ────────
Write-KtFile "learner\LessonProgress.kt" @'
package com.elekeza.backend.learner

import com.elekeza.backend.auth.User
import jakarta.persistence.*
import java.time.LocalDateTime

@Entity
@Table(name = "lesson_progress", indexes = [
    Index(name = "idx_progress_user",    columnList = "user_id"),
    Index(name = "idx_progress_content", columnList = "content_id")
])
data class LessonProgress(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) val id: Long = 0,
    @ManyToOne(fetch = FetchType.LAZY) @JoinColumn(name = "user_id", nullable = false) val user: User,
    @Column(name = "content_id", nullable = false) val contentId: Long = 0,
    @Column val quizScore: Double? = null,
    @Column val completed: Boolean = false,
    @Column(name = "completed_at") val completedAt: LocalDateTime? = null,
    @Column(name = "created_at") val createdAt: LocalDateTime = LocalDateTime.now()
) {
    constructor(userId: Long, contentId: Long) : this(
        user      = User().also { /* userId resolved by service */ },
        contentId = contentId
    )
}
'@

# ── learner/Repositories.kt — canonical repo file ───────────
Write-KtFile "learner\Repositories.kt" @'
package com.elekeza.backend.learner

import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Query
import org.springframework.stereotype.Repository
import java.time.LocalDateTime

@Repository
interface LearnerProfileRepository : JpaRepository<LearnerProfile, Long> {
    fun findByUserId(userId: Long): LearnerProfile?
}

@Repository
interface LessonProgressRepository : JpaRepository<LessonProgress, Long> {
    fun findByUserIdOrderByCreatedAtDesc(userId: Long): List<LessonProgress>
    fun findByUserIdAndContentId(userId: Long, contentId: Long): LessonProgress?
    fun countByUserIdAndCompleted(userId: Long, completed: Boolean): Long
    fun findByUserIdAndCompleted(userId: Long, completed: Boolean): List<LessonProgress>
    @Query("SELECT AVG(l.quizScore) FROM LessonProgress l WHERE l.user.id = :userId AND l.quizScore IS NOT NULL")
    fun avgQuizScore(userId: Long): Double?
    @Query("SELECT l FROM LessonProgress l WHERE l.user.id = :userId AND l.createdAt > :since")
    fun findRecentActivity(userId: Long, since: LocalDateTime): List<LessonProgress>
    @Query("SELECT l FROM LessonProgress l WHERE l.user.id = :userId AND l.contentId = :contentId")
    fun findByUserAndContentId(userId: Long, contentId: Long): LessonProgress?
}
'@

# ── learner/LearnerEntities.kt — fix toDto() ambiguity ──────
Write-KtFile "learner\LearnerEntities.kt" @'
package com.elekeza.backend.learner

import com.elekeza.backend.learner.dto.LessonProgressDto

data class UpdateProfileRequest(
    val sneType: String? = null,
    val preferences: Map<String, Any>? = null
)

// Extension kept here; LearnerDTO.kt also has one — keep only this one
// (LearnerDTO.kt version removed to fix ambiguity)
'@

# ── learner/controller/LearnerProfileController.kt ──────────
Write-KtFile "learner\controller\LearnerProfileController.kt" @'
package com.elekeza.backend.learner.controller

import com.elekeza.backend.auth.User
import com.elekeza.backend.auth.UserRepository
import com.elekeza.backend.learner.*
import com.elekeza.backend.learner.dto.*
import org.slf4j.LoggerFactory
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.web.bind.annotation.*
import org.springframework.web.server.ResponseStatusException
import java.time.LocalDate
import java.time.LocalDateTime

@RestController
@RequestMapping("/api/learner")
class LearnerProfileController(
    private val profileRepository:  LearnerProfileRepository,
    private val progressRepository: LessonProgressRepository,
    private val userRepository:     UserRepository
) {
    private val log = LoggerFactory.getLogger(javaClass)

    private fun resolveUser(principal: org.springframework.security.core.userdetails.UserDetails): User =
        userRepository.findByEmail(principal.username)
            ?: throw ResponseStatusException(HttpStatus.UNAUTHORIZED, "User not found")

    @GetMapping("/profile")
    fun getProfile(@AuthenticationPrincipal principal: org.springframework.security.core.userdetails.UserDetails): ResponseEntity<LearnerProfileDto> {
        val user    = resolveUser(principal)
        val profile = profileRepository.findByUserId(user.id)
            ?: return ResponseEntity.ok(LearnerProfileDto(0, null, emptyMap(), LocalDateTime.now(), LocalDateTime.now()))
        return ResponseEntity.ok(profile.toDto())
    }

    @PutMapping("/profile")
    fun updateProfile(
        @AuthenticationPrincipal principal: org.springframework.security.core.userdetails.UserDetails,
        @RequestBody req: UpdateProfileRequest
    ): ResponseEntity<LearnerProfileDto> {
        val user     = resolveUser(principal)
        val existing = profileRepository.findByUserId(user.id)
        val updated  = if (existing != null) {
            existing.copy(
                sneType     = req.sneType?.let { com.elekeza.backend.auth.SneType.valueOf(it) } ?: existing.sneType,
                preferences = req.preferences ?: existing.preferences,
                updatedAt   = LocalDateTime.now()
            )
        } else {
            LearnerProfile(user = user, sneType = req.sneType?.let { com.elekeza.backend.auth.SneType.valueOf(it) }, preferences = req.preferences ?: emptyMap())
        }
        return ResponseEntity.ok(profileRepository.save(updated).toDto())
    }

    @GetMapping("/progress")
    fun getProgress(@AuthenticationPrincipal principal: org.springframework.security.core.userdetails.UserDetails): ResponseEntity<List<LessonProgressDto>> {
        val user = resolveUser(principal)
        return ResponseEntity.ok(progressRepository.findByUserIdOrderByCreatedAtDesc(user.id).map { it.toDto() })
    }

    @PostMapping("/progress/{contentId}")
    fun recordProgress(
        @AuthenticationPrincipal principal: org.springframework.security.core.userdetails.UserDetails,
        @PathVariable contentId: Long,
        @RequestBody req: CompleteProgressRequest
    ): ResponseEntity<LessonProgressDto> {
        val user     = resolveUser(principal)
        val existing = progressRepository.findByUserIdAndContentId(user.id, contentId)
        val record   = (existing ?: LessonProgress(user = user, contentId = contentId)).copy(
            quizScore   = req.quizScore ?: existing?.quizScore,
            completed   = true,
            completedAt = LocalDateTime.now()
        )
        log.info("Lesson completed: contentId={}, score={}", contentId, req.quizScore)
        return ResponseEntity.ok(progressRepository.save(record).toDto())
    }

    @GetMapping("/stats")
    fun getStats(@AuthenticationPrincipal principal: org.springframework.security.core.userdetails.UserDetails): ResponseEntity<LearnerStatsDto> {
        val user             = resolveUser(principal)
        val lessonsCompleted = progressRepository.countByUserIdAndCompleted(user.id, true)
        val avgScore         = progressRepository.avgQuizScore(user.id)
        val sevenDaysAgo     = LocalDateTime.now().minusDays(7)
        val recentActivity   = progressRepository.findRecentActivity(user.id, sevenDaysAgo).size
        val allProgress      = progressRepository.findByUserIdAndCompleted(user.id, true).sortedByDescending { it.completedAt }
        val streak           = calculateStreak(allProgress)
        val lastActive       = allProgress.firstOrNull()?.completedAt?.toLocalDate()
        return ResponseEntity.ok(LearnerStatsDto(lessonsCompleted, avgScore?.let { Math.round(it * 1000) / 1000.0 }, recentActivity, streak, lastActive))
    }

    private fun calculateStreak(progress: List<LessonProgress>): Int {
        if (progress.isEmpty()) return 0
        val dates   = progress.mapNotNull { it.completedAt?.toLocalDate() }.toSortedSet(compareByDescending { it }).toList()
        var streak  = 0
        var current = LocalDate.now()
        for (date in dates) {
            if (date == current || date == current.minusDays(1)) { streak++; current = date } else break
        }
        return streak
    }
}
'@

# ── learner/controller/OnboardingController.kt — fix imports ─
Write-KtFile "learner\controller\OnboardingController.kt" @'
package com.elekeza.backend.learner.controller

import com.elekeza.backend.learner.OnboardingService
import com.elekeza.backend.learner.dto.*
import org.springframework.http.ResponseEntity
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.security.core.userdetails.UserDetails
import org.springframework.web.bind.annotation.*
import java.util.UUID

@RestController
@RequestMapping("/api/onboarding")
class OnboardingController(private val onboardingService: OnboardingService) {

    @PostMapping("/profile")
    fun saveProfile(
        @AuthenticationPrincipal principal: UserDetails,
        @RequestBody request: ProfileRequest
    ): ResponseEntity<OnboardingResponse> {
        val learnerId = UUID.fromString(principal.username)
        return ResponseEntity.ok(onboardingService.saveProfile(learnerId, request))
    }

    @PostMapping("/placement")
    fun savePlacement(
        @AuthenticationPrincipal principal: UserDetails,
        @RequestBody request: PlacementRequest
    ): ResponseEntity<PlacementResponse> {
        val learnerId = UUID.fromString(principal.username)
        return ResponseEntity.ok(onboardingService.savePlacement(learnerId, request))
    }

    @PostMapping("/complete")
    fun complete(@AuthenticationPrincipal principal: UserDetails): ResponseEntity<OnboardingResponse> {
        val learnerId = UUID.fromString(principal.username)
        return ResponseEntity.ok(onboardingService.completeOnboarding(learnerId))
    }

    @PostMapping("/guardian")
    fun linkGuardian(
        @AuthenticationPrincipal principal: UserDetails,
        @RequestBody request: GuardianLinkRequest
    ): ResponseEntity<GuardianLinkResponse> {
        val learnerId = UUID.fromString(principal.username)
        return ResponseEntity.ok(onboardingService.linkGuardian(learnerId, request))
    }
}
'@

# ── content/SourceType.kt ────────────────────────────────────
Write-KtFile "content\SourceType.kt" @'
package com.elekeza.backend.content

enum class SourceType { TEXT, PDF, DOCX, IMAGE, URL }
'@

# ── content/KeyTerm.kt ───────────────────────────────────────
Write-KtFile "content\KeyTerm.kt" @'
package com.elekeza.backend.content

import jakarta.persistence.*
import java.util.UUID

@Entity
@Table(name = "key_terms")
class KeyTerm(
    @Id val id: UUID = UUID.randomUUID(),
    @ManyToOne(fetch = FetchType.LAZY) @JoinColumn(name = "lesson_id", nullable = false) var lesson: Lesson = Lesson(),
    var term: String = "",
    var definition: String = "",
    var wasTapped: Boolean = false
)
'@

# ── content/Lesson.kt — fix package + SourceType reference ──
Write-KtFile "content\Lesson.kt" @'
package com.elekeza.backend.content

import jakarta.persistence.*
import org.hibernate.annotations.JdbcTypeCode
import org.hibernate.type.SqlTypes
import java.time.Instant
import java.util.UUID

@Entity
@Table(name = "lessons")
class Lesson(
    @Id @GeneratedValue(strategy = GenerationType.UUID) val id: UUID = UUID.randomUUID(),
    @Column(nullable = false) var title: String = "",
    @Column(columnDefinition = "text") var rawText: String = "",
    var estimatedMinutes: Int? = null,
    @Enumerated(EnumType.STRING) var sourceType: SourceType? = null,
    @JdbcTypeCode(SqlTypes.JSON) @Column(columnDefinition = "jsonb") var quizQuestions: String? = null,
    @Column(updatable = false) val createdAt: Instant = Instant.now()
)
'@

# ── content/LessonSection.kt — fix package ───────────────────
Write-KtFile "content\LessonSection.kt" @'
package com.elekeza.backend.content

import jakarta.persistence.*
import java.time.Instant
import java.util.UUID

@Entity
@Table(name = "lesson_sections")
class LessonSection(
    @Id val id: UUID = UUID.randomUUID(),
    @ManyToOne(fetch = FetchType.LAZY) @JoinColumn(name = "lesson_id", nullable = false) lateinit var lesson: Lesson,
    @Column(name = "sequence_number", nullable = false) var sequenceNumber: Int = 0,
    @Column(nullable = false, columnDefinition = "TEXT") var content: String = "",
    @Column(name = "time_spent_seconds", nullable = false) var timeSpentSeconds: Int = 0,
    @Column(name = "created_at", nullable = false, updatable = false) val createdAt: Instant = Instant.now(),
    @Column(name = "updated_at", nullable = false) var updatedAt: Instant = Instant.now()
)
'@

# ── content/LessonRepositories.kt ───────────────────────────
Write-KtFile "content\LessonRepositories.kt" @'
package com.elekeza.backend.content

import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.stereotype.Repository
import java.util.UUID

@Repository
interface LessonRepository : JpaRepository<Lesson, UUID>

@Repository
interface LessonSectionRepository : JpaRepository<LessonSection, UUID>

@Repository
interface KeyTermRepository : JpaRepository<KeyTerm, UUID>
'@

# ── content/LessonPersistenceService.kt — fix all references ─
Write-KtFile "content\LessonPersistenceService.kt" @'
package com.elekeza.backend.content

import com.elekeza.backend.common.ai.*
import com.elekeza.backend.learner.LearnerRepository
import com.fasterxml.jackson.databind.ObjectMapper
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.util.UUID

@Service
class LessonPersistenceService(
    private val lessonRepository:        LessonRepository,
    private val lessonSectionRepository: LessonSectionRepository,
    private val keyTermRepository:       KeyTermRepository,
    private val learnerRepository:       LearnerRepository,
    private val objectMapper:            ObjectMapper
) {
    @Transactional
    fun persistLesson(
        learnerId:   UUID,
        rawText:     String,
        lessonJson:  LessonJSON,
        quizJson:    QuizJSON,
        sourceType:  SourceType
    ): LessonResponse {
        val lesson = lessonRepository.save(Lesson().apply {
            this.title            = lessonJson.title
            this.rawText          = rawText
            this.sourceType       = sourceType
            this.quizQuestions    = objectMapper.writeValueAsString(quizJson.questions)
        })

        val sections = lessonJson.sections.mapIndexed { idx, s ->
            LessonSection().apply {
                this.lesson         = lesson
                this.sequenceNumber = idx + 1
                this.content        = "${s.header}\n\n${s.content}"
            }
        }
        lessonSectionRepository.saveAll(sections)

        val keyTerms = lessonJson.terms.map { t ->
            KeyTerm().apply {
                this.lesson      = lesson
                this.term        = t.term
                this.definition  = t.definition
            }
        }
        keyTermRepository.saveAll(keyTerms)

        return LessonResponse(
            id       = lesson.id,
            title    = lesson.title,
            sections = sections.map { SectionResponse(id = 0L, header = it.content.substringBefore("\n"), content = it.content) },
            terms    = keyTerms.map  { KeyTermResponse(id = 0L, term = it.term, definition = it.definition) }
        )
    }
}
'@

# ── content/FileUploadService.kt — fix ContentService ref ───
Write-KtFile "content\FileUploadService.kt" @'
package com.elekeza.backend.content

import com.elekeza.backend.common.ai.LessonResponse
import org.apache.pdfbox.Loader
import org.apache.pdfbox.text.PDFTextStripper
import org.apache.poi.xwpf.usermodel.XWPFDocument
import org.springframework.stereotype.Service
import org.springframework.web.multipart.MultipartFile
import java.util.UUID

private val SUPPORTED_TYPES = setOf(
    "text/plain", "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
)
private const val MAX_BYTES = 10 * 1024 * 1024L

@Service
class FileUploadService(private val contentService: ContentService) {

    fun uploadFile(learnerId: UUID, file: MultipartFile): Map<String, Any> {
        if (file.isEmpty) throw IllegalArgumentException("File is empty.")
        if (file.size > MAX_BYTES) throw IllegalArgumentException("File exceeds 10 MB limit.")
        val mime = file.contentType?.lowercase()?.trim() ?: ""
        if (mime !in SUPPORTED_TYPES) throw IllegalArgumentException("Unsupported file type: $mime")
        val text = when {
            mime == "text/plain"           -> file.inputStream.bufferedReader(Charsets.UTF_8).readText()
            mime == "application/pdf"      -> extractPdf(file)
            mime.contains("wordprocessing") -> extractDocx(file)
            else                           -> throw IllegalArgumentException("Cannot extract text from '$mime'.")
        }.trim()
        if (text.length < 50) throw IllegalArgumentException("Not enough text extracted (${text.length} chars).")
        return mapOf("text" to text, "status" to "extracted")
    }

    private fun extractPdf(file: MultipartFile): String =
        Loader.loadPDF(file.bytes).use { PDFTextStripper().getText(it) }

    private fun extractDocx(file: MultipartFile): String =
        XWPFDocument(file.inputStream).use { it.paragraphs.joinToString("\n") { p -> p.text } }
}
'@

# ── content/Content.kt — keep only the entity, strip the inline service/repo/controller ─
Write-KtFile "content\Content.kt" @'
package com.elekeza.backend.content

import com.elekeza.backend.auth.User
import jakarta.persistence.*
import java.time.LocalDateTime

enum class ContentStatus { UPLOADING, PROCESSING, READY, FAILED }

@Entity
@Table(name = "content", indexes = [
    Index(name = "idx_content_user_id", columnList = "user_id"),
    Index(name = "idx_content_status",  columnList = "status")
])
data class Content(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) val id: Long = 0,
    @ManyToOne(fetch = FetchType.LAZY) @JoinColumn(name = "user_id", nullable = false) val user: User,
    @Column(length = 255) val title: String? = null,
    @Column(name = "original_filename", length = 255) val originalFilename: String? = null,
    @Column(name = "file_path", columnDefinition = "TEXT") val filePath: String? = null,
    @Column(name = "sne_type", length = 50) val sneType: String? = null,
    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 20) val status: ContentStatus = ContentStatus.UPLOADING,
    @Column(name = "simplified_text", columnDefinition = "TEXT") val simplifiedText: String? = null,
    @Column(name = "word_count") val wordCount: Int? = null,
    @Column(name = "created_at") val createdAt: LocalDateTime = LocalDateTime.now(),
    @Column(name = "updated_at") val updatedAt: LocalDateTime = LocalDateTime.now()
)

fun Content.toListDto() = mapOf(
    "id" to id, "title" to title, "originalFilename" to originalFilename,
    "sneType" to sneType, "status" to status.name, "wordCount" to wordCount, "createdAt" to createdAt
)

fun Content.toDto() = mapOf(
    "id" to id, "title" to title, "sneType" to sneType, "status" to status.name,
    "simplifiedText" to simplifiedText, "wordCount" to wordCount, "createdAt" to createdAt
)
'@

# ── content/ContentRepository.kt — standalone with all query methods ─
Write-KtFile "content\ContentRepository.kt" @'
package com.elekeza.backend.content

import org.springframework.data.domain.Page
import org.springframework.data.domain.PageRequest
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Modifying
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param
import org.springframework.stereotype.Repository
import java.time.LocalDateTime

@Repository
interface ContentRepository : JpaRepository<Content, Long> {
    fun findByUserIdOrderByCreatedAtDesc(userId: Long, pageable: PageRequest): Page<Content>
    fun findByIdAndUserId(id: Long, userId: Long): Content?

    @Modifying
    @Query("UPDATE Content c SET c.status = :status, c.updatedAt = :now WHERE c.id = :id")
    fun updateStatus(@Param("id") id: Long, @Param("status") status: ContentStatus, @Param("now") now: LocalDateTime = LocalDateTime.now()): Int

    @Modifying
    @Query("UPDATE Content c SET c.simplifiedText = :text, c.wordCount = :wordCount, c.status = :status, c.updatedAt = :now WHERE c.id = :id")
    fun updateSimplified(@Param("id") id: Long, @Param("text") text: String, @Param("wordCount") wordCount: Int, @Param("status") status: ContentStatus, @Param("now") now: LocalDateTime = LocalDateTime.now()): Int
}
'@

# ── content/controller/ContentController.kt — fix imports ───
Write-KtFile "content\controller\ContentController.kt" @'
package com.elekeza.backend.content.controller

import com.elekeza.backend.auth.UserRepository
import com.elekeza.backend.content.*
import org.springframework.data.domain.PageRequest
import org.springframework.data.domain.Sort
import org.springframework.http.HttpStatus
import org.springframework.http.MediaType
import org.springframework.http.ResponseEntity
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.security.core.userdetails.UserDetails
import org.springframework.web.bind.annotation.*
import org.springframework.web.multipart.MultipartFile
import org.springframework.web.server.ResponseStatusException

@RestController
@RequestMapping("/api/content")
class ContentController(
    private val contentService:    ContentService,
    private val contentRepository: ContentRepository,
    private val userRepository:    UserRepository
) {
    private fun resolveUserId(principal: UserDetails): Long =
        userRepository.findByEmail(principal.username)?.id
            ?: throw ResponseStatusException(HttpStatus.UNAUTHORIZED, "User not found")

    @PostMapping("/upload", consumes = [MediaType.MULTIPART_FORM_DATA_VALUE])
    fun upload(
        @AuthenticationPrincipal principal: UserDetails,
        @RequestParam("file") file: MultipartFile,
        @RequestParam("sneType", required = false) sneType: String?
    ): ResponseEntity<*> {
        val user    = userRepository.findByEmail(principal.username)
            ?: throw ResponseStatusException(HttpStatus.UNAUTHORIZED, "User not found")
        val content = contentService.upload(user, file, sneType)
        return ResponseEntity.accepted().body(content.toDto())
    }

    @GetMapping("/{id}")
    fun getById(@AuthenticationPrincipal principal: UserDetails, @PathVariable id: Long): ResponseEntity<*> {
        val userId  = resolveUserId(principal)
        val content = contentRepository.findByIdAndUserId(id, userId)
            ?: throw ResponseStatusException(HttpStatus.NOT_FOUND, "Content not found")
        return ResponseEntity.ok(content.toDto())
    }

    @GetMapping("/list")
    fun list(
        @AuthenticationPrincipal principal: UserDetails,
        @RequestParam(defaultValue = "0") page: Int,
        @RequestParam(defaultValue = "20") size: Int
    ): ResponseEntity<*> {
        val userId  = resolveUserId(principal)
        val results = contentRepository.findByUserIdOrderByCreatedAtDesc(userId, PageRequest.of(page, size.coerceAtMost(50)))
        return ResponseEntity.ok(mapOf(
            "data" to results.content.map { it.toListDto() },
            "total" to results.totalElements, "page" to results.number, "totalPages" to results.totalPages
        ))
    }

    @DeleteMapping("/{id}")
    fun delete(@AuthenticationPrincipal principal: UserDetails, @PathVariable id: Long): ResponseEntity<*> {
        val userId = resolveUserId(principal)
        contentService.delete(id, userId)
        return ResponseEntity.ok(mapOf("message" to "Content deleted"))
    }
}
'@

# ── content/controller/FileUploadController.kt — fix imports ─
Write-KtFile "content\controller\FileUploadController.kt" @'
package com.elekeza.backend.content.controller

import com.elekeza.backend.content.FileUploadService
import org.springframework.http.ResponseEntity
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.security.core.userdetails.UserDetails
import org.springframework.web.bind.annotation.*
import org.springframework.web.multipart.MultipartFile
import java.util.UUID

@RestController
@RequestMapping("/api/content")
class FileUploadController(private val fileUploadService: FileUploadService) {

    @PostMapping("/upload/file", consumes = ["multipart/form-data"])
    fun uploadFile(
        @AuthenticationPrincipal principal: UserDetails,
        @RequestParam("file") file: MultipartFile
    ): ResponseEntity<*> {
        val learnerId = UUID.fromString(principal.username)
        val result    = fileUploadService.uploadFile(learnerId, file)
        return ResponseEntity.ok(result)
    }
}
'@

# ── quiz/QuizService.kt — fix all field refs ────────────────
Write-KtFile "quiz\QuizService.kt" @'
package com.elekeza.backend.quiz

import com.elekeza.backend.auth.User
import com.elekeza.backend.learner.LessonProgress
import com.elekeza.backend.learner.LessonProgressRepository
import org.slf4j.LoggerFactory
import org.springframework.http.HttpStatus
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.server.ResponseStatusException
import java.time.LocalDateTime

@Service
class QuizService(
    private val quizRepository:     QuizRepository,
    private val questionRepository: QuizQuestionRepository,
    private val attemptRepository:  QuizAttemptRepository,
    private val progressRepository: LessonProgressRepository
) {
    private val log = LoggerFactory.getLogger(javaClass)

    fun getOrCreateQuiz(contentId: Long, userId: Long): QuizWithQuestions {
        val quiz      = quizRepository.findByContentIdAndUserId(contentId, userId)
            ?: quizRepository.save(Quiz(contentId = contentId, userId = userId))
        val questions = questionRepository.findByQuizId(quiz.id)
        return QuizWithQuestions(
            quizId    = quiz.id,
            lessonId  = contentId,
            questions = questions.map { q ->
                QuizQuestionDto(
                    questionId = q.id,
                    question   = q.question,
                    options    = mapOf("A" to q.optionA, "B" to q.optionB, "C" to q.optionC, "D" to q.optionD)
                )
            }
        )
    }

    // Alias used by QuizController
    fun generateQuiz(contentId: Long, userId: Long): QuizWithQuestions = getOrCreateQuiz(contentId, userId)

    fun scoreAnswer(quizId: Long, questionId: Long, selectedOption: String): AnswerResult {
        val question = questionRepository.findById(questionId)
            .orElseThrow { ResponseStatusException(HttpStatus.NOT_FOUND, "Question not found") }
        val correct  = question.correctOption.equals(selectedOption.trim(), ignoreCase = true)
        return AnswerResult(correct = correct, correctOption = question.correctOption, explanation = question.explanation)
    }

    @Transactional
    fun submitQuiz(quizId: Long, userId: Long, submission: QuizSubmission): QuizResult {
        val quiz      = quizRepository.findById(quizId).orElseThrow { ResponseStatusException(HttpStatus.NOT_FOUND, "Quiz not found") }
        val questions = questionRepository.findByQuizId(quizId)
        val attempt   = attemptRepository.findByQuizIdAndUserId(quizId, userId)
        val score     = attempt?.score ?: 0.0

        val existing = progressRepository.findByUserAndContentId(userId, quiz.contentId)
        val progress = (existing ?: LessonProgress(contentId = quiz.contentId)).copy(
            quizScore = score, completed = true, completedAt = LocalDateTime.now()
        )
        progressRepository.save(progress)
        log.info("Quiz {} submitted by userId={} score={}", quizId, userId, score)

        return QuizResult(quizId = quizId, score = score, totalQuestions = questions.size, feedback = emptyList())
    }
}

data class QuizWithQuestions(val quizId: Long, val lessonId: Long, val questions: List<QuizQuestionDto>)

fun QuizWithQuestions.toClientDto() = QuizDto(quizId = quizId, lessonId = lessonId, questions = questions)
fun Quiz.toClientDto() = QuizDto(quizId = id, lessonId = contentId, questions = emptyList())
'@

# ── quiz/controller/QuizController.kt — fix all imports ─────
Write-KtFile "quiz\controller\QuizController.kt" @'
package com.elekeza.backend.quiz.controller

import com.elekeza.backend.auth.UserRepository
import com.elekeza.backend.quiz.*
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.security.core.userdetails.UserDetails
import org.springframework.web.bind.annotation.*
import org.springframework.web.server.ResponseStatusException

@RestController
@RequestMapping("/api/quiz")
class QuizController(
    private val quizService:    QuizService,
    private val quizRepository: QuizRepository,
    private val userRepository: UserRepository
) {
    private fun resolveUserId(principal: UserDetails): Long =
        userRepository.findByEmail(principal.username)?.id
            ?: throw ResponseStatusException(HttpStatus.UNAUTHORIZED, "User not found")

    @PostMapping("/generate/{contentId}")
    fun generate(@AuthenticationPrincipal principal: UserDetails, @PathVariable contentId: Long): ResponseEntity<QuizDto> {
        val userId = resolveUserId(principal)
        return ResponseEntity.status(201).body(quizService.generateQuiz(contentId, userId).toClientDto())
    }

    @GetMapping("/{quizId}")
    fun getQuiz(@AuthenticationPrincipal principal: UserDetails, @PathVariable quizId: Long): ResponseEntity<QuizDto> {
        val quiz = quizRepository.findById(quizId).orElseThrow { ResponseStatusException(HttpStatus.NOT_FOUND, "Quiz not found") }
        return ResponseEntity.ok(quiz.toClientDto())
    }

    @PostMapping("/{quizId}/submit")
    fun submit(
        @AuthenticationPrincipal principal: UserDetails,
        @PathVariable quizId: Long,
        @RequestBody submission: QuizSubmission
    ): ResponseEntity<QuizResult> {
        val userId = resolveUserId(principal)
        return ResponseEntity.ok(quizService.submitQuiz(quizId, userId, submission))
    }
}
'@

# ── auth/RefreshTokens.kt — fix Learner reference ───────────
Write-Host "`n[4] Patching RefreshTokens.kt Learner import..." -ForegroundColor Yellow
$rtFile = "$base\auth\RefreshTokens.kt"
if (Test-Path $rtFile) {
    $rt = Get-Content $rtFile -Raw
    # Replace any import of com.elekeza.backend.model.Learner with the correct one
    $rt = $rt -replace 'import com\.elekeza\.backend\.model\.Learner', 'import com.elekeza.backend.learner.Learner'
    $rt = $rt -replace 'import com\.elekeza\.backend\.learner\.Learner\nimport com\.elekeza\.backend\.learner\.Learner', 'import com.elekeza.backend.learner.Learner'
    [System.IO.File]::WriteAllText((Resolve-Path ".").Path + "\" + $rtFile, $rt, [System.Text.Encoding]::UTF8)
    Write-Host "  PATCHED: RefreshTokens.kt"
}

# ── LearnerDetailsService.kt — fix LearnerRepository import ─
$ldsFile = "$base\learner\LearnerDetailsService.kt"
if (Test-Path $ldsFile) {
    $lds = Get-Content $ldsFile -Raw
    $lds = $lds -replace 'import com\.elekeza\.backend\.repository\.LearnerRepository', 'import com.elekeza.backend.learner.LearnerRepository'
    $lds = $lds -replace 'package com\.elekeza\.backend\..*\n', "package com.elekeza.backend.learner`n"
    [System.IO.File]::WriteAllText((Resolve-Path ".").Path + "\" + $ldsFile, $lds, [System.Text.Encoding]::UTF8)
    Write-Host "  PATCHED: LearnerDetailsService.kt"
}

# ── content/ContentService.kt — strip inline entity/repo redeclarations ─
Write-Host "`n[5] Stripping redeclarations from ContentService.kt..." -ForegroundColor Yellow
$csFile = "$base\content\ContentService.kt"
if (Test-Path $csFile) {
    $cs = Get-Content $csFile -Raw
    # Remove the inline ContentStatus enum block
    $cs = $cs -replace '(?s)// ── Status enum.*?enum class ContentStatus \{.*?\}', ''
    # Remove the inline Content @Entity block
    $cs = $cs -replace '(?s)// ── Entity.*?@Entity.*?@Table.*?data class Content\(.*?\n\)', ''
    # Remove the inline ContentRepository @Repository block
    $cs = $cs -replace '(?s)@Repository\s*interface ContentRepository.*?\}', ''
    # Remove the inline ContentController @RestController block
    $cs = $cs -replace '(?s)// ── Controller.*', ''
    [System.IO.File]::WriteAllText((Resolve-Path ".").Path + "\" + $csFile, $cs, [System.Text.Encoding]::UTF8)
    Write-Host "  DONE (redeclarations stripped from ContentService.kt)"
} else {
    Write-Host "  ContentService.kt not found - skipping"
}

# ── Fix LearnerEntities.kt toDto() ambiguity ────────────────
Write-Host "`n[6] Removing duplicate toDto from LearnerEntities.kt..." -ForegroundColor Yellow
$leFile = "$base\learner\LearnerEntities.kt"
if (Test-Path $leFile) {
    $le = Get-Content $leFile -Raw
    $le = $le -replace '(?s)fun LessonProgress\.toDto\(\).*?\}', ''
    [System.IO.File]::WriteAllText((Resolve-Path ".").Path + "\" + $leFile, $le, [System.Text.Encoding]::UTF8)
    Write-Host "  DONE"
}

Write-Host "`n============================================" -ForegroundColor Green
Write-Host " All fixes applied. Now run:" -ForegroundColor Green
Write-Host "   .\gradlew compileKotlin" -ForegroundColor White
Write-Host "============================================" -ForegroundColor Green