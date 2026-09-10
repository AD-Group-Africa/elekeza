package com.elekeza.backend.auth

import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.transaction.annotation.Transactional

interface RefreshTokenRepository : JpaRepository<RefreshToken, Long> {
    fun findByTokenHash(hash: String): RefreshToken?

    // Derived entity deletes require an active transaction (used by logout and
    // by test cleanup after real HTTP logins issued tokens).
    @Transactional
    fun deleteByUser(user: User)
}
