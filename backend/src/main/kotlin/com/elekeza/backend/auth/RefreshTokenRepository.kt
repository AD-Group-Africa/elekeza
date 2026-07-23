package com.elekeza.backend.auth

import org.springframework.data.jpa.repository.JpaRepository

interface RefreshTokenRepository : JpaRepository<RefreshToken, Long> {
    fun findByTokenHash(hash: String): RefreshToken?
    fun deleteByUser(user: User)
}
