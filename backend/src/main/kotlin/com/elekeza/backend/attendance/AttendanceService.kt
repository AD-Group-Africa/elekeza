package com.elekeza.backend.attendance

import com.elekeza.backend.auth.UserRepository
import com.elekeza.backend.institution.GuardianLinkRepository
import org.springframework.http.HttpStatus
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.server.ResponseStatusException
import java.time.LocalDate

/**
 * Attendance domain service. All authorization is enforced here (and re-checked
 * at the controller boundary) so a single place defines who may see or change a
 * register:
 *
 *  - TEACHER: only classes in their own institution (assignment lists do not
 *    exist yet, so institution membership is the trust boundary);
 *  - SCHOOL_ADMIN / ADMIN: any class within their own institution (ADMIN is
 *    platform-wide);
 *  - GUARDIAN: read-only, only via an active guardian_links row;
 *  - STUDENT: read-only, only their own history.
 */
@Service
class AttendanceService(
    private val classRepo: SchoolClassRepository,
    private val enrollmentRepo: ClassEnrollmentRepository,
    private val sessionRepo: AttendanceSessionRepository,
    private val recordRepo: AttendanceRecordRepository,
    private val userRepo: UserRepository,
    private val guardianLinkRepo: GuardianLinkRepository
) {

    fun listClasses(user: com.elekeza.backend.auth.User): List<ClassDto> {
        val institutionId = user.institutionId
            ?: return emptyList()
        return classRepo.findByInstitutionIdOrderByNameAsc(institutionId).map { c ->
            ClassDto(c.id, c.name, c.gradeLevel, enrollmentRepo.countByClassIdAndActiveTrue(c.id))
        }
    }

    /** Roster for a class: enrolled learners plus any marks already saved for `date`. */
    @Transactional
    fun classRoster(user: com.elekeza.backend.auth.User, classId: Long, date: LocalDate): List<ClassRosterEntry> {
        requireStaffAccess(user, classId)
        val learners = enrollmentRepo.findByClassIdAndActiveTrue(classId)
            .mapNotNull { userRepo.findById(it.learnerId).orElse(null) }
            .sortedBy { it.name }
        val session = sessionRepo.findByClassIdAndSessionDate(classId, date)
        val records = session?.let { recordRepo.findBySessionId(it.id) } ?: emptyList()
        val byLearner = records.associateBy { it.learnerId }
        return learners.map { l ->
            val r = byLearner[l.id]
            ClassRosterEntry(l.id, l.name, r?.status?.name, r?.note)
        }
    }

    /** Save (create or update) a whole register for one class/date in one transaction. */
    @Transactional
    fun saveAttendance(
        user: com.elekeza.backend.auth.User,
        classId: Long,
        date: LocalDate,
        entries: List<AttendanceEntryRequest>
    ): AttendanceSessionDto {
        requireStaffAccess(user, classId)
        if (entries.isEmpty()) throw ResponseStatusException(HttpStatus.BAD_REQUEST, "No attendance entries supplied")
        if (entries.size > 200) throw ResponseStatusException(HttpStatus.BAD_REQUEST, "Too many entries in one save")

        val cls = classRepo.findById(classId).orElseThrow {
            ResponseStatusException(HttpStatus.NOT_FOUND, "Class not found")
        }

        // Validate every entry against the CURRENT roster before writing anything.
        val roster = enrollmentRepo.findByClassIdAndActiveTrue(classId).map { it.learnerId }.toSet()
        entries.forEach { e ->
            if (e.learnerId !in roster) {
                throw ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Learner ${e.learnerId} is not enrolled in this class")
            }
            val status = runCatching { AttendanceStatus.valueOf(e.status.uppercase()) }
                .getOrElse { throw ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid status '${e.status}'") }
            if (e.note != null && e.note.length > 500) {
                throw ResponseStatusException(HttpStatus.BAD_REQUEST, "Note too long")
            }
        }

        // Lazy session creation — one register per class per day (DB unique).
        val session = sessionRepo.findByClassIdAndSessionDate(classId, date)
            ?: sessionRepo.save(AttendanceSession(classId = classId, sessionDate = date, recordedBy = user.id))

        entries.forEach { e ->
            val status = AttendanceStatus.valueOf(e.status.uppercase())
            val existing = recordRepo.findBySessionIdAndLearnerId(session.id, e.learnerId)
            if (existing != null) {
                // Duplicate marking is an UPDATE, never a second row.
                recordRepo.save(existing.copy(status = status, note = e.note, recordedBy = user.id, updatedAt = java.time.Instant.now()))
            } else {
                recordRepo.save(AttendanceRecord(
                    sessionId = session.id, learnerId = e.learnerId,
                    status = status, note = e.note, recordedBy = user.id
                ))
            }
        }

        val saved = recordRepo.findBySessionId(session.id)
        val counts = saved.groupingBy { it.status.name }.eachCount()
        val nameByLearner = saved.mapNotNull { userRepo.findById(it.learnerId).orElse(null) }.associate { it.id to it.name }
        return AttendanceSessionDto(
            sessionId = session.id,
            classId = cls.id,
            className = cls.name,
            date = session.sessionDate,
            recordedBy = session.recordedBy,
            counts = mapOf(
                "PRESENT" to (counts["PRESENT"] ?: 0).toLong(),
                "ABSENT" to (counts["ABSENT"] ?: 0).toLong(),
                "LATE" to (counts["LATE"] ?: 0).toLong(),
                "EXCUSED" to (counts["EXCUSED"] ?: 0).toLong()
            ),
            records = saved.map { r ->
                AttendanceRecordDto(
                    learnerId = r.learnerId,
                    learnerName = nameByLearner[r.learnerId] ?: "Learner ${r.learnerId}",
                    status = r.status.name,
                    note = r.note
                )
            }
        )
    }

    /** Attendance history for one learner — staff (same institution) or self or linked guardian. */
    fun learnerAttendance(viewer: com.elekeza.backend.auth.User, learnerId: Long): LearnerAttendanceDto {
        val self = viewer.id == learnerId
        val isStaff = viewer.role in setOf(com.elekeza.backend.auth.UserRole.TEACHER, com.elekeza.backend.auth.UserRole.SCHOOL_ADMIN, com.elekeza.backend.auth.UserRole.ADMIN)
        val isLinkedGuardian = viewer.role == com.elekeza.backend.auth.UserRole.GUARDIAN &&
            guardianLinkRepo.findByGuardianId(viewer.id).any { it.learnerId == learnerId && it.isActive }

        if (!self && !isStaff && !isLinkedGuardian) {
            throw ResponseStatusException(HttpStatus.FORBIDDEN, "Not authorized to view this learner's attendance")
        }
        if (isStaff && viewer.role != com.elekeza.backend.auth.UserRole.ADMIN) {
            // Tenant boundary: staff only see learners of their own institution.
            val learner = userRepo.findById(learnerId).orElse(null)
                ?: throw ResponseStatusException(HttpStatus.NOT_FOUND, "Learner not found")
            if (learner.institutionId != viewer.institutionId) {
                throw ResponseStatusException(HttpStatus.FORBIDDEN, "Not authorized to view this learner's attendance")
            }
        }

        val learner = userRepo.findById(learnerId).orElse(null)
            ?: throw ResponseStatusException(HttpStatus.NOT_FOUND, "Learner not found")

        val records = recordRepo.findByLearnerIdOrderBySessionIdDesc(learnerId)
        val sessionIds = records.map { it.sessionId }.toSet()
        val sessionById = sessionRepo.findAllById(sessionIds).associateBy { it.id }
        val classById = sessionById.values.associate { it.classId to (classRepo.findById(it.classId).orElse(null)?.name ?: "Class") }

        val counts = records.groupingBy { it.status.name }.eachCount()
        // Rate counts PRESENT+LATE as attended; EXCUSED is neither penalized nor rewarded.
        val assessed = (counts["PRESENT"] ?: 0) + (counts["ABSENT"] ?: 0) + (counts["LATE"] ?: 0)
        val attended = (counts["PRESENT"] ?: 0) + (counts["LATE"] ?: 0)
        val rate = if (assessed > 0) attended * 100.0 / assessed else 100.0

        return LearnerAttendanceDto(
            learnerId = learner.id,
            learnerName = learner.name,
            className = enrollmentRepo.findByLearnerIdAndActiveTrue(learnerId).firstOrNull()
                ?.let { classRepo.findById(it.classId).orElse(null)?.name },
            sessionsMarked = records.size.toLong(),
            counts = mapOf(
                "PRESENT" to (counts["PRESENT"] ?: 0).toLong(),
                "ABSENT" to (counts["ABSENT"] ?: 0).toLong(),
                "LATE" to (counts["LATE"] ?: 0).toLong(),
                "EXCUSED" to (counts["EXCUSED"] ?: 0).toLong()
            ),
            attendanceRate = Math.round(rate * 10) / 10.0,
            records = records.mapNotNull { r ->
                val s = sessionById[r.sessionId] ?: return@mapNotNull null
                LearnerAttendanceEntryDto(s.sessionDate, r.status.name, r.note, classById[s.classId] ?: "Class")
            }
        )
    }

    /** Institution-wide summary for admins (counts per status over a date range). */
    fun institutionSummary(user: com.elekeza.backend.auth.User, from: LocalDate, to: LocalDate): Map<String, Any> {
        if (user.role !in setOf(com.elekeza.backend.auth.UserRole.SCHOOL_ADMIN, com.elekeza.backend.auth.UserRole.ADMIN)) {
            throw ResponseStatusException(HttpStatus.FORBIDDEN, "Not authorized")
        }
        val classIds = if (user.role == com.elekeza.backend.auth.UserRole.ADMIN && user.institutionId == null) {
            classRepo.findAll().map { it.id }
        } else {
            classRepo.findByInstitutionIdOrderByNameAsc(user.institutionId ?: -1L).map { it.id }
        }
        val sessions = sessionRepo.findByClassIdInAndSessionDateBetween(classIds, from, to)
        val records = recordRepo.findBySessionIdIn(sessions.map { it.id })
        val counts = records.groupingBy { it.status.name }.eachCount()
        val assessed = (counts["PRESENT"] ?: 0) + (counts["ABSENT"] ?: 0) + (counts["LATE"] ?: 0)
        val attended = (counts["PRESENT"] ?: 0) + (counts["LATE"] ?: 0)
        return mapOf(
            "from" to from.toString(),
            "to" to to.toString(),
            "sessions" to sessions.size.toLong(),
            "records" to records.size.toLong(),
            "counts" to mapOf(
                "PRESENT" to (counts["PRESENT"] ?: 0).toLong(),
                "ABSENT" to (counts["ABSENT"] ?: 0).toLong(),
                "LATE" to (counts["LATE"] ?: 0).toLong(),
                "EXCUSED" to (counts["EXCUSED"] ?: 0).toLong()
            ),
            "attendanceRate" to if (assessed > 0) Math.round(attended * 1000.0 / assessed) / 10.0 else 100.0
        )
    }

    private fun requireStaffAccess(user: com.elekeza.backend.auth.User, classId: Long) {
        val cls = classRepo.findById(classId).orElse(null)
            ?: throw ResponseStatusException(HttpStatus.NOT_FOUND, "Class not found")
        when (user.role) {
            com.elekeza.backend.auth.UserRole.ADMIN -> { /* platform-wide */ }
            com.elekeza.backend.auth.UserRole.TEACHER, com.elekeza.backend.auth.UserRole.SCHOOL_ADMIN -> {
                if (user.institutionId == null || cls.institutionId != user.institutionId) {
                    throw ResponseStatusException(HttpStatus.FORBIDDEN, "Not authorized for this class")
                }
            }
            else -> throw ResponseStatusException(HttpStatus.FORBIDDEN, "Not authorized for this class")
        }
    }
}
