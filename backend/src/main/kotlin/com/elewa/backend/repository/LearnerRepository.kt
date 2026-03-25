package com.elewa.backend.repository

import com.elewa.backend.model.Learner
import org.springframework.data.jpa.repository.JpaRepository
import java.util.Optional
import java.util.UUID

interface LearnerRepository : JpaRepository<Learner, UUID> {
    fun findByEmail(email: String): Optional<Learner>
    fun existsByEmail(email: String): Boolean
}