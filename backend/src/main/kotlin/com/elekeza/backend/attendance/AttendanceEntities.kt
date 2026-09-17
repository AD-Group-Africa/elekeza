package com.elekeza.backend.attendance

import com.elekeza.backend.auth.User
import jakarta.persistence.*
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param
import org.springframework.stereotype.Repository
import java.time.Instant
import java.time.LocalDate

// ── Entities ──────────────────────────────────────────────────────────────────

@Entity
@Table(name = "classes", indexes = [Index(name = "idx_class_institution", columnList = "institution_id")])
data class SchoolClass(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,
    @Column(name = "institution_id", nullable = false) val institutionId: Long,
    @Column(nullable = false) val name: String,
    @Column(name = "grade_level") val gradeLevel: String? = null,
    @Column(name = "created_at") val createdAt: Instant = Instant.now()
)

@Entity
@Table(name = "class_enrollments", indexes = [
    Index(name = "idx_enrollment_class", columnList = "class_id"),
    Index(name = "idx_enrollment_learner", columnList = "learner_id")
])
data class ClassEnrollment(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,
    @Column(name = "class_id", nullable = false) val classId: Long,
    @Column(name = "learner_id", nullable = false) val learnerId: Long,
    @Column(name = "enrolled_at", nullable = false) val enrolledAt: Instant = Instant.now(),
    @Column(nullable = false) val active: Boolean = true
)

enum class AttendanceStatus { PRESENT, ABSENT, LATE, EXCUSED }

@Entity
@Table(name = "attendance_sessions", indexes = [
    Index(name = "idx_session_class", columnList = "class_id"),
    Index(name = "idx_session_date", columnList = "session_date")
])
data class AttendanceSession(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,
    @Column(name = "class_id", nullable = false) val classId: Long,
    @Column(name = "session_date", nullable = false) val sessionDate: LocalDate,
    @Column(name = "recorded_by", nullable = false) val recordedBy: Long,
    @Column(name = "created_at", nullable = false) val createdAt: Instant = Instant.now(),
    @Column(name = "updated_at", nullable = false) val updatedAt: Instant = Instant.now()
)

@Entity
@Table(name = "attendance_records", indexes = [
    Index(name = "idx_record_session", columnList = "session_id"),
    Index(name = "idx_record_learner", columnList = "learner_id")
])
data class AttendanceRecord(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,
    @Column(name = "session_id", nullable = false) val sessionId: Long,
    @Column(name = "learner_id", nullable = false) val learnerId: Long,
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20) val status: AttendanceStatus,
    @Column(columnDefinition = "VARCHAR(500)") val note: String? = null,
    @Column(name = "recorded_by", nullable = false) val recordedBy: Long,
    @Column(name = "created_at", nullable = false) val createdAt: Instant = Instant.now(),
    @Column(name = "updated_at", nullable = false) val updatedAt: Instant = Instant.now()
)

// ── Repositories ──────────────────────────────────────────────────────────────

@Repository
interface SchoolClassRepository : JpaRepository<SchoolClass, Long> {
    fun findByInstitutionIdOrderByNameAsc(institutionId: Long): List<SchoolClass>
}

@Repository
interface ClassEnrollmentRepository : JpaRepository<ClassEnrollment, Long> {
    fun findByClassIdAndActiveTrue(classId: Long): List<ClassEnrollment>
    fun findByLearnerIdAndActiveTrue(learnerId: Long): List<ClassEnrollment>
    fun countByClassIdAndActiveTrue(classId: Long): Long
}

@Repository
interface AttendanceSessionRepository : JpaRepository<AttendanceSession, Long> {
    fun findByClassIdAndSessionDate(classId: Long, sessionDate: LocalDate): AttendanceSession?
    fun findByClassIdOrderBySessionDateDesc(classId: Long): List<AttendanceSession>
    fun findByClassIdInAndSessionDateBetween(classIds: Collection<Long>, from: LocalDate, to: LocalDate): List<AttendanceSession>
    @Query("select s from AttendanceSession s where s.id in (select r.sessionId from AttendanceRecord r where r.learnerId = :learnerId)")
    fun findSessionsForLearner(@Param("learnerId") learnerId: Long): List<AttendanceSession>
}

@Repository
interface AttendanceRecordRepository : JpaRepository<AttendanceRecord, Long> {
    fun findBySessionId(sessionId: Long): List<AttendanceRecord>
    fun findByLearnerIdOrderBySessionIdDesc(learnerId: Long): List<AttendanceRecord>
    fun findBySessionIdAndLearnerId(sessionId: Long, learnerId: Long): AttendanceRecord?
    fun findBySessionIdIn(sessionIds: Collection<Long>): List<AttendanceRecord>
}

// ── DTOs ──────────────────────────────────────────────────────────────────────

data class ClassDto(val id: Long, val name: String, val gradeLevel: String?, val learnerCount: Long)

data class ClassRosterEntry(val learnerId: Long, val learnerName: String, val status: String?, val note: String?)

data class SaveAttendanceRequest(val records: List<AttendanceEntryRequest>)

data class AttendanceEntryRequest(
    val learnerId: Long,
    val status: String,        // PRESENT | ABSENT | LATE | EXCUSED
    val note: String? = null
)

data class AttendanceSessionDto(
    val sessionId: Long,
    val classId: Long,
    val className: String,
    val date: LocalDate,
    val recordedBy: Long,
    val counts: Map<String, Long>,
    val records: List<AttendanceRecordDto>
)

data class AttendanceRecordDto(
    val learnerId: Long,
    val learnerName: String,
    val status: String,
    val note: String?
)

data class LearnerAttendanceDto(
    val learnerId: Long,
    val learnerName: String,
    val className: String?,
    val sessionsMarked: Long,
    val counts: Map<String, Long>,
    val attendanceRate: Double,     // PRESENT+LATE over sessions with any mark (EXCUSED excluded)
    val records: List<LearnerAttendanceEntryDto>
)

data class LearnerAttendanceEntryDto(
    val date: LocalDate,
    val status: String,
    val note: String?,
    val className: String
)
