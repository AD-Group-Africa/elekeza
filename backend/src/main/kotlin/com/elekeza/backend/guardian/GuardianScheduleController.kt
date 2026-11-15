package com.elekeza.backend.guardian

import com.elekeza.backend.auth.User
import com.elekeza.backend.auth.UserRepository
import com.elekeza.backend.calendar.Deadline
import com.elekeza.backend.calendar.DeadlineRepository
import com.elekeza.backend.calendar.DeadlineScope
import com.elekeza.backend.content.ContentRepository
import com.elekeza.backend.institution.GuardianLinkRepository
import com.elekeza.backend.learner.LessonProgressRepository
import org.springframework.http.ResponseEntity
import org.springframework.security.access.prepost.PreAuthorize
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.web.bind.annotation.*
import java.time.LocalDate
import java.time.ZoneId

@RestController
@RequestMapping("/api/guardian")
class GuardianScheduleController(
    private val guardianLinkRepo: GuardianLinkRepository,
    private val userRepo: UserRepository,
    private val lessonProgressRepo: LessonProgressRepository,
    private val contentRepo: ContentRepository,
    private val deadlineRepo: DeadlineRepository,
) {

    /**
     * Upcoming activities = each ward's assigned-but-not-yet-completed
     * lessons, with the lesson title and the assignment date. There is no
     * calendar/session data model yet, so this is the honest real-data
     * schedule: what each ward still needs to do.
     */
    @GetMapping("/schedule")
    @PreAuthorize("hasAnyRole('GUARDIAN', 'ADMIN')")
    fun getSchedule(@AuthenticationPrincipal guardian: User): ResponseEntity<List<Map<String, Any>>> {
        val links = guardianLinkRepo.findAll().filter { it.guardianId == guardian.id }
        val items = mutableListOf<Map<String, Any>>()
        links.forEach { link ->
            val learner = userRepo.findById(link.learnerId).orElse(null) ?: return@forEach
            val pending = lessonProgressRepo.findByUserIdOrderByCreatedAtDesc(learner.id).filter { !it.completed }
            pending.forEach { p ->
                val content = contentRepo.findById(p.contentId).orElse(null)
                items.add(mapOf(
                    "title" to ((content?.title ?: "Lesson #${p.contentId}") + " — ${learner.name}"),
                    "date" to p.createdAt.toLocalDate().toString(),
                    "time" to "",
                    "type" to "Lesson",
                    "lessonId" to p.contentId,
                    "wardName" to learner.name,
                ))
            }
        }

        // School dates (Sprint 3): guardians previously had NO access to the
        // school calendar anywhere — /api/deadlines existed but was never
        // surfaced to them. Merge every deadline that is visible to this
        // guardian under the exact visibility rule of DEADLINE /.api/deadlines
        // (NATIONAL, REGIONAL, own-institution, or own personal) into the
        // same schedule payload, upcoming only.
        val today = LocalDate.now()
        visibleDeadlines(guardian)
            .filter { it.dueAt.atZone(ZoneId.systemDefault()).toLocalDate() >= today }
            .forEach { d ->
                items.add(mapOf(
                    "title" to d.title,
                    "date" to d.dueAt.atZone(ZoneId.systemDefault()).toLocalDate().toString(),
                    "time" to d.dueAt.atZone(ZoneId.systemDefault()).toLocalTime().toString(),
                    "type" to "School Date",
                    "deadlineId" to d.id,
                    "deadlineType" to d.deadlineType.name,
                ))
            }

        items.sortBy { it["date"] as String }
        return ResponseEntity.ok(items)
    }

    /**
     * Guardian-visible deadlines, tenant-safe: NATIONAL/REGIONAL are public,
     * but institution-scope items require an ACTIVE guardian link to a learner
     * of that institution (guardians carry no institutionId of their own).
     * A guardian's personal deadlines (userId) are included too.
     */
    private fun visibleDeadlines(user: User): List<Deadline> {
        val linkedInstitutionIds = guardianLinkRepo.findByGuardianId(user.id)
            .filter { it.currentlyActive() }
            .mapNotNull { link -> userRepo.findById(link.learnerId).orElse(null)?.institutionId }
            .toSet()
        return deadlineRepo.findAll().filter { d ->
            d.scope == DeadlineScope.NATIONAL || d.scope == DeadlineScope.REGIONAL ||
                (d.institutionId != null && d.institutionId in linkedInstitutionIds) ||
                d.userId == user.id
        }
    }
}
