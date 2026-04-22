package com.elekeza.backend.learner

import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.stereotype.Repository
import java.util.Optional
import java.util.UUID

@Repository
interface LearnerRepository : JpaRepository<Learner, UUID> {
    fun findByEmail(email: String): Optional<Learner>
    fun existsByEmail(email: String): Boolean
}