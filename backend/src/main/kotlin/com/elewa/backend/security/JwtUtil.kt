package com.elewa.backend.security

import io.jsonwebtoken.Claims
import io.jsonwebtoken.JwtException
import io.jsonwebtoken.Jwts
import io.jsonwebtoken.security.Keys
import org.slf4j.LoggerFactory
import org.springframework.beans.factory.annotation.Value
import org.springframework.stereotype.Component
import java.nio.charset.StandardCharsets
import java.util.Date
import java.util.UUID
import javax.crypto.SecretKey

enum class TokenType { ACCESS, REFRESH, UNKNOWN }

data class ParsedToken(val learnerId: UUID, val email: String?, val type: TokenType)

@Component
class JwtUtil(
    @Value("\${security.jwt.secret}") secret: String,
    @Value("\${security.jwt.access-token-expiry-ms}") private val accessTokenExpiryMs: Long,
    @Value("\${security.jwt.refresh-token-expiry-ms}") private val refreshTokenExpiryMs: Long
) {
    private val log = LoggerFactory.getLogger(JwtUtil::class.java)
    private val key: SecretKey = Keys.hmacShaKeyFor(secret.toByteArray(StandardCharsets.UTF_8))

    fun generateAccessToken(learnerId: UUID, email: String): String =
        buildToken(learnerId, "access", accessTokenExpiryMs) { claim("email", email) }

    fun generateRefreshToken(learnerId: UUID): String =
        buildToken(learnerId, "refresh", refreshTokenExpiryMs)

    /** Parse once — returns null if invalid or expired. Never re-parse downstream. */
    fun parse(token: String): ParsedToken? {
        val claims = extractClaims(token) ?: return null
        val type = when (claims["type"]) {
            "access"  -> TokenType.ACCESS
            "refresh" -> TokenType.REFRESH
            else      -> TokenType.UNKNOWN
        }
        val learnerId = runCatching { UUID.fromString(claims.subject) }.getOrNull() ?: return null
        return ParsedToken(learnerId, claims["email"] as? String, type)
    }

    fun isTokenValid(token: String): Boolean = extractClaims(token) != null

    private fun buildToken(
        learnerId: UUID, type: String, expiryMs: Long,
        extra: io.jsonwebtoken.JwtBuilder.() -> Unit = {}
    ): String = Jwts.builder()
        .subject(learnerId.toString())
        .claim("type", type)
        .issuedAt(Date())
        .expiration(Date(System.currentTimeMillis() + expiryMs))
        .apply(extra)
        .signWith(key)
        .compact()

    private fun extractClaims(token: String): Claims? =
        try {
            Jwts.parser().verifyWith(key).build().parseSignedClaims(token).payload
        } catch (e: JwtException) {
            log.warn("Invalid JWT: ${e.message}"); null
        } catch (e: IllegalArgumentException) {
            log.warn("Blank JWT: ${e.message}"); null
        }
}