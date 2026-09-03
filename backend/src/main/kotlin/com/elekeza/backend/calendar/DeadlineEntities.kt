package com.elekeza.backend.calendar

import jakarta.persistence.*
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.stereotype.Repository
import java.time.Instant

enum class DeadlineType { EXAM, ASSIGNMENT, APPLICATION, CURRICULUM, SCHOOL_EVENT, OTHER }
enum class DeadlineScope { NATIONAL, REGIONAL, INSTITUTION, CLASS, INDIVIDUAL }

@Entity
@Table(name = "deadlines", indexes = [
    Index(name = "idx_deadline_scope", columnList = "scope"),
    Index(name = "idx_deadline_due", columnList = "due_at"),
    Index(name = "idx_deadline_user", columnList = "user_id"),
    Index(name = "idx_deadline_inst", columnList = "institution_id")
])
data class Deadline(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,
    @Column(name = "institution_id") val institutionId: Long? = null,
    @Column(name = "user_id") val userId: Long? = null,
    @Column(nullable = false) val title: String,
    @Enumerated(EnumType.STRING)
    @Column(name = "deadline_type", nullable = false, length = 50) val deadlineType: DeadlineType,
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20) val scope: DeadlineScope = DeadlineScope.INSTITUTION,
    @Column(name = "due_at", nullable = false) val dueAt: Instant,
    @Column(columnDefinition = "TEXT") val description: String? = null,
    @Column(name = "created_by", nullable = false) val createdBy: Long,
    @Column(name = "created_at") val createdAt: Instant = Instant.now()
)

@Repository
interface DeadlineRepository : JpaRepository<Deadline, Long> {
    fun findByInstitutionIdOrderByDueAtAsc(institutionId: Long): List<Deadline>
    fun findByUserIdOrderByDueAtAsc(userId: Long): List<Deadline>
}
