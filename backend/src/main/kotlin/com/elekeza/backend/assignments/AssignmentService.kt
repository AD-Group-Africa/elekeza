package com.elekeza.backend.assignments

import com.elekeza.backend.attendance.ClassEnrollmentRepository
import com.elekeza.backend.attendance.SchoolClassRepository
import com.elekeza.backend.auth.User
import com.elekeza.backend.auth.UserRepository
import com.elekeza.backend.institution.GuardianLinkRepository
import org.springframework.http.HttpStatus
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.server.ResponseStatusException

/**
 * Assignment domain service. Authorization rules (single source of truth):
 *
 *  - TEACHER: create/update assignments for classes in their own institution;
 *    grade submissions for their institution's assignments;
 *  - SCHOOL_ADMIN: same as teacher within own institution (staff trust boundary);
 *  - ADMIN: platform-wide;
 *  - STUDENT: read PUBLISHED assignments for their enrolled class; create/update
 *    ONLY their own submission; never grade;
 *  - GUARDIAN: read-only evidence for linked ward(s) via guardian_links.
 */
@Service
class AssignmentService(
    private val assignmentRepo: AssignmentRepository,
    private val submissionRepo: AssignmentSubmissionRepository,
    private val classRepo: SchoolClassRepository,
    private val enrollmentRepo: ClassEnrollmentRepository,
    private val userRepo: UserRepository,
    private val guardianLinkRepo: GuardianLinkRepository
) {

    // ── Teacher / admin ──────────────────────────────────────────────────────

    @Transactional
    fun create(user: User, req: CreateAssignmentRequest): AssignmentDto {
        val institutionId = user.institutionId
            ?: throw ResponseStatusException(HttpStatus.FORBIDDEN, "No institution")
        val clazz = classRepo.findById(req.classId)
            .orElseThrow { ResponseStatusException(HttpStatus.NOT_FOUND, "Class not found") }
        // tenant boundary: the class must belong to the staff member's institution
        if (user.role.name != "ADMIN" && clazz.institutionId != institutionId) {
            throw ResponseStatusException(HttpStatus.FORBIDDEN, "Class belongs to another institution")
        }
        val title = req.title.trim()
        if (title.isEmpty()) throw ResponseStatusException(HttpStatus.BAD_REQUEST, "Title is required")
        val points = req.points.takeIf { it > 0 }
            ?: throw ResponseStatusException(HttpStatus.BAD_REQUEST, "Points must be positive")
        val saved = assignmentRepo.save(
            Assignment(
                institutionId = clazz.institutionId,
                classId = clazz.id,
                createdBy = user.id,
                title = title.take(200),
                instructions = req.instructions?.take(10_000),
                dueDate = req.dueDate,
                points = points
            )
        )
        return toDto(saved)
    }

    @Transactional
    fun update(user: User, id: Long, req: UpdateAssignmentRequest): AssignmentDto {
        val a = loadForStaff(user, id)
        val updated = a.copy(
            title = (req.title?.trim()?.takeIf { it.isNotEmpty() } ?: a.title).take(200),
            instructions = req.instructions?.take(10_000) ?: a.instructions,
            dueDate = req.dueDate ?: a.dueDate,
            points = req.points?.takeIf { it > 0 } ?: a.points,
            status = req.status?.let { parseStatus(it) } ?: a.status,
            updatedAt = java.time.Instant.now()
        )
        return toDto(assignmentRepo.save(updated))
    }

    @Transactional(readOnly = true)
    fun classAssignments(user: User, classId: Long): List<AssignmentDto> {
        requireClassVisible(user, classId)
        return assignmentRepo.findByInstitutionIdAndClassIdOrderByDueDateDesc(user.institutionId ?: -1, classId)
            .map { toDto(it) }
    }

    @Transactional(readOnly = true)
    fun myLearnerAssignments(user: User): List<AssignmentDto> {
        val classIds = enrollmentRepo.findByLearnerIdAndActiveTrue(user.id).map { it.classId }
        return assignmentRepo.findByClassIdInAndStatus(classIds, AssignmentStatus.PUBLISHED)
            .map { toDto(it) }
    }

    @Transactional
    fun submit(user: User, assignmentId: Long, req: SubmitAssignmentRequest): SubmissionDto {
        val a = assignmentRepo.findById(assignmentId)
            .orElseThrow { ResponseStatusException(HttpStatus.NOT_FOUND, "Assignment not found") }
        if (a.status != AssignmentStatus.PUBLISHED) {
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, "Assignment is not open for submissions")
        }
        val enrolled = enrollmentRepo.findByLearnerIdAndActiveTrue(user.id).any { it.classId == a.classId }
        if (!enrolled) throw ResponseStatusException(HttpStatus.FORBIDDEN, "Not enrolled in this class")
        val content = req.content.trim()
        if (content.isEmpty()) throw ResponseStatusException(HttpStatus.BAD_REQUEST, "Submission is empty")
        // one submission per learner: resubmission updates the existing row
        val existing = submissionRepo.findByAssignmentIdAndLearnerId(a.id, user.id)
        val saved = submissionRepo.save(
            (existing ?: AssignmentSubmission(assignmentId = a.id, learnerId = user.id, content = ""))
                .copy(content = content.take(20_000), submittedAt = java.time.Instant.now(), updatedAt = java.time.Instant.now())
        )
        return toDto(saved, a, user.name)
    }

    @Transactional(readOnly = true)
    fun submissionsForAssignment(user: User, assignmentId: Long): List<SubmissionDto> {
        val a = loadForStaff(user, assignmentId)
        return submissionRepo.findByAssignmentId(a.id).map { s ->
            toDto(s, a, userRepo.findById(s.learnerId).orElse(null)?.name)
        }
    }

    @Transactional
    fun grade(user: User, submissionId: Long, req: GradeSubmissionRequest): SubmissionDto {
        val s = submissionRepo.findById(submissionId)
            .orElseThrow { ResponseStatusException(HttpStatus.NOT_FOUND, "Submission not found") }
        val a = loadForStaff(user, s.assignmentId) // tenant boundary
        if (req.score < 0 || req.score > a.points) {
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, "Score must be between 0 and ${a.points}")
        }
        val graded = s.copy(
            score = req.score,
            feedback = req.feedback?.take(2000),
            gradedBy = user.id,
            gradedAt = java.time.Instant.now(),
            updatedAt = java.time.Instant.now()
        )
        return toDto(submissionRepo.save(graded), a, userRepo.findById(s.learnerId).orElse(null)?.name)
    }

    // ── Learner / guardian reads ─────────────────────────────────────────────

    @Transactional(readOnly = true)
    fun mySubmissions(user: User): List<SubmissionDto> =
        submissionRepo.findByLearnerIdOrderBySubmittedAtDesc(user.id).map { s ->
            val a = assignmentRepo.findById(s.assignmentId).orElse(null)
            toDto(s, a, user.name)
        }

    @Transactional(readOnly = true)
    fun wardSubmissions(user: User, learnerId: Long): List<SubmissionDto> {
        requireGuardianOf(user, learnerId)
        return submissionRepo.findByLearnerIdOrderBySubmittedAtDesc(learnerId).map { s ->
            val a = assignmentRepo.findById(s.assignmentId).orElse(null)
            toDto(s, a, userRepo.findById(learnerId).orElse(null)?.name)
        }
    }

    // ── Authorization helpers ─────────────────────────────────────────────────

    private fun loadForStaff(user: User, assignmentId: Long): Assignment {
        val a = assignmentRepo.findById(assignmentId)
            .orElseThrow { ResponseStatusException(HttpStatus.NOT_FOUND, "Assignment not found") }
        if (user.role.name != "ADMIN" && a.institutionId != user.institutionId) {
            // 404, not 403: do not reveal other institutions' resources
            throw ResponseStatusException(HttpStatus.NOT_FOUND, "Assignment not found")
        }
        return a
    }

    private fun requireClassVisible(user: User, classId: Long) {
        val clazz = classRepo.findById(classId)
            .orElseThrow { ResponseStatusException(HttpStatus.NOT_FOUND, "Class not found") }
        val staff = user.role.name == "TEACHER" || user.role.name == "SCHOOL_ADMIN" || user.role.name == "ADMIN"
        if (staff) {
            if (user.role.name != "ADMIN" && clazz.institutionId != user.institutionId) {
                throw ResponseStatusException(HttpStatus.NOT_FOUND, "Class not found")
            }
            return
        }
        val enrolled = enrollmentRepo.findByLearnerIdAndActiveTrue(user.id).any { it.classId == classId }
        if (!enrolled) throw ResponseStatusException(HttpStatus.FORBIDDEN, "Not enrolled in this class")
    }

    private fun requireGuardianOf(user: User, learnerId: Long) {
        val active = guardianLinkRepo.findByGuardianId(user.id)
            .filter { it.isActive && it.learnerId == learnerId }
        if (active.isEmpty()) {
            throw ResponseStatusException(HttpStatus.FORBIDDEN, "Not a linked ward")
        }
    }

    private fun parseStatus(s: String): AssignmentStatus =
        try { AssignmentStatus.valueOf(s.uppercase()) }
        catch (e: IllegalArgumentException) {
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid status: $s")
        }

    // ── Mapping ───────────────────────────────────────────────────────────────

    private fun toDto(a: Assignment): AssignmentDto = AssignmentDto(
        id = a.id, classId = a.classId,
        className = classRepo.findById(a.classId).orElse(null)?.name,
        title = a.title, instructions = a.instructions, dueDate = a.dueDate,
        points = a.points, status = a.status.name, createdBy = a.createdBy,
        submissionCount = submissionRepo.findByAssignmentId(a.id).size.toLong(),
        gradedCount = submissionRepo.findByAssignmentId(a.id).count { it.score != null }.toLong()
    )

    private fun toDto(s: AssignmentSubmission, a: Assignment?, learnerName: String?): SubmissionDto = SubmissionDto(
        id = s.id, assignmentId = s.assignmentId, learnerId = s.learnerId,
        learnerName = learnerName, content = s.content, submittedAt = s.submittedAt,
        score = s.score, feedback = s.feedback, graded = s.score != null
    )
}
