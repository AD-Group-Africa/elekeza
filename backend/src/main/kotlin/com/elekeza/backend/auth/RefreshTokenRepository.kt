package com.elekeza.backend.auth

import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Modifying
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param
import org.springframework.transaction.annotation.Transactional
import java.time.OffsetDateTime

interface RefreshTokenRepository : JpaRepository<RefreshToken, Long> {
    fun findByTokenHash(hash: String): RefreshToken?

    // Derived entity deletes require an active transaction (used by logout and
    // by test cleanup after real HTTP logins issued tokens).
    @Transactional
    fun deleteByUser(user: User)

    fun countByUser(user: User): Long

    // Retention (V21): expired sessions are useless and are swept daily.
    fun countByExpiresAtBefore(cutoff: OffsetDateTime): Long

    @Modifying
    @Query("DELETE FROM RefreshToken t WHERE t.expiresAt < :cutoff")
    fun deleteByExpiresAtBefore(@Param("cutoff") cutoff: OffsetDateTime): Int
}
