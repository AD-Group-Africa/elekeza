package com.elekeza.backend.auth

import jakarta.persistence.*
import java.time.OffsetDateTime

/**
 * Single-use, expiring password reset token. Only the SHA-256 hash of the raw
 * token is persisted — the raw token exists solely inside the reset email, so
 * a database leak cannot be replayed as a password change. Consumption sets
 * used_at; a used or expired token is rejected and, on successful reset, all
 * of the user's outstanding tokens are invalidated.
 */
@Entity
@Table(name = "password_reset_tokens")
data class PasswordResetToken(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,
    @Column(name = "user_id", nullable = false)
    val userId: Long,
    @Column(name = "token_hash", nullable = false, unique = true)
    val tokenHash: String,
    @Column(name = "expires_at", nullable = false)
    val expiresAt: OffsetDateTime,
    @Column(name = "used_at")
    var usedAt: OffsetDateTime? = null,
    @Column(name = "created_at", nullable = false)
    val createdAt: OffsetDateTime = OffsetDateTime.now()
)

interface PasswordResetTokenRepository : org.springframework.data.jpa.repository.JpaRepository<PasswordResetToken, Long> {
    fun findByTokenHash(tokenHash: String): PasswordResetToken?
    fun deleteByUserId(userId: Long)
}
