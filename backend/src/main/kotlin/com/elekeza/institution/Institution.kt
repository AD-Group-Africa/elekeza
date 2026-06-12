package com.elekeza.institution

import jakarta.persistence.*
import java.time.Instant

@Entity
@Table(name = "institutions")
data class Institution(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,
    val name: String,
    val type: String = "SCHOOL",
    val subCounty: String? = null,
    val county: String? = null,
    val country: String = "Kenya",
    val plan: String = "STARTER",
    val planExpiresAt: Instant? = null,
    val maxStudents: Int = 50,
    val maxTeachers: Int = 5,
    val contactEmail: String? = null,
    val contactPhone: String? = null,
    val isActive: Boolean = true,
    val createdAt: Instant = Instant.now(),
    val updatedAt: Instant = Instant.now()
)

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