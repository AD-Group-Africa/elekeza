package com.elekeza.backend.analytics

import com.elekeza.backend.auth.User
import com.elekeza.backend.auth.UserRepository
import com.elekeza.backend.auth.UserRole
import com.elekeza.backend.content.ContentRepository
import com.elekeza.backend.learner.LearnerProfileRepository
import com.elekeza.backend.learner.LessonProgressRepository
import com.elekeza.backend.quiz.QuizAttemptRepository
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
    private val learnerProfileRepo: LearnerProfileRepository,
    private val institutionRepo: InstitutionRepository
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
        val allProgress = studentIds.flatMap { lessonProgressRepo.findByUserIdOrderByCreatedAtDesc(it) }
        val completedLessons = allProgress.count { it.completed }
        val assignedLessons = allProgress.size
        val avgScore = allProgress.mapNotNull { it.quizScore }
            .takeIf { it.isNotEmpty() }?.average() ?: 0.0
        val activeThisWeek = allProgress.count {
            it.completedAt != null && it.completedAt!!.isAfter(LocalDateTime.now().minusDays(7))
        }

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
            "completionRate" to (if (assignedLessons > 0) (completedLessons.toDouble() / assignedLessons) * 100 else 0.0),
            "averageScore" to avgScore,
            "atRiskStudents" to atRisk,
            "weeklyActivity" to weeklyActivity,
            "recentAssignments" to recentAssignments,
            "totalQuizzes" to quizAttemptRepo.count()
        ))
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

        val competencyAreas = listOf("Reading", "Comprehension", "Vocabulary", "Critical Thinking", "Application")
        val competencyProgress = competencyAreas.map { area ->
            val areaScores = completed.mapNotNull { it.quizScore }
            mapOf("area" to area, "progress" to if (areaScores.isNotEmpty()) areaScores.average() else 0.0)
        }

        return ResponseEntity.ok(mapOf(
            "learningStreak" to streak,
            "completedLessons" to completed.size,
            "pendingLessons" to pending.size,
            "averageScore" to avgScore,
            "weeklyActivity" to weeklyActivity,
            "quizHistory" to quizHistory,
            "competencyProgress" to competencyProgress
        ))
    }

    @GetMapping("/guardian")
    @PreAuthorize("hasRole('GUARDIAN')")
    fun guardianAnalytics(@AuthenticationPrincipal guardian: User): ResponseEntity<Map<String, Any>> {
        val allStudents = userRepo.findAll().filter { it.role == UserRole.STUDENT }
        val wardData = allStudents.map { child ->
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


