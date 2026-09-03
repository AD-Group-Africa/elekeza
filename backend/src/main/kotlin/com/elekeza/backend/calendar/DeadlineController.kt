package com.elekeza.backend.calendar

import com.elekeza.backend.auth.User
import com.elekeza.backend.auth.UserRole
import org.springframework.http.ResponseEntity
import org.springframework.security.access.prepost.PreAuthorize
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.web.bind.annotation.*
import java.time.Instant

@RestController
@RequestMapping("/api/deadlines")
class DeadlineController(private val repo: DeadlineRepository) {

    data class CreateDeadlineRequest(
        val title: String,
        val deadlineType: DeadlineType,
        val scope: DeadlineScope = DeadlineScope.INSTITUTION,
        val dueAt: String,
        val description: String? = null,
        val userId: Long? = null,
        val institutionId: Long? = null,
    )

    /** Visible deadlines depend on role and institution scope. */
    @GetMapping
    fun list(@AuthenticationPrincipal user: User): ResponseEntity<List<Deadline>> {
        val all = repo.findAll()
        val visible = when (user.role) {
            UserRole.ADMIN -> all
            else -> {
                val institutionId = user.institutionId
                all.filter { d ->
                    d.scope == DeadlineScope.NATIONAL || d.scope == DeadlineScope.REGIONAL ||
                        (institutionId != null && d.institutionId == institutionId) ||
                        d.userId == user.id
                }
            }
        }
        return ResponseEntity.ok(visible.sortedBy { it.dueAt })
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('TEACHER','ADMIN','SCHOOL_ADMIN')")
    fun create(
        @AuthenticationPrincipal user: User,
        @RequestBody request: CreateDeadlineRequest,
    ): ResponseEntity<Deadline> {
        val institutionId = request.institutionId ?: user.institutionId
        val deadline = repo.save(Deadline(
            title = request.title,
            deadlineType = request.deadlineType,
            scope = request.scope,
            dueAt = Instant.parse(request.dueAt),
            description = request.description,
            userId = request.userId,
            institutionId = institutionId,
            createdBy = user.id,
        ))
        return ResponseEntity.ok(deadline)
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('TEACHER','ADMIN','SCHOOL_ADMIN')")
    fun delete(@PathVariable id: Long, @AuthenticationPrincipal user: User): ResponseEntity<Map<String, Boolean>> {
        val deadline = repo.findById(id).orElse(null) ?: return ResponseEntity.ok(mapOf("success" to false))
        if (user.role != UserRole.ADMIN && deadline.createdBy != user.id) {
            return ResponseEntity.status(403).body(mapOf("success" to false))
        }
        repo.delete(deadline)
        return ResponseEntity.ok(mapOf("success" to true))
    }
}
