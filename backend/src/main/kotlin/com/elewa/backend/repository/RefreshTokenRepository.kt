package com.elewa.backend.repository

import com.elewa.backend.model.RefreshToken
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Modifying
import org.springframework.data.jpa.repository.Query
import org.springframework.transaction.annotation.Transactional
import java.util.Optional
import java.util.UUID

interface RefreshTokenRepository : JpaRepository<RefreshToken, UUID> {

    fun findByTokenHash(tokenHash: String): Optional<RefreshToken>

    @Modifying
    @Transactional
    @Query("UPDATE RefreshToken r SET r.revoked = true WHERE r.learner.id = :learnerId")
    fun revokeAllByLearnerId(learnerId: UUID)
}