package com.elekeza.backend.curriculum

import com.elekeza.backend.attendance.ClassEnrollmentRepository
import com.elekeza.backend.attendance.SchoolClassRepository
import com.elekeza.backend.auth.User
import com.elekeza.backend.auth.UserRepository
import com.elekeza.backend.auth.UserRole
import com.elekeza.backend.content.ContentRepository
import com.elekeza.backend.learner.LessonProgressRepository
import org.springframework.http.HttpStatus
import org.springframework.security.access.prepost.PreAuthorize
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.bind.annotation.*
import org.springframework.web.server.ResponseStatusException

/**
 * Curriculum-aware progress: deterministic aggregation of real quiz results
 * onto the competency hierarchy via content → objective mapping.
 *
 * Privacy/authorization:
 *  - a learner sees their own competency progress;
 *  - teachers/admins of the learner's institution see a learner's progress;
 *  - class-level aggregation returns counts/averages only (no per-learner rows).
 * Unmapped content is excluded from competency analytics — never guessed.
 */
@RestController
@RequestMapping("/api/curriculum")
class CompetencyProgressController(
    private val objectiveRepo: LearningObjectiveRepository,
    private val competencyRepo: CompetencyRepository,
    private val subStrandRepo: SubStrandRepository,
    private val strandRepo: StrandRepository,
    private val areaRepo: LearningAreaRepository,
    private val contentRepo: ContentRepository,
    private val progressRepo: LessonProgressRepository,
    private val userRepository: UserRepository,
    private val classRepo: SchoolClassRepository,
    private val enrollmentRepo: ClassEnrollmentRepository,
) {
    data class CompetencyProgress(
        val competencyId: Long,
        val competency: String,
        val strand: String,
        val learningArea: String,
        val lessonsMapped: Int,
        val attempts: Int,
        val averageScore: Double,
    )

    @Transactional(readOnly = true)
    @GetMapping("/learners/{learnerId}/competency-progress")
    fun learnerCompetencyProgress(@AuthenticationPrincipal actor: User, @PathVariable learnerId: Long): Map<String, Any> {
        requireLearnerAccess(actor, learnerId)


        // Content the learner has progress rows for, mapped to objectives.
        val progress = progressRepo.findByUserIdOrderByCreatedAtDesc(learnerId)
        val contentIds = progress.map { it.contentId }.toSet()
        val contents = contentIds.mapNotNull { contentRepo.findById(it).orElse(null) }
        val byObjective = contents.filter { it.objectiveId != null }.associateBy { it.id }

        if (byObjective.isEmpty()) {
            return mapOf("learnerId" to learnerId, "competencies" to emptyList<CompetencyProgress>(),
                "note" to "No lessons are mapped to the curriculum yet")
        }

        // Roll quiz scores up: content → objective → competency.
        data class Acc(var attempts: Int = 0, var scoreSum: Double = 0.0, var lessons: Int = 0)
        val byCompetency = mutableMapOf<Long, Acc>()
        for ((contentId, content) in byObjective) {
            val objective = objectiveRepo.findById(content.objectiveId!!).orElse(null) ?: continue
            val competencyId = objective.competencyId
            val acc = byCompetency.getOrPut(competencyId) { Acc() }
            acc.lessons += 1
            progress.filter { it.contentId == contentId }.forEach { p ->
                if (p.completed && p.quizScore != null) {
                    acc.attempts += 1
                    acc.scoreSum += p.quizScore!!
                }
            }
        }

        val result = byCompetency.map { (competencyId, acc) ->
            val comp = competencyRepo.findById(competencyId).orElse(null)
            val sub = comp?.let { subStrandRepo.findById(it.subStrandId).orElse(null) }
            val strand = sub?.let { strandRepo.findById(it.strandId).orElse(null) }
            val area = strand?.let { areaRepo.findById(it.learningAreaId).orElse(null) }
            CompetencyProgress(
                competencyId = competencyId,
                competency = comp?.name ?: "Unknown",
                strand = strand?.name ?: "",
                learningArea = area?.name ?: "",
                lessonsMapped = acc.lessons,
                attempts = acc.attempts,
                averageScore = if (acc.attempts > 0) acc.scoreSum / acc.attempts else 0.0,
            )
        }.sortedWith(compareBy({ it.learningArea }, { it.competency }))

        return mapOf("learnerId" to learnerId, "competencies" to result)
    }

    @Transactional(readOnly = true)
    @GetMapping("/classes/{classId}/competency-summary")
    @PreAuthorize("hasAnyRole('TEACHER', 'SCHOOL_ADMIN', 'ADMIN')")
    fun classCompetencySummary(@AuthenticationPrincipal actor: User, @PathVariable classId: Long): Map<String, Any> {
        // Cohort-level aggregation only: averages across enrolled learners.
        val enrolled = com.elekeza.backend.attendance.ClassEnrollment::class
        val learnerIds = learnerIdsForClass(actor, classId)
        if (learnerIds.isEmpty()) {
            return mapOf("classId" to classId, "competencies" to emptyList<CompetencyProgress>())
        }

        data class Acc(val learners: MutableSet<Long> = mutableSetOf(), var attempts: Int = 0, var scoreSum: Double = 0.0)
        val byCompetency = mutableMapOf<Long, Acc>()

        for (learnerId in learnerIds) {
            val progress = progressRepo.findByUserIdOrderByCreatedAtDesc(learnerId)
            val contents = progress.map { it.contentId }.distinct()
                .mapNotNull { contentRepo.findById(it).orElse(null) }
                .filter { it.objectiveId != null }
            for (content in contents) {
                val objective = objectiveRepo.findById(content.objectiveId!!).orElse(null) ?: continue
                val acc = byCompetency.getOrPut(objective.competencyId) { Acc() }
                acc.learners.add(learnerId)
                progress.filter { it.contentId == content.id && it.completed && it.quizScore != null }.forEach { p ->
                    acc.attempts += 1
                    acc.scoreSum += p.quizScore!!
                }
            }
        }

        val result = byCompetency.map { (competencyId, acc) ->
            val comp = competencyRepo.findById(competencyId).orElse(null)
            val sub = comp?.let { subStrandRepo.findById(it.subStrandId).orElse(null) }
            val strand = sub?.let { strandRepo.findById(it.strandId).orElse(null) }
            val area = strand?.let { areaRepo.findById(it.learningAreaId).orElse(null) }
            CompetencyProgress(
                competencyId = competencyId,
                competency = comp?.name ?: "Unknown",
                strand = strand?.name ?: "",
                learningArea = area?.name ?: "",
                lessonsMapped = acc.learners.size,
                attempts = acc.attempts,
                averageScore = if (acc.attempts > 0) acc.scoreSum / acc.attempts else 0.0,
            )
        }.sortedWith(compareBy({ it.learningArea }, { it.competency }))

        return mapOf("classId" to classId, "competencies" to result)
    }

    /** Learner sees own progress; staff see learners in their institution. */
    private fun requireLearnerAccess(actor: User, learnerId: Long) {
        if (actor.id == learnerId) return
        val learner = userRepository.findById(learnerId).orElse(null)
            ?: throw ResponseStatusException(HttpStatus.NOT_FOUND, "Learner not found")
        if (actor.role in setOf(UserRole.TEACHER, UserRole.SCHOOL_ADMIN) && actor.institutionId == learner.institutionId) return
        if (actor.role == UserRole.ADMIN) return
        throw ResponseStatusException(HttpStatus.FORBIDDEN, "Not authorized to view this learner's progress")
    }

    private fun learnerIdsForClass(actor: User, classId: Long): List<Long> {
        val cls = classRepo.findById(classId).orElse(null)
            ?: throw ResponseStatusException(HttpStatus.NOT_FOUND, "Class not found")
        if (actor.role != UserRole.ADMIN && actor.institutionId != cls.institutionId) {
            throw ResponseStatusException(HttpStatus.NOT_FOUND, "Class not found")
        }
        return enrollmentRepo.findByClassIdAndActiveTrue(classId).map { it.learnerId }
    }
}
