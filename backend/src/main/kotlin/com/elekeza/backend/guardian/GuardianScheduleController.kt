package com.elekeza.backend.guardian

import com.elekeza.backend.auth.User
import com.elekeza.backend.auth.UserRepository
import com.elekeza.backend.content.ContentRepository
import com.elekeza.backend.institution.GuardianLinkRepository
import com.elekeza.backend.learner.LessonProgressRepository
import org.springframework.http.ResponseEntity
import org.springframework.security.access.prepost.PreAuthorize
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.web.bind.annotation.*

@RestController
@RequestMapping("/api/guardian")
class GuardianScheduleController(
    private val guardianLinkRepo: GuardianLinkRepository,
    private val userRepo: UserRepository,
    private val lessonProgressRepo: LessonProgressRepository,
    private val contentRepo: ContentRepository,
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
        items.sortBy { it["date"] as String }
        return ResponseEntity.ok(items)
    }
}
