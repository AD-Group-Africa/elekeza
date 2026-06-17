package com.elekeza.guardian

import com.elekeza.institution.GuardianLinkRepository
import com.elekeza.learner.LearnerProfileRepository
import com.elekeza.content.ContentAssignmentRepository
import com.elekeza.user.UserRepository
import org.slf4j.LoggerFactory
import org.springframework.stereotype.Service

@Service
class GuardianService(
    private val guardianLinkRepo: GuardianLinkRepository,
    private val userRepo: UserRepository,
    private val learnerProfileRepo: LearnerProfileRepository,
    private val assignmentRepo: ContentAssignmentRepository,
) {
    private val log = LoggerFactory.getLogger(javaClass)

    data class ChildProgress(
        val learnerId: Long,
        val firstName: String,
        val lastName: String,
        val sneType: String?,
        val gradeLevel: String?,
        val lessonsAssigned: Int,
        val lessonsCompleted: Int,
        val recentActivity: String?,  // "Completed 'Water Cycle' yesterday"
    )

    fun getChildren(guardianId: Long): List<ChildProgress> {
        val links = guardianLinkRepo.findByGuardianId(guardianId)
        return links.map { link ->
            val learner = userRepo.findById(link.learnerId).orElse(null) ?: return@map null
            val profile = learnerProfileRepo.findByUserId(learner.id)
            val assignments = assignmentRepo.findByStudentId(learner.id)
            val completed = assignments.filter { it.completedAt != null }

            val recent = completed.maxByOrNull { it.createdAt }
            val recentText = if (recent != null) {
                "Completed a lesson recently"
            } else if (assignments.isNotEmpty()) {
                "Has ${assignments.size} lessons to complete"
            } else "No lessons assigned yet"

            ChildProgress(
                learnerId = learner.id,
                firstName = learner.firstName,
                lastName = learner.lastName,
                sneType = profile?.diagnosedConditions?.firstOrNull(),
                gradeLevel = profile?.gradeLevel,
                lessonsAssigned = assignments.size,
                lessonsCompleted = completed.size,
                recentActivity = recentText,
            )
        }.filterNotNull()
    }
}