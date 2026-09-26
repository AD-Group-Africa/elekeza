package com.elekeza.backend.timetable

import com.elekeza.backend.attendance.ClassEnrollmentRepository
import com.elekeza.backend.attendance.SchoolClassRepository
import com.elekeza.backend.auth.User
import com.elekeza.backend.auth.UserRepository
import com.elekeza.backend.auth.UserRole
import org.springframework.http.HttpStatus
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.server.ResponseStatusException

/**
 * Persisted class timetable. Replaces the previous client-only grid.
 *
 * Authorization: teachers read/write timetables of classes in their own
 * institution (class teachers are not modelled separately, so any teacher of
 * the institution may maintain the timetable — consistent with attendance's
 * institution scoping); admins likewise within their tenant.
 */
@Service
@Transactional
class TimetableService(
    private val timetableEntryRepository: TimetableEntryRepository,
    private val schoolClassRepository: SchoolClassRepository,
    private val userRepository: UserRepository,
) {
    companion object {
        val VALID_DAYS = TimetableDay.entries.map { it.name }.toSet()
        val PERIODS = 1..8
    }

    data class SlotRequest(
        val classId: Long,
        val day: String,
        val period: Int,
        val subject: String,
        val teacherId: Long? = null,
    )

    fun getTimetable(actor: User, classId: Long): List<TimetableEntry> {
        val schoolClass = schoolClassRepository.findById(classId).orElse(null)
            ?: throw ResponseStatusException(HttpStatus.NOT_FOUND, "Class not found")
        requireSameInstitution(actor, schoolClass.institutionId)
        return timetableEntryRepository.findByClassIdOrderByPeriodAsc(classId)
    }

    fun setSlot(actor: User, req: SlotRequest): TimetableEntry {
        val schoolClass = schoolClassRepository.findById(req.classId).orElse(null)
            ?: throw ResponseStatusException(HttpStatus.NOT_FOUND, "Class not found")
        requireSameInstitution(actor, schoolClass.institutionId)

        val day = req.day.trim().uppercase()
        if (day !in VALID_DAYS) throw ResponseStatusException(HttpStatus.BAD_REQUEST, "day must be one of $VALID_DAYS")
        if (req.period !in PERIODS) throw ResponseStatusException(HttpStatus.BAD_REQUEST, "period must be 1-8")
        if (req.subject.isBlank()) throw ResponseStatusException(HttpStatus.BAD_REQUEST, "subject is required")
        if (req.subject.length > 255) throw ResponseStatusException(HttpStatus.BAD_REQUEST, "subject is too long")

        req.teacherId?.let { teacherId ->
            val teacher = userRepository.findById(teacherId).orElse(null)
                ?: throw ResponseStatusException(HttpStatus.NOT_FOUND, "Teacher not found")
            if (teacher.institutionId != schoolClass.institutionId) {
                throw ResponseStatusException(HttpStatus.NOT_FOUND, "Teacher not found")
            }
            // Teacher conflict: same teacher, same day+period, a DIFFERENT class.
            val clashes = timetableEntryRepository.findByInstitutionId(schoolClass.institutionId)
                .any { entry ->
                    entry.teacherId == teacherId &&
                        entry.dayOfWeek == day &&
                        entry.period == req.period &&
                        entry.classId != schoolClass.id
                }
            if (clashes) {
                throw ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "That teacher is already timetabled for another class in this period"
                )
            }
        }

        val existing = timetableEntryRepository
            .findByClassIdAndDayOfWeekAndPeriod(schoolClass.id, day, req.period)
        val entry = if (existing != null) {
            TimetableEntry(
                id = existing.id,
                institutionId = existing.institutionId,
                classId = existing.classId,
                dayOfWeek = day,
                period = existing.period,
                subject = req.subject.trim(),
                teacherId = req.teacherId,
                updatedBy = actor.id,
            )
        } else {
            TimetableEntry(
                institutionId = schoolClass.institutionId,
                classId = schoolClass.id,
                dayOfWeek = day,
                period = req.period,
                subject = req.subject.trim(),
                teacherId = req.teacherId,
                updatedBy = actor.id,
            )
        }
        return timetableEntryRepository.save(entry)
    }

    fun clearSlot(actor: User, classId: Long, day: String, period: Int) {
        val schoolClass = schoolClassRepository.findById(classId).orElse(null)
            ?: throw ResponseStatusException(HttpStatus.NOT_FOUND, "Class not found")
        requireSameInstitution(actor, schoolClass.institutionId)
        val dayNorm = day.trim().uppercase()
        val existing = timetableEntryRepository.findByClassIdAndDayOfWeekAndPeriod(classId, dayNorm, period)
            ?: return
        timetableEntryRepository.delete(existing)
    }

    private fun requireSameInstitution(actor: User, institutionId: Long) {
        if (actor.role != UserRole.ADMIN && actor.institutionId != institutionId) {
            throw ResponseStatusException(HttpStatus.NOT_FOUND, "Class not found")
        }
    }
}
