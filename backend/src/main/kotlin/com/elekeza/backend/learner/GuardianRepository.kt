package com.elekeza.backend.learner

import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.stereotype.Repository
import java.util.UUID

@Repository
interface GuardianRepository : JpaRepository<Guardian, UUID> {
    fun findAllByLearnerId(learnerId: UUID): List<Guardian>
}