package com.elekeza.backend.auth

import org.springframework.data.jpa.repository.JpaRepository

interface UserRepository : JpaRepository<User, Long> {
    fun findByEmail(email: String): User?
    fun existsByEmail(email: String): Boolean
    fun findByInstitutionIdAndRole(institutionId: Long, role: UserRole): List<User>
    fun findByRole(role: UserRole): List<User>
}
