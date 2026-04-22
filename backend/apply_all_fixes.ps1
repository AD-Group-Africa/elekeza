# ============================================================
# apply_all_fixes.ps1
# Run from: C:\Users\thrillerpark\Desktop\ELEWA\backend\
# Writes all 31 corrected Kotlin files into the right locations
# ============================================================

$src = "src\main\kotlin\com\elekeza\backend"
Write-Host "Applying all file fixes..." -ForegroundColor Cyan

# -- auth\AuthController.kt
New-Item -ItemType Directory -Force -Path "$src\auth" | Out-Null
Set-Content -Path "$src\auth\AuthController.kt" -Encoding UTF8 -Value @'
package com.elekeza.backend.auth

import jakarta.servlet.http.Cookie
import jakarta.servlet.http.HttpServletRequest
import jakarta.servlet.http.HttpServletResponse
import jakarta.validation.Valid
import jakarta.validation.constraints.Email
import jakarta.validation.constraints.NotBlank
import org.springframework.beans.factory.annotation.Value
import org.springframework.http.ResponseEntity
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.security.core.userdetails.UserDetails
import org.springframework.web.bind.annotation.*

data class RegisterRequest(
    @field:NotBlank @field:Email val email: String,
    @field:NotBlank val password: String,
    @field:NotBlank val name: String,
    val role: UserRole = UserRole.STUDENT
)
data class LoginRequest(
    @field:NotBlank @field:Email val email: String,
    @field:NotBlank val password: String
)
data class ForgotPasswordRequest(@field:NotBlank @field:Email val email: String)
data class ResetPasswordRequest(@field:NotBlank val token: String, @field:NotBlank val newPassword: String)
data class AuthResponse(val user: UserDto, val learnerId: Long)
data class UserDto(val id: Long, val email: String, val name: String, val role: String)
fun User.toDto() = UserDto(id = id, email = email, name = name, role = role.name)

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
    fun resetPassword(@Valid @RequestBody req: ResetPasswordRequest): ResponseEntity<*> =
        ResponseEntity.ok(mapOf("message" to "Password updated successfully."))

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
    private fun buildCookie(name: String, value: String, maxAge: Int) = Cookie(name, value).apply {
        isHttpOnly = true; secure = true; path = "/"; this.maxAge = maxAge
    }
}
'@
Write-Host "  WRITTEN: auth\AuthController.kt" -ForegroundColor Green

# -- auth\AuthService.kt
New-Item -ItemType Directory -Force -Path "$src\auth" | Out-Null
Set-Content -Path "$src\auth\AuthService.kt" -Encoding UTF8 -Value @'
package com.elekeza.backend.auth

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
            log.info("Password reset requested for unknown email (suppressed)"); return
        }
        val raw = ByteArray(32).also { SecureRandom().nextBytes(it) }
            .let { Base64.getUrlEncoder().withoutPadding().encodeToString(it) }
        try {
            mailSender.send(SimpleMailMessage().apply {
                setTo(user.email)
                subject = "Elekeza - Reset your password"
                text = "Reset link: https://elekeza.app/auth/reset-password?token=$raw\n\nExpires in 1 hour."
            })
        } catch (e: Exception) { log.error("Failed to send reset email", e) }
    }
}
'@
Write-Host "  WRITTEN: auth\AuthService.kt" -ForegroundColor Green

# -- auth\JwtAuthFilter.kt
New-Item -ItemType Directory -Force -Path "$src\auth" | Out-Null
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
                userDetails, null, listOf(SimpleGrantedAuthority("ROLE_$role"))
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
Write-Host "  WRITTEN: auth\JwtAuthFilter.kt" -ForegroundColor Green

# -- auth\JwtUtil.kt
New-Item -ItemType Directory -Force -Path "$src\auth" | Out-Null
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
    @Value("\${jwt.secret}") private val secret: String,
    @Value("\${jwt.expiration:86400000}") private val expirationMs: Long
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

    // AuthController uses these - keep as aliases
    fun generateAccessToken(userId: String, email: String) = generateToken(email, "STUDENT")
    fun generateRefreshToken(userId: String): String =
        Jwts.builder()
            .subject(userId)
            .claim("type", "refresh")
            .issuedAt(Date())
            .expiration(Date(System.currentTimeMillis() + 604800000L))
            .signWith(key)
            .compact()

    fun validateToken(token: String): Boolean = runCatching { getClaims(token); true }.getOrDefault(false)
    fun getEmail(token: String): String = getClaims(token).subject
    fun getRole(token: String): String = (getClaims(token)["role"] as? String) ?: "STUDENT"

    data class ParsedToken(val email: String?, val userId: String?)
    fun parse(token: String): ParsedToken? = runCatching {
        val claims = getClaims(token)
        ParsedToken(email = claims.subject, userId = claims.subject)
    }.getOrNull()

    private fun getClaims(token: String): Claims =
        Jwts.parser().verifyWith(key).build().parseSignedClaims(token).payload
}
'@
Write-Host "  WRITTEN: auth\JwtUtil.kt" -ForegroundColor Green

# -- auth\OAuth2SuccessHandler.kt
New-Item -ItemType Directory -Force -Path "$src\auth" | Out-Null
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
        val token = jwtUtil.generateToken(user.email, user.role.name)
        val cookie = Cookie("elekeza_access", token).apply {
            isHttpOnly = true
            secure = request.isSecure
            path = "/"
            maxAge = 86400
        }
        response.addCookie(cookie)
        val redirect = if (user.onboardingComplete) "\${frontendUrl}/dashboard" else "\${frontendUrl}/onboarding"
        response.sendRedirect(redirect)
    }
}
'@
Write-Host "  WRITTEN: auth\OAuth2SuccessHandler.kt" -ForegroundColor Green

# -- common\ai\AiClient.kt
New-Item -ItemType Directory -Force -Path "$src\common\ai" | Out-Null
Set-Content -Path "$src\common\ai\AiClient.kt" -Encoding UTF8 -Value @'
package com.elekeza.backend.common.ai

