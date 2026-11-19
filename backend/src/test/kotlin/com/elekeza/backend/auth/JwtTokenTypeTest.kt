package com.elekeza.backend.auth

import io.jsonwebtoken.Jwts
import io.jsonwebtoken.security.Keys
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.DisplayName
import org.junit.jupiter.api.Test
import java.nio.charset.StandardCharsets
import java.util.Date

/**
 * Wave 0 (SEC-P2-03): the access filter must accept only access tokens.
 *
 * Refresh tokens are opaque UUIDs in this system, so there is no live token of
 * type `refresh`. The risk is future-facing: `JwtAuthFilter` calls
 * `validateToken`, which previously checked only signature and expiry. If a
 * refresh JWT were ever minted it would have worked as a 7-day access token.
 */
class JwtTokenTypeTest {

    private val secret = "test-secret-at-least-32-characters-long!!"
    private val jwt = JwtUtil(secret, 900_000, 604_800_000)

    @Test
    @DisplayName("a real access token validates")
    fun accessTokenValidates() {
        val token = jwt.generateAccessToken("1", "learner@elekeza.app")
        assertTrue(jwt.validateToken(token))
    }

    @Test
    @DisplayName("a JWT with type=refresh is rejected by the access filter")
    fun refreshTypedJwtIsRejected() {
        val key = Keys.hmacShaKeyFor(secret.toByteArray(StandardCharsets.UTF_8))
        val forgedRefresh = Jwts.builder()
            .subject("1")
            .claim("email", "learner@elekeza.app")
            .claim("type", "refresh")
            .issuedAt(Date())
            .expiration(Date(System.currentTimeMillis() + 604_800_000))
            .signWith(key)
            .compact()

        // Same signature, same key, same subject — the only difference is the
        // claim that marks it as a refresh token.
        assertFalse(jwt.validateToken(forgedRefresh), "a refresh-typed JWT must not authenticate as access")
    }

    @Test
    @DisplayName("a JWT with no type claim is rejected")
    fun untypedJwtIsRejected() {
        val key = Keys.hmacShaKeyFor(secret.toByteArray(StandardCharsets.UTF_8))
        val untyped = Jwts.builder()
            .subject("1")
            .claim("email", "learner@elekeza.app")
            .issuedAt(Date())
            .expiration(Date(System.currentTimeMillis() + 900_000))
            .signWith(key)
            .compact()

        assertFalse(jwt.validateToken(untyped), "only an explicit type=access token may authenticate")
    }
}
