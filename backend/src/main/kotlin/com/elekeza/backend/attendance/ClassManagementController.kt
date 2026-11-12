package com.elekeza.backend.attendance

import com.elekeza.backend.auth.User
import com.elekeza.backend.auth.UserRepository
import com.elekeza.backend.auth.UserRole
import com.elekeza.backend.common.AuditLogService
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.security.access.prepost.PreAuthorize
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.bind.annotation.*
import org.springframework.web.server.ResponseStatusException

/**
 * Class management: create classes and manage enrolment.
 *
 * Before this existed, classes could only come from seed data, so a newly
 * registered school could not use attendance, timetable or classwork.
 *
 * Authorization (tenant-scoped, same model as [AttendanceService]):
 *  - create a class: SCHOOL_ADMIN / ADMIN, in their own institution;
 *  - enrol / remove learners: any staff member of the class's institution;
 *  - only STUDENT accounts of the same institution can be enrolled.
 */
@Service
@Transactional
class ClassManagementService(
    private val classRepo: SchoolClassRepository,
    private val enrollmentRepo: ClassEnrollmentRepository,
    private val userRepo: UserRepository,
    private val auditLog: AuditLogService,
) {
    data class CreateClassRequest(val name: String, val gradeLevel: String? = null)
    data class EnrollRequest(val learnerIds: List<Long>)
    data class EnrolledLearner(val learnerId: Long, val name: String, val email: String)

    fun create(actor: User, req: CreateClassRequest): ClassDto {
        val institutionId = actor.institutionId
            ?: throw ResponseStatusException(HttpStatus.BAD_REQUEST, "Your account is not linked to a school")
        val name = req.name.trim()
        if (name.isEmpty() || name.length > 100) {
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, "Class name is required (max 100 characters)")
        }
        if (classRepo.findByInstitutionIdOrderByNameAsc(institutionId).any { it.name.equals(name, ignoreCase = true) }) {
            throw ResponseStatusException(HttpStatus.CONFLICT, "A class with this name already exists")
        }
        val saved = classRepo.save(
            SchoolClass(institutionId = institutionId, name = name, gradeLevel = req.gradeLevel?.trim()?.ifEmpty { null })
        )
        audit(actor, "CLASS_CREATED", "class=${saved.id}")
        return ClassDto(saved.id, saved.name, saved.gradeLevel, 0)
    }

    @Transactional(readOnly = true)
    fun learners(actor: User, classId: Long): List<EnrolledLearner> {
        requireClass(actor, classId)
        return enrollmentRepo.findByClassIdAndActiveTrue(classId)
            .mapNotNull { userRepo.findById(it.learnerId).orElse(null) }
            .sortedBy { it.name }
            .map { EnrolledLearner(it.id, it.name, it.email) }
    }

    fun enroll(actor: User, classId: Long, learnerIds: List<Long>): List<EnrolledLearner> {
        val cls = requireClass(actor, classId)
        if (learnerIds.isEmpty()) throw ResponseStatusException(HttpStatus.BAD_REQUEST, "Choose at least one learner")
        val alreadyActive = enrollmentRepo.findByClassIdAndActiveTrue(classId).map { it.learnerId }.toSet()
        for (learnerId in learnerIds.distinct()) {
            val learner = userRepo.findById(learnerId).orElse(null)
            if (learner == null || learner.role != UserRole.STUDENT || learner.institutionId != cls.institutionId) {
                // Same response for "missing" and "other school" — no cross-tenant probing.
                throw ResponseStatusException(HttpStatus.NOT_FOUND, "Learner not found")
            }
            if (learnerId !in alreadyActive) enrollmentRepo.save(ClassEnrollment(classId = classId, learnerId = learnerId))
        }
        audit(actor, "CLASS_ENROLLED", "class=$classId learners=${learnerIds.size}")
        return learners(actor, classId)
    }

    fun unenroll(actor: User, classId: Long, learnerId: Long) {
        requireClass(actor, classId)
        enrollmentRepo.findByClassIdAndActiveTrue(classId)
            .filter { it.learnerId == learnerId }
            .forEach { enrollmentRepo.save(it.copy(active = false)) }
        audit(actor, "CLASS_UNENROLLED", "class=$classId learner=$learnerId")
    }

    private fun requireClass(actor: User, classId: Long): SchoolClass {
        val cls = classRepo.findById(classId).orElse(null)
            ?: throw ResponseStatusException(HttpStatus.NOT_FOUND, "Class not found")
        if (actor.role != UserRole.ADMIN && (actor.institutionId == null || cls.institutionId != actor.institutionId)) {
            throw ResponseStatusException(HttpStatus.NOT_FOUND, "Class not found")
        }
        return cls
    }

    private fun audit(actor: User, action: String, detail: String) {
        runCatching { auditLog.log(action = action, category = "ADMIN", userId = actor.id, detail = detail) }
    }
}

@RestController
@RequestMapping("/api/attendance/classes")
class ClassManagementController(private val service: ClassManagementService) {

    @PostMapping
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN', 'ADMIN')")
    fun create(@AuthenticationPrincipal actor: User, @RequestBody req: ClassManagementService.CreateClassRequest) =
        ResponseEntity.status(201).body(service.create(actor, req))

    @GetMapping("/{classId}/learners")
    @PreAuthorize("hasAnyRole('TEACHER', 'SCHOOL_ADMIN', 'ADMIN')")
    fun learners(@AuthenticationPrincipal actor: User, @PathVariable classId: Long) =
        ResponseEntity.ok(service.learners(actor, classId))

    @PostMapping("/{classId}/learners")
    @PreAuthorize("hasAnyRole('TEACHER', 'SCHOOL_ADMIN', 'ADMIN')")
    fun enroll(
        @AuthenticationPrincipal actor: User,
        @PathVariable classId: Long,
        @RequestBody req: ClassManagementService.EnrollRequest,
    ) = ResponseEntity.ok(service.enroll(actor, classId, req.learnerIds))

    @DeleteMapping("/{classId}/learners/{learnerId}")
    @PreAuthorize("hasAnyRole('TEACHER', 'SCHOOL_ADMIN', 'ADMIN')")
    fun unenroll(@AuthenticationPrincipal actor: User, @PathVariable classId: Long, @PathVariable learnerId: Long): ResponseEntity<Map<String, Boolean>> {
        service.unenroll(actor, classId, learnerId)
        return ResponseEntity.ok(mapOf("removed" to true))
    }
}
