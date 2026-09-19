package com.elekeza.backend.guardian

import com.elekeza.backend.assignments.AssignmentRepository
import com.elekeza.backend.assignments.AssignmentStatus
import com.elekeza.backend.assignments.AssignmentSubmissionRepository
import com.elekeza.backend.attendance.AttendanceRecordRepository
import com.elekeza.backend.attendance.AttendanceSessionRepository
import com.elekeza.backend.attendance.AttendanceStatus
import com.elekeza.backend.attendance.ClassEnrollmentRepository
import com.elekeza.backend.auth.User
import com.elekeza.backend.auth.UserRepository
import com.elekeza.backend.finance.ChargeStatus
import com.elekeza.backend.finance.LearnerChargeRepository
import com.elekeza.backend.finance.PaymentAllocationRepository
import com.elekeza.backend.institution.GuardianLinkRepository
import com.elekeza.backend.learner.LessonProgressRepository
import org.springframework.http.ResponseEntity
import org.springframework.security.access.prepost.PreAuthorize
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController
import java.time.LocalDate
import java.time.ZoneId

/**
 * Guardian daily digest — one calm, plain-language snapshot per ward,
 * composed server-side from real persisted state only:
 *
 *   - learning:   lessons completed / pending, average score, recent work
 *   - attendance: rate over recorded sessions + today's status if marked
 *   - classwork:  assignments due soon or missing, graded feedback
 *   - fees:       outstanding balance per ward (derived server-side)
 *
 * No AI, no speculation: every number comes from the learner's own records.
 * A guardian may only ever see wards linked through guardian_links.
 */
@RestController
@RequestMapping("/api/guardian")
class GuardianDigestController(
    private val guardianLinkRepo: GuardianLinkRepository,
    private val userRepo: UserRepository,
    private val lessonProgressRepo: LessonProgressRepository,
    private val enrollmentRepo: ClassEnrollmentRepository,
    private val sessionRepo: AttendanceSessionRepository,
    private val recordRepo: AttendanceRecordRepository,
    private val assignmentRepo: AssignmentRepository,
    private val submissionRepo: AssignmentSubmissionRepository,
    private val learnerChargeRepo: LearnerChargeRepository,
    private val allocationRepo: PaymentAllocationRepository
) {

    @GetMapping("/wards/{learnerId}/digest")
    @PreAuthorize("hasRole('GUARDIAN')")
    fun wardDigest(@AuthenticationPrincipal guardian: User, @PathVariable learnerId: Long): ResponseEntity<Map<String, Any>> {
        // Ward boundary: only linked, active guardian-learner relationships.
        val link = guardianLinkRepo.findByGuardianId(guardian.id)
            .firstOrNull { it.isActive && it.learnerId == learnerId }
            ?: return ResponseEntity.status(403).body(mapOf("error" to "Not authorized"))
        val learner = userRepo.findById(learnerId).orElse(null)
            ?: return ResponseEntity.status(404).body(mapOf("error" to "Ward not found"))

        val today: LocalDate = LocalDate.now()

        // ── Learning ──────────────────────────────────────────────────────
        val progress = lessonProgressRepo.findByUserIdOrderByCreatedAtDesc(learner.id)
        val completed = progress.filter { it.completed }
        val avgScore = if (completed.isNotEmpty()) completed.mapNotNull { it.quizScore }.average() else null

        // ── Attendance ────────────────────────────────────────────────────
        val classIds = enrollmentRepo.findByLearnerIdAndActiveTrue(learner.id).map { it.classId }
        val sessions = if (classIds.isEmpty()) emptyList() else sessionRepo.findByClassIdInAndSessionDateBetween(classIds, today.minusDays(60), today)
        val records = recordRepo.findBySessionIdIn(sessions.map { it.id })
            .filter { it.learnerId == learner.id }
        val presentish = records.count { it.status == AttendanceStatus.PRESENT || it.status == AttendanceStatus.LATE }
        val attendanceRate = if (records.isNotEmpty()) Math.round(presentish * 100.0 / records.size) else null
        val todaySessionIds = sessions.filter { it.sessionDate == today }.map { it.id }.toSet()
        val todayStatus = records.firstOrNull { it.sessionId in todaySessionIds }?.status?.name

        // ── Classwork ─────────────────────────────────────────────────────
        val published = if (classIds.isEmpty()) emptyList()
        else assignmentRepo.findByClassIdInAndStatus(classIds, AssignmentStatus.PUBLISHED)
        val submissions = submissionRepo.findByLearnerIdOrderBySubmittedAtDesc(learner.id)
            .filter { it.assignmentId in published.map { a -> a.id }.toSet() }
        val submittedIds = submissions.map { it.assignmentId }.toSet()
        val dueSoon = published
            .filter { it.dueDate != null && !it.dueDate.isBefore(today) && it.dueDate.isBefore(today.plusDays(7)) }
            .map { a -> mapOf("id" to a.id, "title" to a.title, "dueDate" to a.dueDate.toString(), "submitted" to (a.id in submittedIds)) }
        val missing = published.filter { it.dueDate != null && it.dueDate.isBefore(today) && it.id !in submittedIds }
            .map { a -> mapOf("id" to a.id, "title" to a.title, "dueDate" to a.dueDate.toString()) }
        val recentFeedback = submissions.filter { it.score != null }.take(3)
            .map { s ->
                val a = assignmentRepo.findById(s.assignmentId).orElse(null)
                mapOf(
                    "title" to (a?.title ?: "Assignment"),
                    "score" to s.score,
                    "points" to (a?.points ?: 100),
                    "feedback" to s.feedback
                )
            }

        // ── Fees (server-derived: charges minus allocations, same rule as FinanceService) ──
        val charges = learnerChargeRepo.findByLearnerIdOrderByCreatedAtDesc(learner.id)
            .filter { it.status != ChargeStatus.VOID }
        val outstanding = charges.sumOf { c ->
            val paid = allocationRepo.findByChargeId(c.id).filter { it.amount > 0 }.sumOf { it.amount }
            (c.amount - paid).coerceAtLeast(0.0)
        }

        return ResponseEntity.ok(mapOf(
            "learnerId" to learner.id,
            "learnerName" to learner.name,
            "relationship" to link.relationship,
            "generatedAt" to java.time.Instant.now().toString(),
            "learning" to mapOf(
                "lessonsCompleted" to completed.size,
                "lessonsPending" to (progress.size - completed.size),
                "averageScore" to avgScore,
                "recentQuizzes" to completed.takeLast(3).map { p ->
                    mapOf("date" to (p.completedAt?.toString() ?: ""), "score" to (p.quizScore ?: 0.0))
                }
            ),
            "attendance" to mapOf(
                "rate" to attendanceRate,
                "sessionsMarked" to records.size,
                "today" to todayStatus
            ),
            "classwork" to mapOf(
                "dueSoon" to dueSoon,
                "missing" to missing,
                "recentFeedback" to recentFeedback
            ),
            "fees" to mapOf("outstanding" to outstanding)
        ))
    }
}
