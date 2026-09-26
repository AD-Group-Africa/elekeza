package com.elekeza.backend.analytics

import com.elekeza.backend.auth.User
import com.elekeza.backend.auth.UserRepository
import com.elekeza.backend.auth.UserRole
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.bind.annotation.*
import org.springframework.web.server.ResponseStatusException
import java.time.Instant
import java.time.temporal.ChronoUnit

/**
 * Engagement telemetry. Events are recorded server-side with strict vocabularies;
 * aggregation returns COUNTS ONLY — individual learner rows are never exposed
 * through these endpoints, keeping the analytics surface privacy-conscious by
 * construction.
 */
@Service
@Transactional
class EngagementService(
    private val eventRepository: EngagementEventRepository,
    private val userRepository: UserRepository,
) {
    data class EventRequest(
        val eventType: String,
        val refType: String? = null,
        val refId: Long? = null,
        val metadata: Map<String, Any> = emptyMap(),
    )

    fun record(actor: User, req: EventRequest) {
        val type = req.eventType.trim().uppercase()
        if (type !in EngagementEvent.VALID_EVENT_TYPES) {
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, "Unknown event type")
        }
        val ref = req.refType?.trim()?.uppercase()
        if (ref != null && ref !in EngagementEvent.VALID_REF_TYPES) {
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, "Unknown reference type")
        }
        // Metadata is capped to a few scalar keys — no free text, no PII dump.
        val capped = if (req.metadata.size > 8) {
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, "Too many metadata keys")
        } else req.metadata
        eventRepository.save(
            EngagementEvent(
                userId = actor.id,
                institutionId = actor.institutionId,
                eventType = type,
                refType = ref,
                refId = req.refId,
                metadata = "{}",
            )
        )
    }

    /**
     * Institutional engagement summary over the last [days] days.
     * SCHOOL_ADMIN sees their institution; ADMIN any institution they query.
     */
    fun institutionSummary(actor: User, institutionId: Long, days: Int): Map<String, Any> {
        if (actor.role == UserRole.SCHOOL_ADMIN && actor.institutionId != institutionId) {
            throw ResponseStatusException(HttpStatus.FORBIDDEN, "Not authorized for this institution")
        }
        if (actor.role !in setOf(UserRole.SCHOOL_ADMIN, UserRole.ADMIN)) {
            throw ResponseStatusException(HttpStatus.FORBIDDEN, "Not authorized")
        }
        val since = Instant.now().minus(days.toLong(), ChronoUnit.DAYS)
        val events = eventRepository.findByInstitutionIdAndCreatedAtAfter(institutionId, since)

        val byType = events.groupingBy { it.eventType }.eachCount()
        val activeUsers = events.mapNotNull { it.userId }.toSet().size
        val lessonsCompleted = byType.getOrDefault("LESSON_COMPLETED", 0)
        val lessonsStarted = byType.getOrDefault("LESSON_STARTED", 0)
        val quizzesCompleted = byType.getOrDefault("QUIZ_COMPLETED", 0)
        val a11yUsage = byType
            .filterKeys { it in setOf("TTS_USED", "THEME_CHANGED", "A11Y_SETTING_CHANGED") }
            .values.sum()

        return mapOf(
            "institutionId" to institutionId,
            "windowDays" to days,
            "totalEvents" to events.size,
            "activeUsers" to activeUsers,
            "lessonsStarted" to lessonsStarted,
            "lessonsCompleted" to lessonsCompleted,
            "quizzesCompleted" to quizzesCompleted,
            "assignmentsSubmitted" to byType.getOrDefault("ASSIGNMENT_SUBMITTED", 0),
            "examsSubmitted" to byType.getOrDefault("EXAM_SUBMITTED", 0),
            "tutorInteractions" to (
                byType.getOrDefault("TUTOR_OPENED", 0) + byType.getOrDefault("TUTOR_ACTION_USED", 0)
                ),
            "accessibilityFeatureUses" to a11yUsage,
        )
    }
}

@RestController
@RequestMapping("/api/engagement")
class EngagementController(
    private val engagementService: EngagementService,
) {
    @PostMapping("/events")
    fun record(@AuthenticationPrincipal actor: User, @RequestBody req: EngagementService.EventRequest): ResponseEntity<Map<String, String>> {
        engagementService.record(actor, req)
        return ResponseEntity.status(202).body(mapOf("message" to "Event recorded"))
    }

    @GetMapping("/institutions/{institutionId}/summary")
    fun summary(
        @AuthenticationPrincipal actor: User,
        @PathVariable institutionId: Long,
        @RequestParam(defaultValue = "30") days: Int,
    ) = ResponseEntity.ok(engagementService.institutionSummary(actor, institutionId, days.coerceIn(1, 365)))
}
