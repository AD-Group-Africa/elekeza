package com.elekeza.backend.support

import com.elekeza.backend.auth.User
import org.springframework.http.ResponseEntity
import org.springframework.security.access.prepost.PreAuthorize
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.web.bind.annotation.*
import java.time.LocalDate

@RestController
@RequestMapping("/api/teacher")
@PreAuthorize("hasAnyRole('TEACHER','ADMIN','SCHOOL_ADMIN')")
class SupportController(private val service: SupportService) {

    data class CreateInterventionRequest(
        val learnerId: Long,
        val signalId: Long? = null,
        val type: InterventionType,
        val target: String,
        val startDate: String,
        val reviewDate: String? = null,
    )

    data class OutcomeRequest(
        val status: InterventionStatus,
        val outcome: String? = null,
    )

    @GetMapping("/support-signals")
    fun supportSignals(@AuthenticationPrincipal teacher: User): ResponseEntity<List<SupportService.SignalView>> =
        ResponseEntity.ok(service.refreshSignals(teacher))

    @PostMapping("/support-signals/{id}/acknowledge")
    fun acknowledge(@PathVariable id: Long, @AuthenticationPrincipal teacher: User): ResponseEntity<Map<String, Boolean>> =
        ResponseEntity.ok(mapOf("success" to service.acknowledge(id, teacher)))

    @PostMapping("/support-signals/{id}/dismiss")
    fun dismiss(@PathVariable id: Long, @AuthenticationPrincipal teacher: User): ResponseEntity<Map<String, Boolean>> =
        ResponseEntity.ok(mapOf("success" to service.dismiss(id, teacher)))

    @GetMapping("/interventions")
    fun interventions(
        @AuthenticationPrincipal teacher: User,
        @RequestParam(required = false) learnerId: Long?,
    ): ResponseEntity<List<Intervention>> =
        ResponseEntity.ok(service.listInterventions(teacher, learnerId))

    @PostMapping("/interventions")
    fun createIntervention(
        @AuthenticationPrincipal teacher: User,
        @RequestBody request: CreateInterventionRequest,
    ): ResponseEntity<Intervention> {
        val intervention = service.createIntervention(
            teacher = teacher,
            learnerId = request.learnerId,
            signalId = request.signalId,
            type = request.type,
            target = request.target,
            startDate = LocalDate.parse(request.startDate),
            reviewDate = request.reviewDate?.let { LocalDate.parse(it) },
        )
        return ResponseEntity.ok(intervention)
    }

    @PostMapping("/interventions/{id}/outcome")
    fun updateOutcome(
        @PathVariable id: Long,
        @AuthenticationPrincipal teacher: User,
        @RequestBody request: OutcomeRequest,
    ): ResponseEntity<Map<String, Any>> {
        val updated = service.updateOutcome(teacher, id, request.status, request.outcome)
            ?: return ResponseEntity.notFound().build()
        return ResponseEntity.ok(mapOf(
            "id" to updated.id,
            "status" to updated.status.name,
            "outcome" to (updated.outcome ?: ""),
        ))
    }
}
