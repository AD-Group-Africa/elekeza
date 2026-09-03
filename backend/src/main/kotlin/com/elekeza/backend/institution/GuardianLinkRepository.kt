package com.elekeza.backend.institution

import org.springframework.data.jpa.repository.JpaRepository

interface GuardianLinkRepository : JpaRepository<GuardianLink, Long> {
    fun findByLearnerId(learnerId: Long): List<GuardianLink>
    fun findByGuardianId(guardianId: Long): List<GuardianLink>
}
