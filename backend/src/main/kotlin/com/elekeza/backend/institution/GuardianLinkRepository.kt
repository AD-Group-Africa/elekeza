package com.elekeza.backend.institution

import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Modifying
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param
import java.time.Instant

interface GuardianLinkRepository : JpaRepository<GuardianLink, Long> {
    fun findByLearnerId(learnerId: Long): List<GuardianLink>
    fun findByGuardianId(guardianId: Long): List<GuardianLink>
    fun findByGuardianIdAndLearnerIdAndIsActiveTrue(guardianId: Long, learnerId: Long): GuardianLink?

    /**
     * Account erasure (V21): revoke every link where this user is the guardian.
     * Returns the number of links changed, which is recorded as erasure evidence.
     */
    @Modifying
    @Query("UPDATE GuardianLink l SET l.revokedAt = :at WHERE l.guardianId = :guardianId AND l.revokedAt IS NULL")
    fun revokeAllForGuardian(@Param("guardianId") guardianId: Long, @Param("at") at: Instant): Int

    /** Account erasure (V21): revoke every link where this user is the learner. */
    @Modifying
    @Query("UPDATE GuardianLink l SET l.revokedAt = :at WHERE l.learnerId = :learnerId AND l.revokedAt IS NULL")
    fun revokeAllForLearner(@Param("learnerId") learnerId: Long, @Param("at") at: Instant): Int
}
