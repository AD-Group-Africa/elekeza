package com.elekeza.backend.personalization

import jakarta.persistence.*
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.stereotype.Repository
import java.time.Instant

/**
 * A cached per-student content adaptation. The cache key is
 * (learnerId, contentId, adaptationCode) — the same learner+content+style
 * request reuses the stored variant instead of invoking the AI again.
 * payload is the rendered/adaptation document.
 */
@Entity
@Table(
    name = "content_adaptations",
    indexes = [
        Index(name = "idx_adapt_learner_content", columnList = "learner_id,content_id"),
        Index(name = "idx_adapt_learner_code", columnList = "learner_id,content_id,adaptation_code", unique = true)
    ]
)
data class ContentAdaptation(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,
    @Column(name = "learner_id", nullable = false) val learnerId: Long,
    @Column(name = "content_id", nullable = false) val contentId: Long,
    @Column(name = "adaptation_code", length = 32, nullable = false) val adaptationCode: String,
    @Column(name = "source_text_hash", length = 64, nullable = false) val sourceTextHash: String,
    @Column(columnDefinition = "TEXT", nullable = false) val adaptedText: String,
    @Column(name = "created_at", nullable = false) val createdAt: Instant = Instant.now()
)

/** Every adaptation/feedback event is attributable and auditable. */
@Entity
@Table(
    name = "adaptation_events",
    indexes = [Index(name = "idx_adapt_events_learner", columnList = "learner_id,content_id")]
)
data class AdaptationEvent(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,
    @Column(name = "learner_id", nullable = false) val learnerId: Long,
    @Column(name = "content_id") val contentId: Long? = null,
    @Column(name = "event_type", length = 40, nullable = false) val eventType: String,
    @Column(length = 2000) val detail: String? = null,
    @Column(name = "created_at", nullable = false) val createdAt: Instant = Instant.now()
)

@Repository
interface ContentAdaptationRepository : JpaRepository<ContentAdaptation, Long> {
    fun findByLearnerIdAndContentIdAndAdaptationCode(
        learnerId: Long, contentId: Long, code: String
    ): ContentAdaptation?

    fun countByLearnerId(learnerId: Long): Long
}

@Repository
interface AdaptationEventRepository : JpaRepository<AdaptationEvent, Long> {
    fun findByLearnerIdAndContentIdOrderByCreatedAtDesc(learnerId: Long, contentId: Long?): List<AdaptationEvent>
}
