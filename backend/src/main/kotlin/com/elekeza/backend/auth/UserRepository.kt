package com.elekeza.backend.auth

import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param

import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.stereotype.Repository

@Repository
interface UserRepository : JpaRepository<User, Long> {
    fun findByEmail(email: String): User?
    fun existsByEmail(email: String): Boolean
    fun findByRole(role: UserRole): List<User>
    fun findByInstitutionId(institutionId: Long): List<User>
    fun findByInstitutionIdAndRole(institutionId: Long, role: UserRole): List<User>

    @Query("SELECT COUNT(u) FROM User u WHERE u.role = :role")
    fun countByRole(@Param("role") role: String): Long
}

