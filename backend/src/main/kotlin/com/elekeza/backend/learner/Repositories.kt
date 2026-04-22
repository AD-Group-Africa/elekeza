package com.elekeza.backend.learner

import com.elekeza.backend.auth.User
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param
import org.springframework.stereotype.Repository
import java.time.LocalDateTime

@Repository
interface LearnerProfileRepository : JpaRepository<LearnerProfile, Long> {
    @org.springframework.data.jpa.repository.Query("SELECT lp FROM LearnerProfile lp WHERE lp.user.id = :userId") fun findByUserId(userId: Long): LearnerProfile?
}

@Repository
interface LessonProgressRepository : JpaRepository<LessonProgress, Long> {
    fun findByUserIdOrderByCreatedAtDesc(userId: Long): List<LessonProgress>

    fun findByUserAndContentId(user: User, contentId: Long): LessonProgress?

    @Query("SELECT COUNT(p) FROM LessonProgress p WHERE p.user.id = :userId AND p.completed = true")
    fun countByUserIdAndCompleted(@Param("userId") userId: Long, completed: Boolean): Long

    @Query("SELECT AVG(p.quizScore) FROM LessonProgress p WHERE p.user.id = :userId AND p.quizScore IS NOT NULL")
    fun avgQuizScore(@Param("userId") userId: Long): Double?

    @Query("SELECT p FROM LessonProgress p WHERE p.user.id = :userId AND p.completedAt >= :since")
    fun findRecentActivity(@Param("userId") userId: Long, @Param("since") since: LocalDateTime): List<LessonProgress>

    @Query("SELECT p FROM LessonProgress p WHERE p.user.id = :userId AND p.completed = :completed")
    fun findByUserIdAndCompleted(@Param("userId") userId: Long, completed: Boolean): List<LessonProgress>

    @Query("SELECT p FROM LessonProgress p WHERE p.user.id = :userId AND p.contentId = :contentId")
    fun findByUserIdAndContentId(@Param("userId") userId: Long, @Param("contentId") contentId: Long): LessonProgress?
}