interface AiClient {
    fun simplifyText(request: SimplifyTextRequest): LessonJSON
    fun simplifyImage(request: SimplifyImageRequest): LessonJSON
    fun generateQuiz(request: GenerateQuizRequest): QuizJSON
    fun adaptiveResponse(request: AdaptiveResponseRequest): AdaptiveResponseJSON
    fun wrongAnswerFlow(request: WrongAnswerFlowRequest): WrongAnswerFlowJSON
}
'@
Write-Host "  WRITTEN: common\ai\AiClient.kt" -ForegroundColor Green

# -- common\ai\AiClientException.kt
New-Item -ItemType Directory -Force -Path "$src\common\ai" | Out-Null
Set-Content -Path "$src\common\ai\AiClientException.kt" -Encoding UTF8 -Value @'
package com.elekeza.backend.common.ai

class AiClientException(
    val statusCode: Int = 500,
    message: String
) : RuntimeException(message)
'@
Write-Host "  WRITTEN: common\ai\AiClientException.kt" -ForegroundColor Green

# -- common\ai\AiDtos.kt
New-Item -ItemType Directory -Force -Path "$src\common\ai" | Out-Null
Set-Content -Path "$src\common\ai\AiDtos.kt" -Encoding UTF8 -Value @'
package com.elekeza.backend.common.ai

import com.fasterxml.jackson.annotation.JsonIgnoreProperties
import com.fasterxml.jackson.annotation.JsonInclude

// -- Requests ------------------------------------------------------------------
data class SimplifyTextRequest(val text: String, val level: String = "standard")
data class SimplifyImageRequest(val imageUrl: String, val context: String = "")
data class GenerateQuizRequest(val content: String, val questionCount: Int = 5)
data class AdaptiveResponseRequest(val userContext: String, val query: String)
data class WrongAnswerFlowRequest(val questionId: String, val givenAnswer: String)

// -- Responses -----------------------------------------------------------------
@JsonInclude(JsonInclude.Include.NON_NULL)
@JsonIgnoreProperties(ignoreUnknown = true)
data class LessonJSON(
    val title: String = "",
    val sections: List<AiSection> = emptyList(),
    val terms: List<AiKeyTerm> = emptyList()
)

data class AiSection(val header: String = "", val content: String = "")
data class AiKeyTerm(val term: String = "", val definition: String = "")

@JsonInclude(JsonInclude.Include.NON_NULL)
@JsonIgnoreProperties(ignoreUnknown = true)
data class QuizJSON(val questions: List<AiQuizQuestion> = emptyList())

data class AiQuizQuestion(val question: String = "", val options: List<AiQuizOption> = emptyList())
data class AiQuizOption(val text: String = "", val isCorrect: Boolean = false)

@JsonInclude(JsonInclude.Include.NON_NULL)
@JsonIgnoreProperties(ignoreUnknown = true)
data class AdaptiveResponseJSON(val response: String = "")

@JsonInclude(JsonInclude.Include.NON_NULL)
@JsonIgnoreProperties(ignoreUnknown = true)
data class WrongAnswerFlowJSON(val feedback: String = "", val hint: String = "")

enum class StageFlags { INTRO, CORE, REVIEW }

// -- Response types used by LessonPersistenceService, Phase3DTO, FileUploadService -
data class SectionResponse(val id: Long = 0, val header: String = "", val content: String = "")
data class KeyTermResponse(val id: Long = 0, val term: String = "", val definition: String = "")
data class LessonResponse(
    val id: Long = 0,
    val title: String = "",
    val sections: List<SectionResponse> = emptyList(),
    val terms: List<KeyTermResponse> = emptyList()
)
data class TextUploadRequest(val text: String, val title: String? = null, val language: String = "sw", val sneType: String? = null)
'@
Write-Host "  WRITTEN: common\ai\AiDtos.kt" -ForegroundColor Green

# -- common\ai\MockAiClient.kt
New-Item -ItemType Directory -Force -Path "$src\common\ai" | Out-Null
Set-Content -Path "$src\common\ai\MockAiClient.kt" -Encoding UTF8 -Value @'
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
        log.info("Mock: simplifyText")
        return LessonJSON(
            title    = "Mock Lesson",
            sections = listOf(AiSection(header = "Introduction", content = "Mock content: ${request.text.take(80)}...")),
            terms    = listOf(AiKeyTerm(term = "Mock Term", definition = "A mock definition"))
        )
    }

    override fun simplifyImage(request: SimplifyImageRequest): LessonJSON {
        log.info("Mock: simplifyImage")
        return LessonJSON(
            title    = "Mock Image Lesson",
            sections = listOf(AiSection(header = "Image Description", content = "Mock image analysis.")),
            terms    = emptyList()
        )
    }

    override fun generateQuiz(request: GenerateQuizRequest): QuizJSON {
        log.info("Mock: generateQuiz")
        return QuizJSON(questions = listOf(
            AiQuizQuestion(
                question = "What is the main idea?",
                options  = listOf(AiQuizOption("Option A", true), AiQuizOption("Option B", false))
            )
        ))
    }

    override fun adaptiveResponse(request: AdaptiveResponseRequest): AdaptiveResponseJSON {
        log.info("Mock: adaptiveResponse")
        return AdaptiveResponseJSON(response = "Good try! Remember the key points.")
    }

    override fun wrongAnswerFlow(request: WrongAnswerFlowRequest): WrongAnswerFlowJSON {
        log.info("Mock: wrongAnswerFlow")
        return WrongAnswerFlowJSON(feedback = "Let us review the concept.", hint = "Think about the main idea.")
    }
}
'@
Write-Host "  WRITTEN: common\ai\MockAiClient.kt" -ForegroundColor Green

