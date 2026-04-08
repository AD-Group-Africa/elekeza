package com.ELEKEZA.backend.repository
import com.ELEKEZA.backend.model.RefreshToken
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Modifying
import org.springframework.data.jpa.repository.Query
import org.springframework.transaction.annotation.Transactional
import java.util.UUID

interface RefreshTokenRepository : JpaRepository<RefreshToken, UUID> {

    fun findByTokenHash(tokenHash: String): RefreshToken?

    @Modifying
    @Transactional
    @Query("UPDATE RefreshToken rt SET rt.revoked = true WHERE rt.learner.id = :learnerId AND rt.revoked = false")
    fun revokeAllByLearnerId(learnerId: UUID)

    @Modifying
    @Transactional
    @Query("DELETE FROM RefreshToken rt WHERE rt.learner.id = :learnerId")
    fun deleteAllByLearnerId(learnerId: UUID)
}
