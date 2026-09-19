package com.elekeza.backend.config

import com.elekeza.backend.auth.JwtAuthFilter
import org.springframework.beans.factory.annotation.Value
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.http.HttpMethod
import org.springframework.security.authentication.AuthenticationManager
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity
import org.springframework.security.config.annotation.web.builders.HttpSecurity
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder
import org.springframework.security.crypto.password.PasswordEncoder
import org.springframework.security.web.SecurityFilterChain
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter
import org.springframework.security.web.csrf.CookieCsrfTokenRepository
import org.springframework.security.web.csrf.CsrfTokenRequestAttributeHandler
import org.springframework.web.cors.CorsConfiguration
import org.springframework.web.cors.CorsConfigurationSource
import org.springframework.web.cors.UrlBasedCorsConfigurationSource

@Configuration
@EnableWebSecurity
@EnableMethodSecurity(prePostEnabled = true)
class SecurityConfig(private val jwtAuthFilter: JwtAuthFilter) {

    @Value("\${app.cors.allowed-origins}")
    private lateinit var allowedOriginsRaw: String

    @Bean
    fun passwordEncoder(): PasswordEncoder = BCryptPasswordEncoder()

    @Bean
    fun authenticationManager(cfg: AuthenticationConfiguration): AuthenticationManager =
        cfg.authenticationManager

    @Bean
    fun securityFilterChain(http: HttpSecurity): SecurityFilterChain {
        http
            .cors { it.configurationSource(corsConfigurationSource()) }
            // Baseline security headers: frame-ancestors denies clickjacking,
            // no-referrer keeps tokens/URLs out of referrer headers. The rest
            // of the safe defaults (nosniff, DENY frame options) remain on.
            .headers { headers ->
                headers.contentSecurityPolicy("frame-ancestors 'none'")
                headers.referrerPolicy { referrer -> referrer.policy(org.springframework.security.web.header.writers.ReferrerPolicyHeaderWriter.ReferrerPolicy.NO_REFERRER) }
            }
            .csrf {
                it.csrfTokenRepository(CookieCsrfTokenRepository.withHttpOnlyFalse())
                    // Use the classic (non-XOR) handler so the value in the
                    // XSRF-TOKEN cookie is the literal token the client must
                    // echo back. The frontend's axios sends the raw cookie
                    // value, which Spring Security 6's default
                    // XorCsrfTokenRequestAttributeHandler would reject.
                    .csrfTokenRequestHandler(CsrfTokenRequestAttributeHandler())
                    .ignoringRequestMatchers(
                        "/api/auth/login", "/api/auth/register", "/api/auth/refresh", "/api/auth/csrf", "/api/auth/forgot-password",
                        // Server-to-server provider callback: the caller holds no
                        // browser session and cannot carry a CSRF token. Auth is
                        // already permitAll here, and the handler validates the
                        // payload itself (state machine, amount binding, known ids).
                        "/api/payments/callback"
                    )
            }
            .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter::class.java)
            .authorizeHttpRequests { auth ->
                auth.requestMatchers(
                    "/api/auth/**",
                    "/api/institutions/register",
                    "/api/payments/callback",
                    "/api/waitlist/**",
                    "/actuator/health",
                    "/api/auth/csrf"
                ).permitAll()
                auth.requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()

                // Analytics: filter-level rules must not shadow the method-level
                // annotations. /student, /guardian and /dashboard are principal-
                // scoped (or role-gated by @PreAuthorize); only the catch-all
                // below is ADMIN-only.
                auth.requestMatchers("/api/analytics/teacher", "/api/analytics/teacher/**").hasAnyRole("TEACHER", "SCHOOL_ADMIN", "ADMIN")
                auth.requestMatchers("/api/analytics/admin", "/api/analytics/admin/overview").hasAnyRole("SCHOOL_ADMIN", "ADMIN")
                auth.requestMatchers("/api/analytics/guardian").hasAnyRole("GUARDIAN", "ADMIN")
                auth.requestMatchers("/api/analytics/student", "/api/analytics/dashboard").authenticated()
                auth.requestMatchers("/api/analytics/**").hasAnyRole("ADMIN")

                auth.requestMatchers("/api/teacher/**").hasAnyRole("TEACHER", "SCHOOL_ADMIN", "ADMIN")
                auth.requestMatchers("/api/guardian/**").hasAnyRole("GUARDIAN", "SCHOOL_ADMIN", "ADMIN")
                auth.requestMatchers("/api/institutions/**").hasAnyRole("SCHOOL_ADMIN", "ADMIN")
                auth.anyRequest().authenticated()
            }
            .formLogin { it.disable() }
            .httpBasic { it.disable() }
        return http.build()
    }

    @Bean
    fun corsConfigurationSource(): CorsConfigurationSource {
        val origins = allowedOriginsRaw.split(",").map { it.trim() }.filter { it.isNotBlank() }
        require(origins.none { it == "*" }) { "CORS origins must be explicit when credentials are enabled" }
        val config = CorsConfiguration().apply {
            allowedOrigins = origins
            allowedMethods = listOf("GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS")
            allowedHeaders = listOf("*")
            allowCredentials = true
        }
        val source = UrlBasedCorsConfigurationSource()
        source.registerCorsConfiguration("/**", config)
        return source
    }
}