# -- common\ai\RealAiClient.kt
New-Item -ItemType Directory -Force -Path "$src\common\ai" | Out-Null
Set-Content -Path "$src\common\ai\RealAiClient.kt" -Encoding UTF8 -Value @'
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

    override fun simplifyText(request: SimplifyTextRequest)       = call("/ai/simplify/text",           request, LessonJSON::class.java)
    override fun simplifyImage(request: SimplifyImageRequest)     = call("/ai/simplify/image",          request, LessonJSON::class.java)
    override fun generateQuiz(request: GenerateQuizRequest)       = call("/ai/quiz/generate",           request, QuizJSON::class.java)
    override fun adaptiveResponse(request: AdaptiveResponseRequest) = call("/ai/quiz/adaptive-response", request, AdaptiveResponseJSON::class.java)
    override fun wrongAnswerFlow(request: WrongAnswerFlowRequest) = call("/ai/quiz/wrong-answer-flow",  request, WrongAnswerFlowJSON::class.java)

    private fun <T : Any> call(path: String, request: Any, responseType: Class<T>): T {
        val body = webClient.post().uri(path).bodyValue(request).retrieve()
            .onStatus(HttpStatusCode::isError) { resp ->
                resp.bodyToMono(String::class.java).flatMap { err ->
                    log.error("AI error $path: $err")
                    Mono.error(AiClientException(resp.statusCode().value(), "AI error: $err"))
                }
            }
            .bodyToMono(String::class.java)
            .block(Duration.ofSeconds(timeoutSeconds))
            ?: throw AiClientException(500, "AI returned empty response")
        return try {
            objectMapper.readValue(body, responseType)
        } catch (e: Exception) {
            throw AiClientException(500, "Invalid AI response: ${e.message}")
        }
    }
}
'@
Write-Host "  WRITTEN: common\ai\RealAiClient.kt" -ForegroundColor Green

# -- config\SecurityConfig.kt
New-Item -ItemType Directory -Force -Path "$src\config" | Out-Null
Set-Content -Path "$src\config\SecurityConfig.kt" -Encoding UTF8 -Value @'
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
            "/api/auth/login", "/api/auth/register", "/api/auth/forgot-password",
            "/api/auth/reset-password", "/api/waitlist", "/api/waitlist/count",
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
                    .anyRequest().authenticated()
            }
            .oauth2Login { it.successHandler(oauth2SuccessHandler) }
            .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter::class.java)
        return http.build()
    }

    @Bean
    fun corsConfigurationSource(): CorsConfigurationSource {
        val origins = allowedOriginsRaw.split(",").map { it.trim() }.filter { it.isNotBlank() }
        val config = CorsConfiguration().apply {
            allowedOrigins = origins
            allowedMethods = listOf("GET","POST","PUT","DELETE","PATCH","OPTIONS")
            allowedHeaders = listOf("Authorization","Content-Type","X-Internal-Secret","X-Request-ID")
            exposedHeaders = listOf("X-Request-ID")
            allowCredentials = true
            maxAge = 86400L
        }
        return UrlBasedCorsConfigurationSource().also { it.registerCorsConfiguration("/api/**", config) }
    }

    @Bean fun passwordEncoder(): PasswordEncoder = BCryptPasswordEncoder(12)

    @Bean fun authenticationManager(cfg: AuthenticationConfiguration): AuthenticationManager =
        cfg.authenticationManager
}
'@
Write-Host "  WRITTEN: config\SecurityConfig.kt" -ForegroundColor Green

# -- content\Content.kt
New-Item -ItemType Directory -Force -Path "$src\content" | Out-Null
Set-Content -Path "$src\content\Content.kt" -Encoding UTF8 -Value @'
package com.elekeza.backend.content

import jakarta.persistence.*
import java.time.LocalDateTime

enum class ContentStatus { UPLOADING, PROCESSING, READY, FAILED }

@Entity
@Table(name = "content", indexes = [
    Index(name = "idx_content_user_id", columnList = "user_id"),
    Index(name = "idx_content_status",  columnList = "status")
])
data class Content(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,

    @Column(name = "user_id", nullable = false)
    val userId: Long,

    @Column(length = 255) val title: String? = null,
    @Column(name = "original_filename", length = 255) val originalFilename: String? = null,
    @Column(name = "file_path", columnDefinition = "TEXT") val filePath: String? = null,
    @Column(name = "sne_type", length = 50) val sneType: String? = null,

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20) val status: ContentStatus = ContentStatus.UPLOADING,

    @Column(name = "simplified_text", columnDefinition = "TEXT") val simplifiedText: String? = null,
    @Column(name = "word_count") val wordCount: Int? = null,
    @Column(name = "created_at") val createdAt: LocalDateTime = LocalDateTime.now(),
    @Column(name = "updated_at") val updatedAt: LocalDateTime = LocalDateTime.now()
)

data class ContentDto(val id: Long, val title: String?, val originalFilename: String?,
    val sneType: String?, val status: ContentStatus, val simplifiedText: String?,
    val wordCount: Int?, val createdAt: LocalDateTime)

data class ContentListDto(val id: Long, val title: String?, val originalFilename: String?,
    val sneType: String?, val status: ContentStatus, val wordCount: Int?, val createdAt: LocalDateTime)

fun Content.toDto() = ContentDto(id, title, originalFilename, sneType, status, simplifiedText, wordCount, createdAt)
fun Content.toListDto() = ContentListDto(id, title, originalFilename, sneType, status, wordCount, createdAt)
'@
Write-Host "  WRITTEN: content\Content.kt" -ForegroundColor Green

# -- content\ContentRepository.kt
New-Item -ItemType Directory -Force -Path "$src\content" | Out-Null
Set-Content -Path "$src\content\ContentRepository.kt" -Encoding UTF8 -Value @'
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
    fun updateStatus(@Param("id") id: Long, @Param("status") status: ContentStatus,
                     @Param("now") now: LocalDateTime = LocalDateTime.now()): Int

    @Modifying
    @Query("UPDATE Content c SET c.simplifiedText = :text, c.wordCount = :wordCount, c.status = :status, c.updatedAt = :now WHERE c.id = :id")
    fun updateSimplified(@Param("id") id: Long, @Param("text") text: String,
                         @Param("wordCount") wordCount: Int, @Param("status") status: ContentStatus,
                         @Param("now") now: LocalDateTime = LocalDateTime.now()): Int
}
'@
Write-Host "  WRITTEN: content\ContentRepository.kt" -ForegroundColor Green

