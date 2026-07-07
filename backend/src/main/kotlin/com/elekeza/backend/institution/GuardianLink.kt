package com.elekeza.backend.institution

import jakarta.persistence.*
import java.time.Instant

@Entity
@Table(name = "guardian_links")
data class GuardianLink(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,
    val guardianId: Long,
    val learnerId: Long,
    val relationship: String = "PARENT",
    val isActive: Boolean = true,
    val createdAt: Instant = Instant.now()
)
