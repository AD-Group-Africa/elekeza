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