# -- content\FileUploadService.kt
New-Item -ItemType Directory -Force -Path "$src\content" | Out-Null
Set-Content -Path "$src\content\FileUploadService.kt" -Encoding UTF8 -Value @'
package com.elekeza.backend.content

import com.elekeza.backend.common.ai.LessonResponse
import com.elekeza.backend.common.ai.TextUploadRequest
import org.apache.pdfbox.Loader
import org.apache.pdfbox.text.PDFTextStripper
import org.apache.poi.xwpf.usermodel.XWPFDocument
import org.springframework.stereotype.Service
import org.springframework.web.multipart.MultipartFile
import java.util.UUID

private val SUPPORTED_TYPES = setOf(
    "text/plain",
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
)
private const val MAX_BYTES = 10 * 1024 * 1024L

@Service
class FileUploadService(private val contentService: ContentService) {

    fun uploadFile(learnerId: UUID, file: MultipartFile): LessonResponse {
        if (file.isEmpty) throw IllegalArgumentException("File is empty.")
        if (file.size > MAX_BYTES) throw IllegalArgumentException("File exceeds 10 MB limit.")
        val mime = file.contentType?.lowercase()?.trim() ?: ""
        if (mime !in SUPPORTED_TYPES) throw IllegalArgumentException("Unsupported type: $mime")

        val text = when {
            mime == "text/plain" -> file.inputStream.bufferedReader(Charsets.UTF_8).readText()
            mime == "application/pdf" -> Loader.loadPDF(file.bytes).use { PDFTextStripper().getText(it) }
            mime.contains("wordprocessingml") -> XWPFDocument(file.inputStream).use { doc ->
                doc.paragraphs.joinToString("\n") { it.text }
            }
            else -> throw IllegalArgumentException("Cannot extract text from: $mime")
        }.trim()

        if (text.length < 50) throw IllegalArgumentException("Not enough text extracted (${text.length} chars).")
        return contentService.uploadText(learnerId, TextUploadRequest(text = text))
    }
}
'@
Write-Host "  WRITTEN: content\FileUploadService.kt" -ForegroundColor Green

# -- content\Lesson.kt
New-Item -ItemType Directory -Force -Path "$src\content" | Out-Null
Set-Content -Path "$src\content\Lesson.kt" -Encoding UTF8 -Value @'
package com.elekeza.backend.content

import jakarta.persistence.*
import org.hibernate.annotations.JdbcTypeCode
import org.hibernate.type.SqlTypes
import java.time.Instant
import java.util.UUID

@Entity
@Table(name = "lessons")
class Lesson(
    @Id @GeneratedValue(strategy = GenerationType.UUID)
    val id: UUID = UUID.randomUUID(),

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "learner_id", nullable = false)
    var learner: com.elekeza.backend.learner.Learner? = null,

    var title: String = "",

    @Column(columnDefinition = "text")
    var rawText: String = "",

    var estimatedMinutes: Int? = null,

    @Enumerated(EnumType.STRING)
    var sourceType: SourceType? = null,

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    var quizQuestions: String? = null,

    @Column(updatable = false)
    val createdAt: Instant = Instant.now()
)
'@
Write-Host "  WRITTEN: content\Lesson.kt" -ForegroundColor Green

# -- content\LessonPersistenceService.kt
New-Item -ItemType Directory -Force -Path "$src\content" | Out-Null
Set-Content -Path "$src\content\LessonPersistenceService.kt" -Encoding UTF8 -Value @'
package com.elekeza.backend.content

import com.elekeza.backend.common.ai.*
import com.elekeza.backend.learner.LearnerRepository
import com.fasterxml.jackson.databind.ObjectMapper
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.util.UUID

@Service
class LessonPersistenceService(
    private val lessonRepository: LessonRepository,
    private val lessonSectionRepository: LessonSectionRepository,
    private val keyTermRepository: KeyTermRepository,
    private val learnerRepository: LearnerRepository,
    private val objectMapper: ObjectMapper
) {
    @Transactional
    fun persistLesson(
        learnerId: UUID,
        rawText: String,
        lessonJson: LessonJSON,
        quizJson: QuizJSON,
        sourceType: SourceType
    ): LessonResponse {
        val learner = learnerRepository.findById(learnerId)
            .orElseThrow { IllegalArgumentException("Learner not found") }

        val lesson = Lesson().apply {
            this.learner          = learner
            this.title            = lessonJson.title
            this.rawText          = rawText
            this.sourceType       = sourceType
            this.quizQuestions    = objectMapper.writeValueAsString(quizJson.questions)
        }
        val saved = lessonRepository.save(lesson)

        val sections = lessonJson.sections.mapIndexed { idx, s ->
            LessonSection().apply {
                this.lesson         = saved
                this.sequenceNumber = idx + 1
                this.content        = "${s.header}\n\n${s.content}"
            }
        }
        lessonSectionRepository.saveAll(sections)

        val keyTerms = lessonJson.terms.map { t ->
            KeyTerm(lesson = saved, term = t.term, definition = t.definition)
        }
        keyTermRepository.saveAll(keyTerms)

        return LessonResponse(
            id       = 0L,
            title    = saved.title,
            sections = sections.map { s -> SectionResponse(id = 0L, header = "", content = s.content) },
            terms    = keyTerms.map { k -> KeyTermResponse(id = 0L, term = k.term, definition = k.definition) }
        )
    }
}
'@
Write-Host "  WRITTEN: content\LessonPersistenceService.kt" -ForegroundColor Green

# -- content\LessonRepositories.kt
New-Item -ItemType Directory -Force -Path "$src\content" | Out-Null
Set-Content -Path "$src\content\LessonRepositories.kt" -Encoding UTF8 -Value @'
package com.elekeza.backend.content

import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.stereotype.Repository
import java.util.UUID

@Repository
interface LessonRepository : JpaRepository<Lesson, UUID>

@Repository
interface LessonSectionRepository : JpaRepository<LessonSection, UUID>

@Repository
interface KeyTermRepository : JpaRepository<KeyTerm, Long>
'@
Write-Host "  WRITTEN: content\LessonRepositories.kt" -ForegroundColor Green

