package com.elekeza.backend.learner

import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Query
import org.springframework.stereotype.Repository
import java.time.LocalDateTime

/**
 * FIX: This repository was referenced throughout AdaptiveUIService and
 * LearnerProfileController but never defined as a concrete Spring @Repository.
 * Without this, the application fails at startup with BeanCreationException.
 *
 * All method signatures match what AdaptiveUIService and LearnerProfileController call.
 * Spring Data JPA derives the query from the method name automatically.
 */
@Repository
interface LessonProgressRepository : JpaRepository<LessonProgress, Long> {

    // Used by AdaptiveUIService.generateConfig() and LearnerProfileController.getProgress()
    fun findByUserIdOrderByCreatedAtDesc(userId: Long): List<LessonProgress>

    // Used by LearnerProfileController.recordProgress() — find existing before upsert
    fun findByUserIdAndContentId(userId: Long, contentId: Long): LessonProgress?

    // Used by LearnerProfileController.getStats() — lesson completion count
    fun countByUserIdAndCompleted(userId: Long, completed: Boolean): Long

    // Used by LearnerProfileController.getStats() — average quiz score
    @Query("SELECT AVG(p.quizScore) FROM LessonProgress p WHERE p.user.id = :userId AND p.quizScore IS NOT NULL")
    fun avgQuizScore(userId: Long): Double?

    // Used by LearnerProfileController.getStats() — recent activity in last 7 days
    @Query("SELECT p FROM LessonProgress p WHERE p.user.id = :userId AND p.completedAt >= :since")
    fun findRecentActivity(userId: Long, since: LocalDateTime): List<LessonProgress>

    // Used by LearnerProfileController.getStats() — streak calculation
    fun findByUserIdAndCompleted(userId: Long, completed: Boolean): List<LessonProgress>
}