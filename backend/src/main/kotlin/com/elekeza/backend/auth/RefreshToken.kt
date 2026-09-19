package com.elekeza.backend.auth

import jakarta.persistence.*
import java.time.OffsetDateTime

@Entity
@Table(name = "refresh_tokens")
class RefreshToken {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    var id: Long = 0

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    lateinit var user: User

    @Column(name = "token_hash", nullable = false, unique = true)
    lateinit var tokenHash: String

    var revoked: Boolean = false

    @Column(name = "expires_at", nullable = false)
    lateinit var expiresAt: OffsetDateTime
}