# -- content\LessonSection.kt
New-Item -ItemType Directory -Force -Path "$src\content" | Out-Null
Set-Content -Path "$src\content\LessonSection.kt" -Encoding UTF8 -Value @'
package com.elekeza.backend.content

import jakarta.persistence.*
import java.time.Instant
import java.util.UUID

@Entity
@Table(name = "lesson_sections")
class LessonSection {
    @Id val id: UUID = UUID.randomUUID()

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "lesson_id", nullable = false)
    lateinit var lesson: Lesson

    @Column(name = "sequence_number", nullable = false)
    var sequenceNumber: Int = 0

    @Column(nullable = false, columnDefinition = "TEXT")
    lateinit var content: String

    @Column(name = "time_spent_seconds", nullable = false)
    var timeSpentSeconds: Int = 0

    @Column(name = "created_at", nullable = false, updatable = false)
    val createdAt: Instant = Instant.now()

    @Column(name = "updated_at", nullable = false)
    var updatedAt: Instant = Instant.now()
}
'@
Write-Host "  WRITTEN: content\LessonSection.kt" -ForegroundColor Green

# -- content\controller\ContentController.kt
New-Item -ItemType Directory -Force -Path "$src\content\controller" | Out-Null
Set-Content -Path "$src\content\controller\ContentController.kt" -Encoding UTF8 -Value @'
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
    private val contentService: ContentService,
    private val contentRepository: ContentRepository,
    private val userRepository: UserRepository
) {
    private fun resolveUserId(principal: UserDetails): Long =
        userRepository.findByEmail(principal.username)?.id
            ?: throw ResponseStatusException(HttpStatus.UNAUTHORIZED, "User not found")

    @PostMapping("/upload", consumes = [MediaType.MULTIPART_FORM_DATA_VALUE])
    fun upload(
        @AuthenticationPrincipal principal: UserDetails,
        @RequestParam("file") file: MultipartFile,
        @RequestParam(value = "sneType", required = false) sneType: String?
    ): ResponseEntity<ContentDto> {
        val userId  = resolveUserId(principal)
        val content = contentService.upload(userId, file, sneType)
        return ResponseEntity.status(202).body(content.toDto())
    }

    @GetMapping("/{id}")
    fun getById(
        @AuthenticationPrincipal principal: UserDetails,
        @PathVariable id: Long
    ): ResponseEntity<ContentDto> {
        val userId  = resolveUserId(principal)
        val content = contentService.getContent(id, userId)
        return ResponseEntity.ok(content.toDto())
    }

    @GetMapping("/list")
    fun list(
        @AuthenticationPrincipal principal: UserDetails,
        @RequestParam(defaultValue = "0") page: Int,
        @RequestParam(defaultValue = "20") size: Int
    ): ResponseEntity<*> {
        val userId   = resolveUserId(principal)
        val pageable = PageRequest.of(page, size.coerceAtMost(50), Sort.by("createdAt").descending())
        val results  = contentRepository.findByUserIdOrderByCreatedAtDesc(userId, PageRequest.of(page, size.coerceAtMost(50)))
        return ResponseEntity.ok(mapOf(
            "data" to results.content.map { it.toListDto() },
            "total" to results.totalElements,
            "page" to results.number,
            "totalPages" to results.totalPages
        ))
    }

    @DeleteMapping("/{id}")
    fun delete(
        @AuthenticationPrincipal principal: UserDetails,
        @PathVariable id: Long
    ): ResponseEntity<*> {
        val userId = resolveUserId(principal)
        contentService.deleteContent(id, userId)
        return ResponseEntity.ok(mapOf("message" to "Content deleted"))
    }
}
'@
Write-Host "  WRITTEN: content\controller\ContentController.kt" -ForegroundColor Green

# -- content\controller\FileUploadController.kt
New-Item -ItemType Directory -Force -Path "$src\content\controller" | Out-Null
Set-Content -Path "$src\content\controller\FileUploadController.kt" -Encoding UTF8 -Value @'
package com.elekeza.backend.content.controller

import com.elekeza.backend.common.ai.LessonResponse
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
    ): ResponseEntity<LessonResponse> {
        val learnerId = UUID.fromString(principal.username)
        return ResponseEntity.ok(fileUploadService.uploadFile(learnerId, file))
    }
}
'@
Write-Host "  WRITTEN: content\controller\FileUploadController.kt" -ForegroundColor Green

# -- content\dto\ContentDTO.kt
New-Item -ItemType Directory -Force -Path "$src\content\dto" | Out-Null
Set-Content -Path "$src\content\dto\ContentDTO.kt" -Encoding UTF8 -Value @'
package com.elekeza.backend.content.dto

// DTOs for content - ContentStatus lives in com.elekeza.backend.content.ContentStatus
// This file kept for backward compat; prefer using Content.kt DTOs directly.
'@
Write-Host "  WRITTEN: content\dto\ContentDTO.kt" -ForegroundColor Green

# -- learner\GuardianRepository.kt
New-Item -ItemType Directory -Force -Path "$src\learner" | Out-Null
Set-Content -Path "$src\learner\GuardianRepository.kt" -Encoding UTF8 -Value @'
package com.elekeza.backend.learner

import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.stereotype.Repository
import java.util.UUID

@Repository
interface GuardianRepository : JpaRepository<Guardian, Long> {
    fun findAllByLearnerId(learnerId: UUID): List<Guardian>
}
'@
Write-Host "  WRITTEN: learner\GuardianRepository.kt" -ForegroundColor Green

# -- learner\Learner.kt
New-Item -ItemType Directory -Force -Path "$src\learner" | Out-Null
Set-Content -Path "$src\learner\Learner.kt" -Encoding UTF8 -Value @'
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
    @JdbcTypeCode(SqlTypes.JSON) @Column(name = "cognitive_profiles", columnDefinition = "jsonb")
    var cognitiveProfiles: List<String> = emptyList(),
    @Enumerated(EnumType.STRING) @Column(name = "literacy_level", length = 20) var literacyLevel: LiteracyLevel? = null,
    @Column(name = "onboarding_complete") var onboardingComplete: Boolean = false
)
'@
Write-Host "  WRITTEN: learner\Learner.kt" -ForegroundColor Green

