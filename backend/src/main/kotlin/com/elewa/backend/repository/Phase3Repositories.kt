package com.elewa.backend.repository

import com.elewa.backend.model.*
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param
import java.util.UUID

interface LessonRepository : JpaRepository<Lesson, UUID> {
    fun findAllByLearnerIdOrderByCreatedAtDesc(learnerId: UUID): List<Lesson>
    fun countByLearnerId(learnerId: UUID): Long
}

interface LessonSectionRepository : JpaRepository<LessonSection, UUID> {
    fun findAllByLessonIdOrderBySequenceNumberAsc(lessonId: UUID): List<LessonSection>
}

interface KeyTermRepository : JpaRepository<KeyTerm, UUID> {
    fun findAllByLessonId(lessonId: UUID): List<KeyTerm>
}

interface QuizRepository : JpaRepository<Quiz, UUID> {
    fun findFirstByLessonIdAndLearnerIdAndCompletedAtIsNullOrderByCreatedAtDesc(
        lessonId: UUID,
        learnerId: UUID
    ): Quiz?
    fun findAllByLearnerIdOrderByCreatedAtDesc(learnerId: UUID): List<Quiz>

    @Query("SELECT AVG(q.scorePercentage) FROM Quiz q WHERE q.learner.id = :learnerId AND q.completedAt IS NOT NULL")
    fun avgScoreByLearnerId(@Param("learnerId") learnerId: UUID): Double?
}

interface QuizQuestionRepository : JpaRepository<QuizQuestion, UUID> {
    fun findAllByQuizIdOrderBySequenceNumberAsc(quizId: UUID): List<QuizQuestion>
}

interface QuizResponseRepository : JpaRepository<QuizResponse, UUID> {
    fun findAllByQuizId(quizId: UUID): List<QuizResponse>
}
