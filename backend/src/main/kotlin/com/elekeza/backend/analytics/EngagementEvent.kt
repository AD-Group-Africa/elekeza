package com.elekeza.backend.analytics

import jakarta.persistence.*
import java.time.Instant

/**
 * Append-only engagement telemetry for pilot evidence: which learners start
 * and complete lessons/quizzes/exams/assignments, and which accessibility
 * features they actually use. No free text — [VALID_EVENT_TYPES] is enforced.
 * Aggregation endpoints return counts only (never individual rows) so the
 * analytics surface stays privacy-conscious by construction.
 */
@Entity
@Table(name = "engagement_events")
data class EngagementEvent(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,
    @Column(name = "user_id")
    val userId: Long? = null,
    @Column(name = "institution_id")
    val institutionId: Long? = null,
    @Column(name = "event_type", nullable = false)
    val eventType: String,
    @Column(name = "ref_type")
    val refType: String? = null,
    @Column(name = "ref_id")
    val refId: Long? = null,
    @Column(nullable = false, columnDefinition = "jsonb")
    val metadata: String = "{}",
    @Column(name = "created_at", nullable = false)
    val createdAt: Instant = Instant.now()
) {
    companion object {
        val VALID_EVENT_TYPES = setOf(
            "LESSON_STARTED", "LESSON_COMPLETED",
            "QUIZ_STARTED", "QUIZ_COMPLETED",
            "EXAM_STARTED", "EXAM_SUBMITTED",
            "ASSIGNMENT_VIEWED", "ASSIGNMENT_SUBMITTED",
            "TUTOR_OPENED", "TUTOR_ACTION_USED",
            "TTS_USED", "THEME_CHANGED", "A11Y_SETTING_CHANGED",
        )
        val VALID_REF_TYPES = setOf("LESSON", "QUIZ", "EXAM", "ASSIGNMENT", "TUTOR", "A11Y", null)
    }
}

interface EngagementEventRepository : org.springframework.data.jpa.repository.JpaRepository<EngagementEvent, Long> {
    fun findByInstitutionIdAndCreatedAtAfter(institutionId: Long, after: Instant): List<EngagementEvent>
    fun countByInstitutionIdAndEventTypeAndCreatedAtAfter(institutionId: Long, eventType: String, after: Instant): Long
    fun findByUserIdAndCreatedAtAfter(userId: Long, after: Instant): List<EngagementEvent>
}