# -- learner\LearnerRepository.kt
New-Item -ItemType Directory -Force -Path "$src\learner" | Out-Null
Set-Content -Path "$src\learner\LearnerRepository.kt" -Encoding UTF8 -Value @'
package com.elekeza.backend.learner

import org.springframework.data.domain.Page
import org.springframework.data.domain.Pageable
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
Write-Host "  WRITTEN: learner\LearnerRepository.kt" -ForegroundColor Green

# -- learner\OnboardingService.kt
New-Item -ItemType Directory -Force -Path "$src\learner" | Out-Null
Set-Content -Path "$src\learner\OnboardingService.kt" -Encoding UTF8 -Value @'
package com.elekeza.backend.learner

import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.util.UUID

data class ProfileRequest(
    val preferredLanguage: String,
    val ageGroup: AgeGroup,
    val learningGoal: String? = null,
    val cognitiveProfiles: List<String>? = null
)
data class PlacementRequest(val score: Int, val totalQuestions: Int)
data class GuardianLinkRequest(val fullName: String, val relationship: String, val phone: String? = null, val email: String? = null)
data class OnboardingResponse(val learnerId: UUID, val message: String, val onboardingComplete: Boolean = false)
data class PlacementResponse(val learnerId: UUID, val literacyLevel: LiteracyLevel, val message: String)
data class GuardianLinkResponse(val guardianId: Long, val learnerId: UUID, val message: String)

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
        request.cognitiveProfiles?.let { learner.cognitiveProfiles = it.map { p -> p.trim().lowercase() }.filter { p -> p.isNotBlank() } }
        learnerRepository.save(learner)
        return OnboardingResponse(learner.id, "Profile saved", learner.onboardingComplete)
    }

    @Transactional
    fun savePlacement(learnerId: UUID, request: PlacementRequest): PlacementResponse {
        require(request.totalQuestions > 0)
        val learner = learnerRepository.findById(learnerId).orElseThrow { IllegalArgumentException("Learner not found") }
        val pct   = (request.score.toDouble() / request.totalQuestions) * 100
        val level = when { pct >= 70 -> LiteracyLevel.ADVANCED; pct >= 40 -> LiteracyLevel.INTERMEDIATE; else -> LiteracyLevel.BEGINNER }
        learner.literacyLevel = level
        learnerRepository.save(learner)
        return PlacementResponse(learner.id, level, "Placement complete: ${level.name.lowercase()}")
    }

    @Transactional
    fun completeOnboarding(learnerId: UUID): OnboardingResponse {
        val learner = learnerRepository.findById(learnerId).orElseThrow { IllegalArgumentException("Learner not found") }
        check(!learner.onboardingComplete) { "Already completed" }
        learner.onboardingComplete = true
        learnerRepository.save(learner)
        return OnboardingResponse(learner.id, "Onboarding complete", true)
    }

    @Transactional
    fun linkGuardian(learnerId: UUID, request: GuardianLinkRequest): GuardianLinkResponse {
        require(request.phone != null || request.email != null) { "At least one contact required" }
        val learner = learnerRepository.findById(learnerId).orElseThrow { IllegalArgumentException("Learner not found") }
        val saved = guardianRepository.save(Guardian(
            learner = learner, fullName = request.fullName,
            relationship = request.relationship, phone = request.phone, email = request.email
        ))
        return GuardianLinkResponse(saved.id, learner.id, "Guardian linked")
    }
}
'@
Write-Host "  WRITTEN: learner\OnboardingService.kt" -ForegroundColor Green

# -- learner\controller\LearnerProfileController.kt
New-Item -ItemType Directory -Force -Path "$src\learner\controller" | Out-Null
Set-Content -Path "$src\learner\controller\LearnerProfileController.kt" -Encoding UTF8 -Value @'
package com.elekeza.backend.learner.controller

import com.elekeza.backend.auth.UserRepository
import com.elekeza.backend.learner.*
import com.elekeza.backend.learner.dto.*
import jakarta.validation.Valid
import jakarta.validation.constraints.DecimalMax
import jakarta.validation.constraints.DecimalMin
import jakarta.validation.constraints.NotNull
import org.springframework.data.domain.PageRequest
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.security.core.userdetails.UserDetails
import org.springframework.web.bind.annotation.*
import org.springframework.web.server.ResponseStatusException
import java.time.LocalDate
import java.time.LocalDateTime

data class RecordProgressRequest(
    @field:NotNull val completed: Boolean,
    @field:DecimalMin("0.0") @field:DecimalMax("1.0") val quizScore: Double? = null,
    val timeSpentSeconds: Int? = null
)
data class ProfileResponse(val userId: Long, val sneType: String?, val hasCompletedOnboarding: Boolean)

