package com.elekeza.backend.auth

import io.jsonwebtoken.Claims
import io.jsonwebtoken.Jwts
import io.jsonwebtoken.security.Keys
import org.springframework.beans.factory.annotation.Value
import org.springframework.stereotype.Component
import java.nio.charset.StandardCharsets
import java.util.*

data class ParsedToken(val subject: String?, val email: String?, val role: String?)

@Component
class JwtUtil(
    @Value("\${jwt.secret}") private val secret: String,
    @Value("\${jwt.expiration:900000}") private val accessExpirationMs: Long,
    @Value("\${jwt.refresh-expiration:604800000}") private val refreshExpirationMs: Long
) {
    private val key by lazy { Keys.hmacShaKeyFor(secret.toByteArray(StandardCharsets.UTF_8)) }

    fun generateAccessToken(subject: String, email: String): String =
        Jwts.builder()
            .subject(subject)
            .claim("email", email)
            .claim("type", "access")
            .issuedAt(Date())
            .expiration(Date(System.currentTimeMillis() + accessExpirationMs))
            .signWith(key).compact()

    fun generateRefreshToken(subject: String): String =
        Jwts.builder()
            .subject(subject)
            .claim("type", "refresh")
            .issuedAt(Date())
            .expiration(Date(System.currentTimeMillis() + refreshExpirationMs))
            .signWith(key).compact()

    /** Legacy single-token generator used by OAuth2SuccessHandler */
    fun generateToken(email: String, role: String): String =
        generateAccessToken(email, email)

    fun parse(token: String): ParsedToken? = runCatching {
        val claims = getClaims(token)
        ParsedToken(
            subject = claims.subject,
            email   = claims["email"] as? String ?: claims.subject,
            role    = claims["role"]  as? String
        )
    }.getOrNull()

    fun validateToken(token: String): Boolean = runCatching { getClaims(token); true }.getOrDefault(false)
    fun getEmail(token: String): String = getClaims(token).let { it["email"] as? String ?: it.subject }
    fun getRole(token: String): String  = getClaims(token)["role"] as? String ?: "STUDENT"

    private fun getClaims(token: String): Claims =
        Jwts.parser().verifyWith(key).build().parseSignedClaims(token).payload
}