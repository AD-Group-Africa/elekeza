package com.elekeza.backend.analytics

import com.elekeza.backend.auth.User
import com.elekeza.backend.auth.UserRepository
import com.elekeza.backend.auth.UserRole
import com.elekeza.backend.content.ContentRepository
import com.elekeza.backend.learner.LearnerProfileRepository
import com.elekeza.backend.learner.LessonProgressRepository
import com.elekeza.backend.quiz.QuizAnswerRepository
import com.elekeza.backend.quiz.QuizAttemptRepository
import com.elekeza.backend.quiz.QuizQuestionRepository
import com.elekeza.backend.quiz.QuizRepository
import com.elekeza.backend.institution.GuardianLinkRepository
import com.elekeza.backend.institution.InstitutionRepository
import org.springframework.http.ResponseEntity
import org.springframework.security.access.prepost.PreAuthorize
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.web.bind.annotation.*
import java.time.LocalDateTime

@RestController
@RequestMapping("/api/analytics")
class AnalyticsController(
    private val userRepo: UserRepository,
    private val contentRepo: ContentRepository,
    private val lessonProgressRepo: LessonProgressRepository,
    private val quizAttemptRepo: QuizAttemptRepository,
    private val quizAnswerRepo: QuizAnswerRepository,
    private val quizQuestionRepo: QuizQuestionRepository,
    private val quizRepo: QuizRepository,
    private val learnerProfileRepo: LearnerProfileRepository,
    private val institutionRepo: InstitutionRepository,
    private val guardianLinkRepo: GuardianLinkRepository
) {
    @GetMapping("/teacher")
    @PreAuthorize("hasAnyRole('TEACHER','ADMIN','SCHOOL_ADMIN')")
    fun teacherAnalytics(@AuthenticationPrincipal teacher: User): ResponseEntity<Map<String, Any>> {
        val institutionId = teacher.institutionId
        val students = if (institutionId != null) {
            userRepo.findByInstitutionIdAndRole(institutionId, UserRole.STUDENT)
        } else emptyList()

        val totalLearners = students.size
        val studentIds = students.map { it.id }
        // Batch fetch in ONE query instead of one query per student (N+1).
        val allProgress = if (studentIds.isEmpty()) emptyList() else lessonProgressRepo.findByUserIdIn(studentIds)
        val completedLessons = allProgress.count { it.completed }
        val assignedLessons = allProgress.size
        val avgScore = allProgress.mapNotNull { it.quizScore }
            .takeIf { it.isNotEmpty() }?.average() ?: 0.0
        // Active learners = DISTINCT learners with activity in the last 7 days,
        // never raw progress rows (a learner with several completed lessons is
        // still one active learner — and the count must never exceed totalLearners).
        val activeThisWeek = allProgress
            .filter { it.completedAt != null && it.completedAt!!.isAfter(LocalDateTime.now().minusDays(7)) }
            .map { it.user.id }
            .distinct()
            .size

        val weeklyActivity = (6 downTo 0).map { daysAgo ->
            val date = LocalDateTime.now().minusDays(daysAgo.toLong())
            mapOf(
                "day" to date.dayOfWeek.name.take(3),
                "completed" to allProgress.count {
                    it.completedAt != null && it.completedAt!!.toLocalDate() == date.toLocalDate()
                }
            )
        }

        val atRisk = allProgress.filter { it.quizScore != null && it.quizScore!! < 40.0 }
            .map { it.user.id }.distinct().size

        val recentAssignments = allProgress.filter { it.completedAt != null }
            .sortedByDescending { it.completedAt }
            .take(10)
            .map { p ->
                val s = students.find { it.id == p.user.id }
                mapOf(
                    "studentName" to (s?.name ?: "Unknown"),
                    "lessonId" to p.contentId,
                    "score" to (p.quizScore ?: 0.0),
                    "completed" to p.completed,
                    "date" to p.completedAt.toString()
                )
            }

        return ResponseEntity.ok(mapOf(
            "totalLearners" to totalLearners,
            "activeLearners" to activeThisWeek,
            "lessonsCreated" to contentRepo.count(),
            "lessonsAssigned" to assignedLessons,
            // Rounded to 1 decimal — UI renders these verbatim.
            "completionRate" to (if (assignedLessons > 0) Math.round((completedLessons.toDouble() / assignedLessons) * 1000.0) / 10.0 else 0.0),
            "averageScore" to Math.round(avgScore * 10.0) / 10.0,
            "atRiskStudents" to atRisk,
            "weeklyActivity" to weeklyActivity,
            "recentAssignments" to recentAssignments,
            "totalQuizzes" to quizAttemptRepo.count()
        ))
    }

    /**
     * Per-question quiz results for the teacher's students (same institution),
     * sourced from the persisted quiz_answers rows. Reveals the answer key
     * only for COMPLETED attempts — post-quiz review data, not live answers.
     */
    @GetMapping("/teacher/quiz-results")
    @PreAuthorize("hasAnyRole('TEACHER','ADMIN','SCHOOL_ADMIN')")
    fun teacherQuizResults(@AuthenticationPrincipal teacher: User): ResponseEntity<List<Map<String, Any>>> {
        val institutionId = teacher.institutionId
        val students = if (institutionId != null) {
            userRepo.findByInstitutionIdAndRole(institutionId, UserRole.STUDENT)
        } else emptyList()
        val studentIds = students.map { it.id }.toSet()
        if (studentIds.isEmpty()) return ResponseEntity.ok(emptyList())

        // Scope every lookup to the institution's students — never scan the
        // platform-wide tables.
        val completedAttempts = quizAttemptRepo.findByUserIdIn(studentIds).filter { it.completed }
        val attemptsById = completedAttempts.associateBy { it.id }
        if (attemptsById.isEmpty()) return ResponseEntity.ok(emptyList())

        val quizIds = completedAttempts.map { it.quizId }.distinct()
        val quizzes = quizRepo.findAllById(quizIds)
        val contentIds = quizzes.map { it.contentId }.distinct()
        val contentsById = contentRepo.findAllById(contentIds).associateBy { it.id }
        val questionIds = quizAnswerRepo.findByAttemptIdIn(attemptsById.keys).map { it.questionId }.distinct()
        val questionsById = quizQuestionRepo.findAllById(questionIds).associateBy { it.id }
        val quizzesById = quizzes.associateBy { it.id }

        val results = quizAnswerRepo.findByAttemptIdIn(attemptsById.keys)
            .map { a ->
                val attempt = attemptsById.getValue(a.attemptId)
                val q = questionsById[a.questionId]
                val content = quizzesById[attempt.quizId]?.let { contentsById[it.contentId] }
                val student = students.find { it.id == attempt.userId }
                mapOf(
                    "studentName" to (student?.name ?: "Unknown"),
                    "studentId" to attempt.userId,
                    "lessonTitle" to (content?.title ?: "Unknown"),
                    "lessonId" to (quizzesById[attempt.quizId]?.contentId ?: -1),
                    "question" to (q?.question ?: ""),
                    "userAnswer" to a.selectedOption,
                    "correctAnswer" to (q?.correctOption ?: ""),
                    "correct" to a.isCorrect,
                    "answeredAt" to a.answeredAt.toString()
                )
            }
            .sortedByDescending { it["answeredAt"] as String }
            .take(100)
        return ResponseEntity.ok(results)
    }

    @GetMapping("/student")
    fun studentAnalytics(@AuthenticationPrincipal student: User): ResponseEntity<Map<String, Any>> {
        val progress = lessonProgressRepo.findByUserIdOrderByCreatedAtDesc(student.id)
        val completed = progress.filter { it.completed }
        val pending = progress.filter { !it.completed }
        val avgScore = if (completed.isNotEmpty()) completed.mapNotNull { it.quizScore }.average() else 0.0

        var streak = 0
        val sortedDates = completed.mapNotNull { it.completedAt }.sortedDescending()
        for (i in sortedDates.indices) {
            if (i == 0) { streak = 1; continue }
            if (sortedDates[i-1].toLocalDate().minusDays(1) == sortedDates[i].toLocalDate()) streak++ else break
        }

        val weeklyActivity = (6 downTo 0).map { daysAgo ->
            val date = LocalDateTime.now().minusDays(daysAgo.toLong())
            mapOf("day" to date.dayOfWeek.name.take(3), "minutes" to completed.filter { it.completedAt?.toLocalDate() == date.toLocalDate() }.size * 15)
        }

        val quizHistory = completed.sortedByDescending { it.completedAt }.take(20).map {
            mapOf("lessonId" to it.contentId, "score" to (it.quizScore ?: 0.0), "date" to it.completedAt.toString())
        }

        // NOTE: per-competency (CBC) analytics intentionally NOT returned here —
        // no competency-level measurement exists in the data model yet. Report
        // real overall progress only; never fabricate per-area breakdowns.
        return ResponseEntity.ok(mapOf(
            "learningStreak" to streak,
            "completedLessons" to completed.size,
            "pendingLessons" to pending.size,
            "averageScore" to avgScore,
            "weeklyActivity" to weeklyActivity,
            "quizHistory" to quizHistory
        ))
    }

    @GetMapping("/guardian")
    @PreAuthorize("hasRole('GUARDIAN')")
    fun guardianAnalytics(@AuthenticationPrincipal guardian: User): ResponseEntity<Map<String, Any>> {
        // A guardian may only ever see their explicitly linked wards — never
        // the platform's full student population.
        val linkedLearnerIds = guardianLinkRepo.findByGuardianId(guardian.id).map { it.learnerId }.toSet()
        val wardData = linkedLearnerIds.mapNotNull { childId ->
            val child = userRepo.findById(childId).orElse(null) ?: return@mapNotNull null
            val progress = lessonProgressRepo.findByUserIdOrderByCreatedAtDesc(child.id)
            val completed = progress.filter { it.completed }
            val avgScore = if (completed.isNotEmpty()) completed.mapNotNull { it.quizScore }.average() else 0.0
            mapOf(
                "childId" to child.id, "childName" to child.name,
                "completedLessons" to completed.size, "pendingLessons" to progress.size - completed.size,
                "averageScore" to avgScore, "lastActive" to progress.firstOrNull()?.completedAt.toString(),
                "progressTimeline" to completed.sortedBy { it.completedAt }.map {
                    mapOf("date" to it.completedAt.toString(), "score" to (it.quizScore ?: 0.0))
                }
            )
        }
        return ResponseEntity.ok(mapOf("wards" to wardData))
    }

    @GetMapping("/admin")
    @PreAuthorize("hasAnyRole('ADMIN','SCHOOL_ADMIN')")
    fun adminAnalytics(): ResponseEntity<Map<String, Any>> {
        val allUsers = userRepo.findAll()
        val students = allUsers.filter { it.role == UserRole.STUDENT }
        val teachers = allUsers.filter { it.role == UserRole.TEACHER }
        val guardians = allUsers.filter { it.role == UserRole.GUARDIAN }
        val institutions = institutionRepo.count()

        val monthlyRegistrations = (5 downTo 0).map { monthsAgo ->
            val month = LocalDateTime.now().minusMonths(monthsAgo.toLong())
            mapOf("month" to month.month.name.take(3), "count" to allUsers.count { java.time.LocalDateTime.ofInstant(it.createdAt, java.time.ZoneId.systemDefault()).month == month.month && java.time.LocalDateTime.ofInstant(it.createdAt, java.time.ZoneId.systemDefault()).year == month.year })
        }

        return ResponseEntity.ok(mapOf(
            "totalLearners" to students.size, "totalTeachers" to teachers.size,
            "totalGuardians" to guardians.size, "totalInstitutions" to institutions,
            "activeToday" to allUsers.count { it.updatedAt != null && java.time.LocalDateTime.ofInstant(it.updatedAt ?: java.time.Instant.now(), java.time.ZoneId.systemDefault()).toLocalDate() == java.time.LocalDate.now() },
            "totalContent" to contentRepo.count(), "totalQuizzes" to quizAttemptRepo.count(),
            "monthlyRegistrations" to monthlyRegistrations
        ))
    }

    @GetMapping("/dashboard")
    fun dashboardSummary(@AuthenticationPrincipal user: User): ResponseEntity<Map<String, Any>> {
        return when (user.role) {
            UserRole.TEACHER -> teacherAnalytics(user)
            UserRole.STUDENT -> studentAnalytics(user)
            UserRole.GUARDIAN -> guardianAnalytics(user)
            else -> ResponseEntity.ok(mapOf("message" to "Dashboard not available for this role"))
        }
    }

    @GetMapping("/admin/overview")
    @PreAuthorize("hasRole('ADMIN')")
    fun adminOverview(): ResponseEntity<Map<String, Any>> {
        val users = userRepo.count()
        val institutions = institutionRepo.count()
        val teachers = userRepo.findByRole(UserRole.TEACHER).size
        val students = userRepo.findByRole(UserRole.STUDENT).size
        val guardians = userRepo.findByRole(UserRole.GUARDIAN).size
        return ResponseEntity.ok(mapOf(
            "totalUsers" to users,
            "institutions" to institutions,
            "teachers" to teachers,
            "students" to students,
            "guardians" to guardians
        ))
    }
}