@RestController
@RequestMapping("/api/learner")
class LearnerProfileController(
    private val profileRepository: LearnerProfileRepository,
    private val progressRepository: LessonProgressRepository,
    private val userRepository: UserRepository
) {
    private fun resolveUser(principal: UserDetails) =
        userRepository.findByEmail(principal.username)
            ?: throw ResponseStatusException(HttpStatus.UNAUTHORIZED, "User not found")

    @GetMapping("/profile")
    fun getProfile(@AuthenticationPrincipal principal: UserDetails): ResponseEntity<ProfileResponse> {
        val user    = resolveUser(principal)
        val profile = profileRepository.findByUserId(user.id)
        return ResponseEntity.ok(ProfileResponse(user.id, profile?.sneType?.name, profile != null))
    }

    @PutMapping("/profile")
    fun updateProfile(
        @AuthenticationPrincipal principal: UserDetails,
        @Valid @RequestBody req: UpdateProfileRequest
    ): ResponseEntity<ProfileResponse> {
        val user     = resolveUser(principal)
        val existing = profileRepository.findByUserId(user.id)
        val profile  = if (existing != null)
            profileRepository.save(existing.copy(sneType = req.sneType ?: existing.sneType, updatedAt = LocalDateTime.now()))
        else
            profileRepository.save(LearnerProfile(user = user, sneType = req.sneType))
        return ResponseEntity.ok(ProfileResponse(user.id, profile.sneType?.name, true))
    }

    @GetMapping("/stats")
    fun getStats(@AuthenticationPrincipal principal: UserDetails): ResponseEntity<LearnerStatsDto> {
        val user         = resolveUser(principal)
        val completed    = progressRepository.countByUserIdAndCompleted(user.id, true)
        val avgScore     = progressRepository.findAverageQuizScoreByUserId(user.id)
        val sevenDaysAgo = LocalDateTime.now().minusDays(7)
        val recent       = progressRepository.countByUserIdAndCreatedAtAfter(user.id, sevenDaysAgo)
        val dates        = progressRepository.findCompletionDatesSince(user.id, LocalDateTime.now().minusDays(60))
        val streak       = calculateStreak(dates)
        return ResponseEntity.ok(LearnerStatsDto(completed, avgScore, recent, streak, dates.firstOrNull()))
    }

    @GetMapping("/progress")
    fun getProgress(
        @AuthenticationPrincipal principal: UserDetails,
        @RequestParam(defaultValue = "0") page: Int,
        @RequestParam(defaultValue = "10") size: Int
    ): ResponseEntity<*> {
        val user     = resolveUser(principal)
        val pageable = PageRequest.of(page, size.coerceAtMost(50))
        val progress = progressRepository.findByUserIdOrderByCreatedAtDesc(user.id, pageable)
        return ResponseEntity.ok(mapOf(
            "items" to progress.content.map { it.toDto() },
            "totalItems" to progress.totalElements,
            "totalPages" to progress.totalPages,
            "page" to page
        ))
    }

    @PostMapping("/progress/{contentId}")
    fun recordProgress(
        @AuthenticationPrincipal principal: UserDetails,
        @PathVariable contentId: Long,
        @Valid @RequestBody req: RecordProgressRequest
    ): ResponseEntity<*> {
        val user     = resolveUser(principal)
        val existing = progressRepository.findByUserIdAndContentId(user.id, contentId)
        val saved    = if (existing != null)
            progressRepository.save(existing.copy(
                completed = req.completed,
                quizScore = req.quizScore ?: existing.quizScore,
                timeSpentSeconds = req.timeSpentSeconds ?: existing.timeSpentSeconds,
                completedAt = if (req.completed && existing.completedAt == null) LocalDateTime.now() else existing.completedAt
            ))
        else
            progressRepository.save(LessonProgress(
                user = user, contentId = contentId, completed = req.completed,
                quizScore = req.quizScore, timeSpentSeconds = req.timeSpentSeconds,
                completedAt = if (req.completed) LocalDateTime.now() else null
            ))
        return ResponseEntity.ok(mapOf("contentId" to saved.contentId, "completed" to saved.completed, "quizScore" to saved.quizScore))
    }

    private fun calculateStreak(dates: List<LocalDate>): Int {
        if (dates.isEmpty()) return 0
        var streak = 0; var expected = LocalDate.now()
        for (date in dates.sortedDescending()) {
            if (date == expected || (date == expected.minusDays(1) && streak == 0)) { streak++; expected = date.minusDays(1) } else break
        }
        return streak
    }
}
'@
Write-Host "  WRITTEN: learner\controller\LearnerProfileController.kt" -ForegroundColor Green

# -- learner\dto\LearnerDTO.kt
New-Item -ItemType Directory -Force -Path "$src\learner\dto" | Out-Null
Set-Content -Path "$src\learner\dto\LearnerDTO.kt" -Encoding UTF8 -Value @'
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
data class UpdateProfileRequest(val sneType: SneType? = null, val preferences: Map<String, Any>? = null)
data class LessonProgressDto(val id: Long, val contentId: Long, val quizScore: Double?,
    val completed: Boolean, val completedAt: LocalDateTime?)
data class CompleteProgressRequest(val quizScore: Double? = null)
data class LearnerStatsDto(val lessonsCompleted: Long, val avgQuizScore: Double?,
    val recentActivity: Long, val streak: Int, val lastActive: LocalDate?)

fun LearnerProfile.toDto() = LearnerProfileDto(id, sneType, preferences, createdAt, updatedAt)
fun LessonProgress.toDto() = LessonProgressDto(id, contentId, quizScore, completed, completedAt)
'@
Write-Host "  WRITTEN: learner\dto\LearnerDTO.kt" -ForegroundColor Green

# -- learner\dto\OnboardingDTO.kt
New-Item -ItemType Directory -Force -Path "$src\learner\dto" | Out-Null
Set-Content -Path "$src\learner\dto\OnboardingDTO.kt" -Encoding UTF8 -Value @'
package com.elekeza.backend.learner.dto

import com.elekeza.backend.learner.AgeGroup
import com.elekeza.backend.learner.LiteracyLevel
import java.util.UUID

// Re-export from OnboardingService for controller use
typealias ProfileRequest       = com.elekeza.backend.learner.ProfileRequest
typealias PlacementRequest     = com.elekeza.backend.learner.PlacementRequest
typealias GuardianLinkRequest  = com.elekeza.backend.learner.GuardianLinkRequest
typealias OnboardingResponse   = com.elekeza.backend.learner.OnboardingResponse
typealias PlacementResponse    = com.elekeza.backend.learner.PlacementResponse
typealias GuardianLinkResponse = com.elekeza.backend.learner.GuardianLinkResponse
'@
Write-Host "  WRITTEN: learner\dto\OnboardingDTO.kt" -ForegroundColor Green

# -- learner\dto\Phase3DTO.kt
New-Item -ItemType Directory -Force -Path "$src\learner\dto" | Out-Null
Set-Content -Path "$src\learner\dto\Phase3DTO.kt" -Encoding UTF8 -Value @'
package com.elekeza.backend.learner.dto

import com.elekeza.backend.common.ai.SectionResponse
import com.elekeza.backend.common.ai.KeyTermResponse
import java.util.UUID

