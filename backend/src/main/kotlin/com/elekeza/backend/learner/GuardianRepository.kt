package com.elekeza.backend.learner

import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param
import org.springframework.stereotype.Repository
import java.util.UUID

@Repository
interface GuardianRepository : JpaRepository<Guardian, UUID> {

    // Original — lookup by learner UUID (used by onboarding)
    @Query("SELECT g FROM Guardian g WHERE g.learner.id = :learnerId")
    fun findAllByLearnerId(@Param("learnerId") learnerId: UUID): List<Guardian>

    // New — lookup by guardian email (used by GuardianController to find wards)
    @Query("SELECT g FROM Guardian g WHERE g.email = :email")
    fun findAllByEmail(@Param("email") email: String): List<Guardian>

    // Find specific link by learner + guardian email
    @Query("SELECT g FROM Guardian g WHERE g.learner.id = :learnerId AND g.email = :email")
    fun findByLearnerIdAndEmail(
        @Param("learnerId") learnerId: UUID,
        @Param("email") email: String
    ): Guardian?
}
