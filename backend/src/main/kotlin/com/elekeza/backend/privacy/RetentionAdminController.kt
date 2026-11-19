package com.elekeza.backend.privacy

import org.springframework.http.ResponseEntity
import org.springframework.security.access.prepost.PreAuthorize
import org.springframework.web.bind.annotation.*

/**
 * Retention policy visibility and manual sweeps. ADMIN only.
 *
 * The manual run defaults to a **dry run**: an operator inspecting the data
 * retention position should not be able to delete anything by accident.
 */
@RestController
@RequestMapping("/api/admin/retention")
@PreAuthorize("hasRole('ADMIN')")
class RetentionAdminController(private val retentionService: RetentionService) {

    @GetMapping("/policy")
    fun policy(): ResponseEntity<Any> = ResponseEntity.ok(
        mapOf(
            "policy" to RetentionService.POLICY.map { (table, window, reason) ->
                mapOf("table" to table, "window" to window, "reason" to reason)
            },
            "note" to "Users, learners, guardian links and academic records are never deleted automatically."
        )
    )

    @GetMapping("/runs")
    fun runs(): ResponseEntity<Any> = ResponseEntity.ok(retentionService.recentRuns())

    @PostMapping("/run")
    fun run(@RequestParam(defaultValue = "true") dryRun: Boolean): ResponseEntity<Any> {
        val run = retentionService.run(dryRun)
        return ResponseEntity.ok(
            mapOf(
                "id" to run.id,
                "dryRun" to run.dryRun,
                "passwordResetTokens" to run.passwordResetTokens,
                "refreshTokens" to run.refreshTokens,
                "notifications" to run.notifications,
                "engagementEvents" to run.engagementEvents,
                "consentRecords" to run.consentRecords,
                "totalDeleted" to run.totalDeleted,
                "finishedAt" to run.finishedAt
            )
        )
    }
}
