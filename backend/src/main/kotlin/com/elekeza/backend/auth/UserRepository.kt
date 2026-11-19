package com.elekeza.backend.auth

import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Modifying
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param
import java.time.Instant

interface UserRepository : JpaRepository<User, Long> {
    fun findByEmail(email: String): User?
    fun existsByEmail(email: String): Boolean
    fun findByInstitutionIdAndRole(institutionId: Long, role: UserRole): List<User>
    fun findByRole(role: UserRole): List<User>

    /**
     * Account erasure (V21, AccountErasureService). Destroys identifying fields
     * in one statement — email, name, phone, gender and password — and
     * deactivates the account. The row itself is kept so school records that
     * reference it stay intact; it is no longer attributable to a person.
     *
     * A bulk update is used deliberately: it cannot be defeated by a stale
     * entity in the persistence context and it cannot accidentally rewrite
     * other fields.
     */
    @Modifying
    @Query(
        """
        UPDATE User u
           SET u.email = :email,
               u.name = :name,
               u.phone = NULL,
               u.gender = NULL,
               u.password = :password,
               u.active = FALSE,
               u.updatedAt = :updatedAt
         WHERE u.id = :id
        """
    )
    fun anonymize(
        @Param("id") id: Long,
        @Param("email") email: String,
        @Param("name") name: String,
        @Param("password") password: String,
        @Param("updatedAt") updatedAt: Instant
    ): Int
}
