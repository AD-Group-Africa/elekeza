package com.elewa.backend.model

import jakarta.persistence.*
import org.hibernate.annotations.CreationTimestamp
import org.hibernate.annotations.UpdateTimestamp
import java.time.OffsetDateTime
import java.util.UUID

@Entity
@Table(name = "refresh_tokens")
class RefreshToken {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(updatable = false, nullable = false)
    val id: UUID = UUID.randomUUID()

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "learner_id", nullable = false)
    lateinit var learner: Learner

    @Column(name = "token_hash", nullable = false, unique = true)
    var tokenHash: String = ""

    @Column(name = "expires_at", nullable = false)
    lateinit var expiresAt: OffsetDateTime

    @Column(nullable = false)
    var revoked: Boolean = false

    @CreationTimestamp
    @Column(name = "created_at", updatable = false, nullable = false)
    var createdAt: OffsetDateTime = OffsetDateTime.now()

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    var updatedAt: OffsetDateTime = OffsetDateTime.now()
}