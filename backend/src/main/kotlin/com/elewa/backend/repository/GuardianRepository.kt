package com.elewa.backend.repository

import com.elewa.backend.model.Guardian
import org.springframework.data.jpa.repository.JpaRepository
import java.util.UUID

interface GuardianRepository : JpaRepository<Guardian, UUID> {
    fun findAllByLearnerId(learnerId: UUID): List<Guardian>
}