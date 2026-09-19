package com.elekeza.backend.support

import com.elekeza.backend.auth.User
import com.elekeza.backend.auth.UserRepository
import com.elekeza.backend.auth.UserRole
import com.elekeza.backend.learner.LessonProgressRepository
import com.elekeza.backend.quiz.QuizAnswerRepository
import com.elekeza.backend.quiz.QuizAttemptRepository
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.Duration
import java.time.Instant
import java.time.LocalDate

@Service
class SupportService(
    private val userRepo: UserRepository,
    private val lessonProgressRepo: LessonProgressRepository,
    private val quizAttemptRepo: QuizAttemptRepository,
    private val quizAnswerRepo: QuizAnswerRepository,
    private val flagRepo: SupportFlagRepository,
    private val interventionRepo: InterventionRepository,
    private val notificationService: com.elekeza.backend.notification.NotificationService,
) {

    data class SignalView(
        val id: Long,
        val learnerId: Long,
        val learnerName: String,
        val signalType: String,
        val status: String,
        val reasons: List<String>,
        val createdAt: String,
    )

    /**
     * Recomputes signals for a teacher's institution learners and persists any
     * new OPEN flags (existing OPEN flags of the same type are kept as-is).
     * Returns the learner-facing list: OPEN + ACKNOWLEDGED flags.
     */
    @Transactional
    fun refreshSignals(teacher: User): List<SignalView> {
        val institutionId = teacher.institutionId
        val learners = if (institutionId != null) {
            userRepo.findByInstitutionIdAndRole(institutionId, UserRole.STUDENT)
        } else emptyList()
        val learnerIds = learners.map { it.id }
        if (learnerIds.isEmpty()) return emptyList()

        val allProgress = learnerIds.flatMap { lessonProgressRepo.findByUserIdOrderByCreatedAtDesc(it) }
        val attemptsByUser = quizAttemptRepo.findAll().filter { it.userId in learnerIds && it.completed }.groupBy { it.userId }
        val completedProgressByUser = allProgress.filter { it.completed }.groupBy { it.user.id }

        learners.forEach { learner ->
            // Scores come from completed quiz attempts (each completion is its
            // own scored row), most recent first.
            val attempts = attemptsByUser[learner.id] ?: emptyList()
            val recentScores = attempts
                .sortedByDescending { it.completedAt ?: it.createdAt }
                .mapNotNull { it.score }
                .take(5)

            val latestAttempt = attempts.maxByOrNull { it.completedAt ?: it.createdAt }
            val latestWrong = latestAttempt?.let { attempt ->
                quizAnswerRepo.findByAttemptId(attempt.id).count { !it.isCorrect }
            } ?: 0

            val completed = completedProgressByUser[learner.id] ?: emptyList()
            val lastActivity = completed.maxByOrNull { it.completedAt ?: it.createdAt }?.completedAt
            val daysSince = lastActivity?.let {
                Duration.between(
                    it.atZone(java.time.ZoneId.systemDefault()).toInstant(),
                    Instant.now()
                ).toDays()
            }

            val hasAssignments = allProgress.any { it.user.id == learner.id }
            val input = LearnerSignalInput(
                learnerId = learner.id,
                name = learner.name,
                recentScores = recentScores,
                daysSinceLastActivity = daysSince,
                hasAssignments = hasAssignments,
                latestWrongAnswers = latestWrong,
            )
            SignalCalculator.computeSignals(input).forEach { computed ->
                val existing = flagRepo.findByLearnerIdAndSignalTypeAndStatus(learner.id, computed.type, SignalStatus.OPEN)
                if (existing == null) {
                    flagRepo.save(SupportFlag(
                        learnerId = learner.id,
                        teacherId = teacher.id,
                        signalType = computed.type,
                        status = SignalStatus.OPEN,
                        reasons = computed.reason,
                    ))
                    notificationService.notifyTeacherOnSupportFlag(teacher.id, learner.name, computed.type.name)
                }
            }
        }

        return findByLearnerIds(learnerIds, teacher)
    }

    fun findByLearnerIds(learnerIds: Collection<Long>, teacher: User): List<SignalView> {
        val flags = flagRepo.findByLearnerIdInAndStatusOrderByCreatedAtDesc(learnerIds, SignalStatus.OPEN) +
            flagRepo.findByLearnerIdInAndStatusOrderByCreatedAtDesc(learnerIds, SignalStatus.ACKNOWLEDGED)
        val names = userRepo.findAllById(flags.map { it.learnerId }.toSet()).associate { it.id to it.name }
        return flags.sortedByDescending { it.createdAt }.map { f ->
            SignalView(
                id = f.id,
                learnerId = f.learnerId,
                learnerName = names[f.learnerId] ?: "Unknown",
                signalType = f.signalType.name,
                status = f.status.name,
                reasons = f.reasons.lines().filter { it.isNotBlank() },
                createdAt = f.createdAt.toString(),
            )
        }
    }

    /** Learners in the teacher's own institution — the only learners a teacher may act on. */
    private fun institutionLearnerIds(teacher: User): Set<Long> {
        val institutionId = teacher.institutionId ?: return emptySet()
        return userRepo.findByInstitutionIdAndRole(institutionId, UserRole.STUDENT).map { it.id }.toSet()
    }

    @Transactional
    fun acknowledge(flagId: Long, teacher: User): Boolean {
        val flag = flagRepo.findById(flagId).orElse(null) ?: return false
        if (flag.status != SignalStatus.OPEN) return false
        // Institution boundary: a teacher may only act on their own learners' flags.
        if (flag.learnerId !in institutionLearnerIds(teacher)) return false
        flagRepo.save(flag.copy(status = SignalStatus.ACKNOWLEDGED, reviewedAt = Instant.now()))
        return true
    }

    @Transactional
    fun dismiss(flagId: Long, teacher: User): Boolean {
        val flag = flagRepo.findById(flagId).orElse(null) ?: return false
        // Institution boundary: a teacher may only act on their own learners' flags.
        if (flag.learnerId !in institutionLearnerIds(teacher)) return false
        flagRepo.save(flag.copy(status = SignalStatus.DISMISSED, reviewedAt = Instant.now()))
        return true
    }

    // ── Interventions ─────────────────────────────────────────────────────────

    @Transactional
    fun createIntervention(
        teacher: User,
        learnerId: Long,
        signalId: Long?,
        type: InterventionType,
        target: String,
        startDate: LocalDate,
        reviewDate: LocalDate?,
    ): Intervention {
        // Institution boundary: interventions may only target the teacher's own learners.
        if (learnerId !in institutionLearnerIds(teacher)) {
            throw org.springframework.web.server.ResponseStatusException(
                org.springframework.http.HttpStatus.NOT_FOUND,
                "Learner not found in your institution"
            )
        }
        return interventionRepo.save(Intervention(
            learnerId = learnerId,
            teacherId = teacher.id,
            signalId = signalId,
            type = type,
            target = target,
            startDate = startDate,
            reviewDate = reviewDate,
        ))
    }

    fun listInterventions(teacher: User, learnerId: Long?): List<Intervention> {
        val learnerIds = institutionLearnerIds(teacher)
        if (learnerIds.isEmpty()) return emptyList()
        return if (learnerId != null) {
            // Institution boundary: learnerId outside the teacher's institution returns nothing.
            if (learnerId !in learnerIds) emptyList()
            else interventionRepo.findByLearnerIdOrderByCreatedAtDesc(learnerId)
        } else {
            interventionRepo.findByLearnerIdInOrderByCreatedAtDesc(learnerIds)
        }
    }

    @Transactional
    fun updateOutcome(teacher: User, interventionId: Long, status: InterventionStatus, outcome: String?): Intervention? {
        val intervention = interventionRepo.findById(interventionId).orElse(null) ?: return null
        // Institution boundary: a teacher may only update their own learners' interventions.
        if (intervention.learnerId !in institutionLearnerIds(teacher)) return null
        return interventionRepo.save(intervention.copy(
            status = status,
            outcome = outcome,
            updatedAt = Instant.now(),
        ))
    }
}
