package com.elekeza.backend.support

import jakarta.persistence.*
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.stereotype.Repository
import java.time.Instant
import java.time.LocalDate

enum class SignalType { LOW_PERFORMANCE, DECLINING, REPEATED_FAILURES, INACTIVITY }
enum class SignalStatus { OPEN, ACKNOWLEDGED, DISMISSED }
enum class InterventionStatus { ACTIVE, COMPLETED, CANCELLED }
enum class InterventionType { EXTRA_PRACTICE, REVIEW_SESSION, PEER_SUPPORT, PARENT_CONTACT, OTHER }

@Entity
@Table(name = "support_flags", indexes = [
    Index(name = "idx_support_flag_learner", columnList = "learner_id"),
    Index(name = "idx_support_flag_status", columnList = "status")
])
data class SupportFlag(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,
    @Column(name = "learner_id", nullable = false) val learnerId: Long,
    @Column(name = "teacher_id") val teacherId: Long? = null,
    @Enumerated(EnumType.STRING)
    @Column(name = "signal_type", nullable = false, length = 50) val signalType: SignalType,
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20) val status: SignalStatus = SignalStatus.OPEN,
    @Column(columnDefinition = "TEXT", nullable = false) val reasons: String,
    @Column(name = "created_at") val createdAt: Instant = Instant.now(),
    @Column(name = "reviewed_at") val reviewedAt: Instant? = null
)

@Entity
@Table(name = "interventions", indexes = [
    Index(name = "idx_intervention_learner", columnList = "learner_id"),
    Index(name = "idx_intervention_status", columnList = "status")
])
data class Intervention(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,
    @Column(name = "learner_id", nullable = false) val learnerId: Long,
    @Column(name = "teacher_id", nullable = false) val teacherId: Long,
    @Column(name = "signal_id") val signalId: Long? = null,
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 50) val type: InterventionType,
    @Column(columnDefinition = "TEXT", nullable = false) val target: String,
    @Column(name = "start_date", nullable = false) val startDate: LocalDate,
    @Column(name = "review_date") val reviewDate: LocalDate? = null,
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20) val status: InterventionStatus = InterventionStatus.ACTIVE,
    @Column(columnDefinition = "TEXT") val outcome: String? = null,
    @Column(name = "created_at") val createdAt: Instant = Instant.now(),
    @Column(name = "updated_at") val updatedAt: Instant = Instant.now()
)

@Repository
interface SupportFlagRepository : JpaRepository<SupportFlag, Long> {
    fun findByLearnerIdAndSignalTypeAndStatus(learnerId: Long, signalType: SignalType, status: SignalStatus): SupportFlag?
    fun findByStatusOrderByCreatedAtDesc(status: SignalStatus): List<SupportFlag>
    fun findByLearnerIdInAndStatusOrderByCreatedAtDesc(learnerIds: Collection<Long>, status: SignalStatus): List<SupportFlag>
}

@Repository
interface InterventionRepository : JpaRepository<Intervention, Long> {
    fun findByLearnerIdOrderByCreatedAtDesc(learnerId: Long): List<Intervention>
    fun findByLearnerIdInOrderByCreatedAtDesc(learnerIds: Collection<Long>): List<Intervention>
}
