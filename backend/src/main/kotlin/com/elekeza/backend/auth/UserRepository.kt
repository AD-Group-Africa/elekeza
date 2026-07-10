package com.elekeza.backend.auth

import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.stereotype.Repository

@Repository
interface UserRepository : JpaRepository<User, Long> {
    fun findByEmail(email: String): User?
    fun existsByEmail(email: String): Boolean
    fun findByRole(role: UserRole): List<User>
    fun findByInstitutionId(institutionId: Long): List<User>
    fun findByInstitutionIdAndRole(institutionId: Long, role: UserRole): List<User>
}
