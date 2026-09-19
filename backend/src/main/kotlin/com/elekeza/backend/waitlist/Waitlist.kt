package com.elekeza.backend.waitlist

import jakarta.persistence.*
import jakarta.validation.constraints.*
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Query
import org.springframework.stereotype.Repository
import java.time.LocalDateTime

// ── Entity ────────────────────────────────────────────────────────────────────
@Entity
@Table(name = "waitlist_entries")
data class WaitlistEntry(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,

    @Column(unique = true, nullable = false, length = 255)
    val email: String,

    @Column(nullable = false, length = 100)
    val name: String,

    @Column(nullable = false, length = 50)
    val role: String,

    @Column(length = 200)
    val school: String? = null,

    @Column(name = "created_at")
    val createdAt: LocalDateTime = LocalDateTime.now()
)

// ── Repository ────────────────────────────────────────────────────────────────
@Repository
interface WaitlistRepository : JpaRepository<WaitlistEntry, Long> {
    fun existsByEmail(email: String): Boolean
    fun findByEmail(email: String): WaitlistEntry?

    @Query("SELECT COUNT(w) FROM WaitlistEntry w")
    fun countAll(): Long
}

// ── DTOs ──────────────────────────────────────────────────────────────────────
data class WaitlistRequest(
    @field:NotBlank(message = "Name is required")
    @field:Size(min = 2, max = 100)
    val name: String,

    @field:NotBlank(message = "Email is required")
    @field:Email(message = "Invalid email format")
    val email: String,

    @field:NotBlank(message = "Role is required")
    val role: String,

    @field:Size(max = 200)
    val school: String? = null,

    // Honeypot — bots fill this, humans don't see it
    val website: String? = null
)

data class WaitlistEntryDto(
    val id: Long,
    val name: String,
    val email: String,
    val role: String,
    val school: String?,
    val createdAt: LocalDateTime
)

fun WaitlistEntry.toDto() = WaitlistEntryDto(
    id = id, name = name, email = email,
    role = role, school = school, createdAt = createdAt
)