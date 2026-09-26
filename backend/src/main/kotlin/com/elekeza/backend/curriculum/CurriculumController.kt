package com.elekeza.backend.curriculum

import com.elekeza.backend.auth.User
import com.elekeza.backend.auth.UserRepository
import com.elekeza.backend.auth.UserRole
import com.elekeza.backend.common.AuditLogService
import com.elekeza.backend.content.Content
import com.elekeza.backend.content.ContentRepository
import org.springframework.http.HttpStatus
import org.springframework.security.access.prepost.PreAuthorize
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.bind.annotation.*
import org.springframework.web.server.ResponseStatusException
import java.time.LocalDateTime

/**
 * Curriculum hierarchy API.
 *
 * Authorization model:
 *  - SCHOOL_ADMIN/ADMIN build and maintain the hierarchy for their institution
 *    (school-local curriculum); platform ADMIN additionally manages shared
 *    (institution-less) reference rows.
 *  - All authenticated roles get READ access to the hierarchy visible to their
 *    institution — needed by lesson views and competency progress.
 *  - Mapping content → objective is staff-only and audited.
 */
@RestController
@RequestMapping("/api/curriculum")
class CurriculumController(
    private val areaRepo: LearningAreaRepository,
    private val strandRepo: StrandRepository,
    private val subStrandRepo: SubStrandRepository,
    private val competencyRepo: CompetencyRepository,
    private val objectiveRepo: LearningObjectiveRepository,
    private val contentRepo: ContentRepository,
    private val userRepository: UserRepository,
    private val auditLog: AuditLogService,
) {
    // ── DTOs ─────────────────────────────────────────────────────────────────
    data class NodeRequest(val code: String, val name: String, val description: String? = null, val ordering: Int = 0)
    data class ObjectiveRequest(val code: String, val statement: String, val ordering: Int = 0)
    data class MapRequest(val objectiveId: Long?)
    data class CurriculumNodeDto(val id: Long, val code: String, val name: String, val institutionId: Long?)

    private fun CurriculumNode.toDto() = CurriculumNodeDto(id = id, code = code, name = name, institutionId = institutionId)

    // ── READ: full tree visible to the actor's institution ──────────────────
    @GetMapping("/tree")
    fun tree(@AuthenticationPrincipal actor: User): Map<String, Any> {
        val areas = areaRepo.findByInstitutionIdOrInstitutionIdIsNullOrderByOrderingAsc(actor.institutionId)
            .filter { it.active || actor.role in setOf(UserRole.SCHOOL_ADMIN, UserRole.ADMIN) }
        val tree = areas.map { area ->
            val strands = strandRepo.findByLearningAreaIdAndActiveTrueOrderByOrderingAsc(area.id)
            mapOf(
                "id" to area.id, "code" to area.code, "name" to area.name,
                "shared" to (area.institutionId == null),
                "strands" to strands.map { strand ->
                    val subStrands = subStrandRepo.findByStrandIdAndActiveTrueOrderByOrderingAsc(strand.id)
                    mapOf(
                        "id" to strand.id, "code" to strand.code, "name" to strand.name,
                        "subStrands" to subStrands.map { sub ->
                            val competencies = competencyRepo.findBySubStrandIdAndActiveTrueOrderByOrderingAsc(sub.id)
                            mapOf(
                                "id" to sub.id, "code" to sub.code, "name" to sub.name,
                                "competencies" to competencies.map { comp ->
                                    val objectives = objectiveRepo.findByCompetencyIdAndActiveTrueOrderByOrderingAsc(comp.id)
                                    mapOf(
                                        "id" to comp.id, "code" to comp.code, "name" to comp.name,
                                        "objectives" to objectives.map { obj ->
                                            mapOf("id" to obj.id, "code" to obj.code, "statement" to obj.statement)
                                        },
                                    )
                                },
                            )
                        },
                    )
                },
            )
        }
        return mapOf("areas" to tree)
    }

    // ── CREATE: hierarchy levels ─────────────────────────────────────────────
    @PostMapping("/areas")
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN', 'ADMIN')")
    fun createArea(@AuthenticationPrincipal actor: User, @RequestBody req: NodeRequest): CurriculumNodeDto {
        requireCode(req)
        val area = LearningArea().apply {
            institutionId = actor.institutionId   // ADMIN without a tenant also creates shared rows
            code = req.code.trim().uppercase()
            name = req.name.trim()
            description = req.description?.trim()
            ordering = req.ordering
        }
        val saved = areaRepo.save(area)
        audit(actor, "CURRICULUM_AREA_CREATED", "area=${saved.code}")
        return saved.toDto()
    }

    @PostMapping("/areas/{areaId}/strands")
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN', 'ADMIN')")
    fun createStrand(@AuthenticationPrincipal actor: User, @PathVariable areaId: Long, @RequestBody req: NodeRequest): CurriculumNodeDto {
        val area = areaRepo.findById(areaId)
            .orElseThrow { ResponseStatusException(HttpStatus.NOT_FOUND, "Learning area not found") }
        requireManageable(actor, area.institutionId)
        requireCode(req)
        val saved = strandRepo.save(Strand(learningAreaId = area.id).apply {
            institutionId = area.institutionId
            code = req.code.trim().uppercase()
            name = req.name.trim()
            description = req.description?.trim()
            ordering = req.ordering
        })
        audit(actor, "CURRICULUM_STRAND_CREATED", "strand=${saved.code} area=$areaId")
        return saved.toDto()
    }

    @PostMapping("/strands/{strandId}/sub-strands")
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN', 'ADMIN')")
    fun createSubStrand(@AuthenticationPrincipal actor: User, @PathVariable strandId: Long, @RequestBody req: NodeRequest): CurriculumNodeDto {
        val strand = strandRepo.findById(strandId)
            .orElseThrow { ResponseStatusException(HttpStatus.NOT_FOUND, "Strand not found") }
        requireManageable(actor, strand.institutionId)
        requireCode(req)
        val saved = subStrandRepo.save(SubStrand(strandId = strand.id).apply {
            institutionId = strand.institutionId
            code = req.code.trim().uppercase()
            name = req.name.trim()
            description = req.description?.trim()
            ordering = req.ordering
        })
        audit(actor, "CURRICULUM_SUB_STRAND_CREATED", "subStrand=${saved.code} strand=$strandId")
        return saved.toDto()
    }

    @PostMapping("/sub-strands/{subStrandId}/competencies")
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN', 'ADMIN')")
    fun createCompetency(@AuthenticationPrincipal actor: User, @PathVariable subStrandId: Long, @RequestBody req: NodeRequest): CurriculumNodeDto {
        val sub = subStrandRepo.findById(subStrandId)
            .orElseThrow { ResponseStatusException(HttpStatus.NOT_FOUND, "Sub-strand not found") }
        requireManageable(actor, sub.institutionId)
        requireCode(req)
        val saved = competencyRepo.save(Competency(subStrandId = sub.id).apply {
            institutionId = sub.institutionId
            code = req.code.trim().uppercase()
            name = req.name.trim()
            description = req.description?.trim()
            ordering = req.ordering
        })
        audit(actor, "CURRICULUM_COMPETENCY_CREATED", "competency=${saved.code} subStrand=$subStrandId")
        return saved.toDto()
    }

    @PostMapping("/competencies/{competencyId}/objectives")
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN', 'ADMIN')")
    fun createObjective(@AuthenticationPrincipal actor: User, @PathVariable competencyId: Long, @RequestBody req: ObjectiveRequest): CurriculumNodeDto {
        val comp = competencyRepo.findById(competencyId)
            .orElseThrow { ResponseStatusException(HttpStatus.NOT_FOUND, "Competency not found") }
        requireManageable(actor, comp.institutionId)
        if (req.code.isBlank() || req.statement.isBlank()) {
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, "code and statement are required")
        }
        val saved = objectiveRepo.save(LearningObjective(competencyId = comp.id).apply {
            institutionId = comp.institutionId
            code = req.code.trim().uppercase()
            name = req.statement.trim().take(255)
            statement = req.statement.trim()
            ordering = req.ordering
        })
        audit(actor, "CURRICULUM_OBJECTIVE_CREATED", "objective=${saved.code} competency=$competencyId")
        return saved.toDto()
    }

    // ── Content → objective mapping (staff-only, audited) ───────────────────
    @PutMapping("/content/{contentId}/objective")
    @PreAuthorize("hasAnyRole('TEACHER', 'SCHOOL_ADMIN', 'ADMIN')")
    fun mapContentObjective(@AuthenticationPrincipal actor: User, @PathVariable contentId: Long, @RequestBody req: MapRequest): Map<String, Any?> {
        val content = contentRepo.findById(contentId)
            .orElseThrow { ResponseStatusException(HttpStatus.NOT_FOUND, "Lesson not found") }
        if (actor.role == UserRole.TEACHER) {
            val owner = userRepository.findById(content.userId).orElse(null)
            if (owner == null || owner.institutionId != actor.institutionId) {
                throw ResponseStatusException(HttpStatus.NOT_FOUND, "Lesson not found")
            }
        }
        val objective = req.objectiveId?.let {
            objectiveRepo.findById(it).orElseThrow { ResponseStatusException(HttpStatus.NOT_FOUND, "Objective not found") }
        }
        if (objective != null) {
            requireManageable(actor, objective.institutionId)
        }
        contentRepo.save(content.withObjective(objective?.id))
        audit(actor, "CURRICULUM_CONTENT_MAPPED", "content=$contentId objective=${objective?.id}")
        return mapOf("contentId" to contentId, "objectiveId" to objective?.id)
    }

    // ── helpers ──────────────────────────────────────────────────────────────
    private fun requireCode(req: NodeRequest) {
        if (req.code.isBlank() || req.name.isBlank()) {
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, "code and name are required")
        }
    }

    /** Shared rows (null institution) can only be managed by platform ADMIN. */
    private fun requireManageable(actor: User, institutionId: Long?) {
        if (institutionId == null) {
            if (actor.role != UserRole.ADMIN) {
                throw ResponseStatusException(HttpStatus.FORBIDDEN, "Shared curriculum rows are managed by the platform")
            }
            return
        }
        if (actor.role != UserRole.ADMIN && actor.institutionId != institutionId) {
            throw ResponseStatusException(HttpStatus.NOT_FOUND, "Curriculum not found")
        }
    }

    private fun audit(actor: User, action: String, detail: String) {
        runCatching { auditLog.log(action = action, category = "CURRICULUM", userId = actor.id, detail = detail) }
    }
}

/** Full-field copy that adds/updates the nullable objective mapping. */
fun Content.withObjective(objectiveId: Long?): Content = Content(
    id = id,
    userId = userId,
    title = title,
    originalFilename = originalFilename,
    filePath = filePath,
    sneType = sneType,
    status = status,
    simplifiedText = simplifiedText,
    rawText = rawText,
    wordCount = wordCount,
    objectiveId = objectiveId,
    createdAt = createdAt,
    updatedAt = LocalDateTime.now(),
)
