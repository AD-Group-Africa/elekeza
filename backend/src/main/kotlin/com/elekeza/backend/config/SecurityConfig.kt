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
class SecurityConfig(private val jwtAuthFilter: JwtAuthFilter) {

    @Value("\${app.cors.allowed-origins}")
    private lateinit var allowedOriginsRaw: String

    @Bean fun passwordEncoder(): PasswordEncoder = BCryptPasswordEncoder()

    @Bean
    fun authenticationManager(cfg: AuthenticationConfiguration): AuthenticationManager =
        cfg.authenticationManager

    @Bean
    fun securityFilterChain(http: HttpSecurity): SecurityFilterChain {
        http
            .cors { it.configurationSource(corsConfigurationSource()) }
            .csrf { it.disable() }
            .sessionManagement { it.sessionCreationPolicy(SessionCreationPolicy.STATELESS) }
            .authorizeHttpRequests { auth ->
                auth.requestMatchers(
                    "/api/auth/**",
                    "/api/institutions/register",
                    "/api/waitlist/**",
                    "/actuator/health",
                    "/h2-console/**"
                ).permitAll()
                auth.requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()

                // Allow school admin to access analytics and admin endpoints
                auth.requestMatchers("/api/analytics/teacher").hasAnyRole("TEACHER", "SCHOOL_ADMIN", "ADMIN")
                auth.requestMatchers("/api/analytics/admin", "/api/analytics/admin/overview").hasAnyRole("SCHOOL_ADMIN", "ADMIN")
                auth.requestMatchers("/api/analytics/student").hasAnyRole("STUDENT", "ADMIN")
                auth.requestMatchers("/api/analytics/guardian").hasAnyRole("GUARDIAN", "ADMIN")
                auth.requestMatchers("/api/analytics/dashboard").authenticated()
                auth.requestMatchers("/api/analytics/**").hasAnyRole("ADMIN")

                auth.requestMatchers("/api/teacher/**").hasAnyRole("TEACHER", "SCHOOL_ADMIN", "ADMIN")
                auth.requestMatchers("/api/guardian/**").hasAnyRole("GUARDIAN", "SCHOOL_ADMIN", "ADMIN")
                auth.requestMatchers("/api/institutions/**").hasAnyRole("SCHOOL_ADMIN", "ADMIN")
                auth.anyRequest().authenticated()
            }
            .formLogin { it.disable() }
            .httpBasic { it.disable() }
            .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter::class.java)
        return http.build()
    }

    @Bean
    fun corsConfigurationSource(): CorsConfigurationSource {
        val origins = allowedOriginsRaw.split(",").map { it.trim() }.filter { it.isNotBlank() }
        val config = CorsConfiguration().apply {
            allowedOriginPatterns = origins
            allowedMethods = listOf("GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS")
            allowedHeaders = listOf("*")
            allowCredentials = true
        }
        val source = UrlBasedCorsConfigurationSource()
        source.registerCorsConfiguration("/**", config)
        return source
    }
}
