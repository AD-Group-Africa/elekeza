package com.elekeza.backend.auth

import jakarta.persistence.*
import java.time.LocalDateTime

enum class UserRole {
    STUDENT, TEACHER, ADMIN, GUARDIAN
}

enum class SneType {
    DYSLEXIA,
    ADHD,
    AUTISM,
    INTELLECTUAL_DISABILITY,
    NONE;

    companion object {
        fun fromString(value: String?): SneType =
            values().firstOrNull { it.name.equals(value?.trim(), ignoreCase = true) } ?: NONE
    }
}

@Entity
@Table(name = "users")
class User(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,

    @Column(nullable = false)
    var name: String,

    @Column(unique = true, nullable = false)
    val email: String,

    @Column(nullable = false)
    var password: String,

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    var role: UserRole = UserRole.STUDENT,

    @Enumerated(EnumType.STRING)
    @Column(name = "sne_type")
    var sneType: SneType? = null,

    @Column(name = "onboarding_complete")
    var onboardingComplete: Boolean = false,

    @Column(name = "created_at")
    val createdAt: LocalDateTime = LocalDateTime.now(),

    @Column(name = "updated_at")
    var updatedAt: LocalDateTime = LocalDateTime.now()
) {
    @PreUpdate
    fun preUpdate() {
        updatedAt = LocalDateTime.now()
    }

    fun toDto() = com.elekeza.backend.auth.dto.UserDto(
        id = id,
        email = email,
        name = name,
        role = role.name
    )
}

