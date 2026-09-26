package com.elekeza.backend.auth

import jakarta.persistence.*
import java.time.Instant

@Entity
@Table(name = "users")
data class User(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,
    @Column(nullable = false, unique = true)
    val email: String,
    var password: String,
    val name: String,
    @Enumerated(EnumType.STRING)
    val role: UserRole = UserRole.STUDENT,
    var institutionId: Long? = null,
    var gender: String? = null,          // "MALE" or "FEMALE"
    var phone: String? = null,
    /** Deactivated accounts cannot log in; enforced in [AuthService.login]. */
    var active: Boolean = true,
    val createdAt: Instant = Instant.now(),
    val updatedAt: Instant = Instant.now()
) {
    val title: String
        get() = when (gender) {
            "MALE" -> "Mr."
            "FEMALE" -> "Ms."
            else -> ""
        }
}
