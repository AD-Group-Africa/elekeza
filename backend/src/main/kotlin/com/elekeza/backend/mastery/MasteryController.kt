package com.elekeza.backend.mastery

import com.elekeza.backend.auth.User
import com.elekeza.backend.auth.UserRepository
import com.elekeza.backend.content.ContentRepository
import com.elekeza.backend.learner.LessonProgressRepository
import com.elekeza.backend.quiz.QuizAttemptRepository
import com.elekeza.backend.quiz.QuizRepository
import org.springframework.security.access.prepost.PreAuthorize
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController
import org.springframework.web.server.ResponseStatusException
import org.springframework.http.HttpStatus

/**
 * Mastery + next-step surfaces.
 *
 * Learner view: one record per lesson with real quiz evidence, a mastery
 * state, the plain-language reason for it, and an explainable next step.
 *
 * Teacher view: the same computation across the teacher's institution, with
 * the same explanations — so "who needs help and why" is always answerable
 * with evidence.
 *
 * This engine never diagnoses disability and never labels the child; states
 * describe evidence about lessons, not about people.
 */
@RestController
@RequestMapping("/api/mastery")
class MasteryController(
    private val userRepo: UserRepository,
    private val progressRepo: LessonProgressRepository,
    private val quizRepo: QuizRepository,
    private val attemptRepo: QuizAttemptRepository,
    private val contentRepo: ContentRepository,
) {

    data class LessonMasteryDto(
        val contentId: Long,
        val title: String,
        val attempts: Int,
        val bestScore: Double?,
        val recentAverage: Double?,
        val state: String,
        val stateLabel: String,
        val reason: String,
        val nextAction: String,
        val nextLabel: String,
        val nextReason: String
    )

    private fun evaluateLesson(userId: Long, contentId: Long, title: String?): LessonMasteryDto {
        val quiz = quizRepo.findByContentId(contentId)
        val scores: List<Double> = quiz?.let { q ->
            attemptRepo.findByQuizIdAndUserId(q.id, userId)
                .filter { it.completed && it.score != null }
                .sortedBy { it.createdAt }
                .map { it.score!! }
        } ?: emptyList()
        val evaluation = MasteryEngine.evaluate(scores)
        val step = MasteryEngine.nextStep(evaluation)
        return LessonMasteryDto(
            contentId = contentId,
            title = title ?: "Lesson",
            attempts = scores.size,
            bestScore = scores.maxOrNull(),
            recentAverage = scores.takeLast(MasteryThresholds.DEFAULT.recentCount).takeIf { it.isNotEmpty() }?.average(),
            state = evaluation.state.name,
            stateLabel = MasteryEngine.label(evaluation.state),
            reason = evaluation.rationale,
            nextAction = step.action,
            nextLabel = step.label,
            nextReason = step.reason
        )
    }

    /** Learner's own mastery map: every lesson they have been assigned. */
    @GetMapping("/learner")
    fun myMastery(@AuthenticationPrincipal user: User): List<LessonMasteryDto> {
        val progressRows = progressRepo.findByUserIdOrderByCreatedAtDesc(user.id)
        return progressRows.map { p ->
            val title = contentRepo.findById(p.contentId).orElse(null)?.title
            evaluateLesson(user.id, p.contentId, title)
        }
    }

    /**
     * Teacher view of one learner's mastery map — evidence-first answers to
     * "who needs help and why".
     */
    @GetMapping("/learner/{learnerId}")
    fun learnerMastery(@AuthenticationPrincipal teacher: User, @PathVariable learnerId: Long): List<LessonMasteryDto> {
        val learner = userRepo.findById(learnerId)
            .orElseThrow { ResponseStatusException(HttpStatus.NOT_FOUND, "Learner not found") }
        if (learner.role != com.elekeza.backend.auth.UserRole.STUDENT) {
            throw ResponseStatusException(HttpStatus.NOT_FOUND, "Learner not found")
        }
        // Tenant isolation: the learner must belong to the teacher's institution
        // (platform ADMINs may view any learner). Same rule as TeacherController.
        if (teacher.role != com.elekeza.backend.auth.UserRole.ADMIN &&
            (teacher.institutionId == null || learner.institutionId != teacher.institutionId)
        ) {
            throw ResponseStatusException(HttpStatus.FORBIDDEN, "Learner not in your institution")
        }
        val progressRows = progressRepo.findByUserIdOrderByCreatedAtDesc(learner.id)
        return progressRows.map { p ->
            val title = contentRepo.findById(p.contentId).orElse(null)?.title
            evaluateLesson(learner.id, p.contentId, title)
        }
    }

    /**
     * Class overview for teachers: which learners need support and the exact
     * evidence for each — the "who needs my attention and why" answer.
     */
    @GetMapping("/teacher/support")
    @PreAuthorize("hasAnyRole('TEACHER', 'ADMIN', 'SCHOOL_ADMIN')")
    fun classSupport(@AuthenticationPrincipal teacher: User): List<Map<String, Any>> {
        val institutionId = teacher.institutionId ?: return emptyList()
        val students = userRepo.findByInstitutionIdAndRole(institutionId, com.elekeza.backend.auth.UserRole.STUDENT)
        val result = mutableListOf<Map<String, Any>>()
        for (student in students) {
            val rows = progressRepo.findByUserIdOrderByCreatedAtDesc(student.id)
            val lessons = rows.map { p ->
                val title = contentRepo.findById(p.contentId).orElse(null)?.title
                evaluateLesson(student.id, p.contentId, title)
            }
            val needsSupport = lessons.filter { it.state == "NEEDS_SUPPORT" }
            val assessed = lessons.filter { it.state != "NOT_ASSESSED" }
            result.add(mapOf(
                "learnerId" to student.id,
                "learnerName" to student.name,
                "lessonsAssessed" to assessed.size,
                "needsSupportCount" to needsSupport.size,
                "masteredCount" to lessons.count { it.state == "MASTERED" },
                "needsSupport" to needsSupport,
                "supportReason" to (needsSupport.firstOrNull()?.reason
                    ?: "No lesson currently needs support.")
            ))
        }
        // Learners with the most support needs first — the teacher's queue.
        return result.sortedWith(compareByDescending<Map<String, Any>> { it["needsSupportCount"] as Int }
            .thenByDescending { it["lessonsAssessed"] as Int })
    }
}
