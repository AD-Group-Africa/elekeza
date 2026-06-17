package com.elekeza.analytics

import com.elekeza.content.ContentAssignmentRepository
import com.elekeza.user.UserRepository
import com.elekeza.user.UserRole
import org.springframework.stereotype.Service
import java.time.LocalDate

@Service
class AnalyticsService(
    private val userRepo: UserRepository,
    private val assignmentRepo: ContentAssignmentRepository
) {
    fun getInstitutionAnalytics(institutionId: Long?): Map<String, Any> {
        if (institutionId == null) return emptyMap()

        val learners = userRepo.findByInstitutionIdAndRole(institutionId, UserRole.LEARNER)
        val totalLearners = learners.size

        // Active this week: students with any completed assignment this week
        val weekStart = LocalDate.now().minusDays(7).atStartOfDay()
        val activeThisWeek = assignmentRepo.findAll().filter {
            it.completedAt != null && it.completedAt!!.isAfter(java.time.Instant.from(weekStart))
        }.map { it.studentId }.distinct().size

        val lessonsCompletedThisWeek = assignmentRepo.findAll().filter {
            it.completedAt != null && it.completedAt!!.isAfter(java.time.Instant.from(weekStart))
        }.size

        // Weekly trend (dummy; in real impl query analytics_events)
        val weeklyTrend = listOf(
            mapOf("day" to "Mon", "completed" to 12),
            mapOf("day" to "Tue", "completed" to 18),
            mapOf("day" to "Wed", "completed" to 15),
            mapOf("day" to "Thu", "completed" to 22),
            mapOf("day" to "Fri", "completed" to 20),
        )

        return mapOf(
            "totalLearners" to totalLearners,
            "activeThisWeek" to activeThisWeek,
            "lessonsCompletedThisWeek" to lessonsCompletedThisWeek,
            "weeklyTrend" to weeklyTrend
        )
    }
}