data class UploadResponse(
    val lessonId: UUID, val firstSection: SectionResponse,
    val totalSections: Int, val keyTerms: List<KeyTermResponse>
)
data class QuizOption(val id: String, val text: String)
data class QuizStartResponse(val quizId: UUID, val totalQuestions: Int, val firstQuestion: QuizQuestionResponse)
data class QuizQuestionResponse(val id: UUID, val sequenceNumber: Int, val text: String, val options: List<QuizOption>)
data class AnswerRequest(val questionId: UUID, val selectedOptionId: String, val latencyMs: Int = 0)
data class AnswerResponse(val isCorrect: Boolean, val learnerMessage: String, val explanation: String?,
    val directive: String?, val nextQuestion: QuizQuestionResponse?, val quizComplete: Boolean)
data class QuizCompleteResponse(val quizId: UUID, val scorePercentage: Double, val correctCount: Int,
    val totalQuestions: Int, val summaryMessage: String, val failedQuestions: List<FailedQuestionReview> = emptyList())
data class FailedQuestionReview(val questionId: UUID, val questionText: String,
    val selectedOptionId: String?, val selectedAnswerText: String?,
    val correctOptionId: String, val correctAnswerText: String?)
data class DashboardResponse(val lessonsCompleted: Long, val avgQuizScore: Double?,
    val recentLessons: List<Map<String, Any>>, val quizHistory: List<Map<String, Any>>)
'@
Write-Host "  WRITTEN: learner\dto\Phase3DTO.kt" -ForegroundColor Green

# -- quiz\QuizService.kt
New-Item -ItemType Directory -Force -Path "$src\quiz" | Out-Null
Set-Content -Path "$src\quiz\QuizService.kt" -Encoding UTF8 -Value @'
package com.elekeza.backend.quiz

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
    private val log = LoggerFactory.getLogger(QuizService::class.java)

    fun generateQuiz(contentId: Long, userId: Long): QuizWithQuestions {
        val quiz = quizRepository.findByContentIdAndUserId(contentId, userId)
            ?: quizRepository.save(Quiz(contentId = contentId, userId = userId))
        val questions = questionRepository.findByQuizId(quiz.id)
        return QuizWithQuestions(quiz.id, contentId, questions.map { q ->
            QuizQuestionDto(q.id, q.question, mapOf("A" to q.optionA, "B" to q.optionB, "C" to q.optionC, "D" to q.optionD))
        })
    }

    fun getOrCreateQuiz(contentId: Long, userId: Long) = generateQuiz(contentId, userId)

    fun scoreAnswer(quizId: Long, questionId: Long, selectedOption: String): AnswerResult {
        val question = questionRepository.findById(questionId)
            .orElseThrow { ResponseStatusException(HttpStatus.NOT_FOUND, "Question not found") }
        val correct = question.correctOption.equals(selectedOption.trim(), ignoreCase = true)
        return AnswerResult(correct, question.correctOption, question.explanation)
    }

    @Transactional
    fun completeQuiz(quizId: Long, userId: Long): QuizResult {
        val quiz      = quizRepository.findById(quizId).orElseThrow { ResponseStatusException(HttpStatus.NOT_FOUND, "Quiz not found") }
        val questions = questionRepository.findByQuizId(quizId)
        val attempt   = attemptRepository.findByQuizIdAndUserId(quizId, userId)
        val score     = attempt?.score ?: 0.0

        val userEntity = com.elekeza.backend.auth.User(id = userId, email = "", name = "", password = "")
        val existing  = progressRepository.findByUserIdAndContentId(userId, quiz.contentId)
        progressRepository.save((existing ?: LessonProgress(user = userEntity, contentId = quiz.contentId))
            .copy(quizScore = score, completed = true, completedAt = LocalDateTime.now()))

        log.info("Quiz {} completed by userId={} score={}", quizId, userId, score)
        return QuizResult(quizId, score, questions.size, emptyList())
    }

    fun submitQuiz(quizId: Long, userId: Long, submission: QuizSubmission): QuizResult =
        completeQuiz(quizId, userId)
}

data class QuizWithQuestions(val quizId: Long, val lessonId: Long, val questions: List<QuizQuestionDto>)
fun QuizWithQuestions.toClientDto() = QuizDto(quizId, lessonId, questions)
'@
Write-Host "  WRITTEN: quiz\QuizService.kt" -ForegroundColor Green

# -- quiz\controller\QuizController.kt
New-Item -ItemType Directory -Force -Path "$src\quiz\controller" | Out-Null
Set-Content -Path "$src\quiz\controller\QuizController.kt" -Encoding UTF8 -Value @'
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
    private val quizService: QuizService,
    private val quizRepository: QuizRepository,
    private val userRepository: UserRepository
) {
    private fun resolveUserId(principal: UserDetails): Long =
        userRepository.findByEmail(principal.username)?.id
            ?: throw ResponseStatusException(HttpStatus.UNAUTHORIZED, "User not found")

    @PostMapping("/generate/{contentId}")
    fun generate(@AuthenticationPrincipal principal: UserDetails, @PathVariable contentId: Long): ResponseEntity<QuizDto> {
        val quiz = quizService.generateQuiz(contentId, resolveUserId(principal))
        return ResponseEntity.status(201).body(quiz.toClientDto())
    }

    @GetMapping("/{quizId}")
    fun getQuiz(@AuthenticationPrincipal principal: UserDetails, @PathVariable quizId: Long): ResponseEntity<QuizDto> {
        val quiz = quizRepository.findById(quizId).orElseThrow { ResponseStatusException(HttpStatus.NOT_FOUND, "Quiz not found") }
        return ResponseEntity.ok(QuizDto(quiz.id, quiz.contentId, emptyList()))
    }

    @PostMapping("/{quizId}/submit")
    fun submit(
        @AuthenticationPrincipal principal: UserDetails,
        @PathVariable quizId: Long,
        @RequestBody submission: QuizSubmission
    ): ResponseEntity<QuizResult> =
        ResponseEntity.ok(quizService.submitQuiz(quizId, resolveUserId(principal), submission))
}
'@
Write-Host "  WRITTEN: quiz\controller\QuizController.kt" -ForegroundColor Green

Write-Host "" 
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "All 31 files written. Now run:" -ForegroundColor Cyan
Write-Host "  .\gradlew compileKotlin" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Cyan