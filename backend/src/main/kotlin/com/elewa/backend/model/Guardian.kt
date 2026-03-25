package com.elewa.backend.model

import jakarta.persistence.*
import java.time.Instant
import java.util.UUID

@Entity
@Table(name = "guardians")
class Guardian {

    @Id
    val id: UUID = UUID.randomUUID()

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "learner_id", nullable = false)
    lateinit var learner: Learner

    @Column(name = "full_name", nullable = false)
    lateinit var fullName: String

    @Column(name = "phone")
    var phone: String? = null

    @Column(name = "email")
    var email: String? = null

    @Column(name = "relationship", nullable = false)
    lateinit var relationship: String

    @Column(name = "created_at", nullable = false, updatable = false)
    val createdAt: Instant = Instant.now()

    @Column(name = "updated_at", nullable = false)
    var updatedAt: Instant = Instant.now()
}