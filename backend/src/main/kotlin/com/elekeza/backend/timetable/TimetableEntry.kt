package com.elekeza.backend.timetable

import jakarta.persistence.*
import java.time.Instant

/**
 * One persisted timetable slot for a class: (class, day, period). The unique
 * constraint lives in V13; a teacher conflict (same teacher, same day/period,
 * different class) is validated in [TimetableService].
 */
enum class TimetableDay { MONDAY, TUESDAY, WEDNESDAY, THURSDAY, FRIDAY }

@Entity
@Table(name = "timetable_entries")
data class TimetableEntry(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,
    @Column(name = "institution_id", nullable = false)
    val institutionId: Long,
    @Column(name = "class_id", nullable = false)
    val classId: Long,
    @Column(name = "day_of_week", nullable = false)
    val dayOfWeek: String,   // stored as the TimetableDay enum name
    @Column(name = "period", nullable = false)
    val period: Int,
    @Column(nullable = false)
    val subject: String,
    @Column(name = "teacher_id")
    val teacherId: Long? = null,
    @Column(name = "updated_by")
    val updatedBy: Long? = null,
    @Column(name = "created_at", nullable = false)
    val createdAt: Instant = Instant.now(),
    @Column(name = "updated_at", nullable = false)
    val updatedAt: Instant = Instant.now()
)

interface TimetableEntryRepository : org.springframework.data.jpa.repository.JpaRepository<TimetableEntry, Long> {
    fun findByClassIdOrderByPeriodAsc(classId: Long): List<TimetableEntry>
    fun findByInstitutionId(institutionId: Long): List<TimetableEntry>
    fun findByClassIdAndDayOfWeekAndPeriod(classId: Long, dayOfWeek: String, period: Int): TimetableEntry?
    fun findByClassIdAndDayOfWeek(classId: Long, dayOfWeek: String): List<TimetableEntry>
    fun deleteByClassId(classId: Long)
}
