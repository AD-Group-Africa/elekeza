package com.elekeza.backend.auth

import jakarta.persistence.*
import java.time.Instant

@Entity
@Table(name = "users")
data class User(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,
    val email: String,
    val password: String,
    val name: String,
    @Enumerated(EnumType.STRING)
    val role: UserRole = UserRole.STUDENT,
    var institutionId: Long? = null,
    var gender: String? = null,          // "MALE" or "FEMALE"
    var phone: String? = null,
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
