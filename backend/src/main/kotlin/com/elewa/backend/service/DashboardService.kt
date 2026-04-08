package com.elewa.backend.service

import com.elewa.backend.dto.*
import com.elewa.backend.repository.*
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.util.UUID

@Service
class DashboardService(
    private val lessonRepository: LessonRepository,
    private val quizRepository: QuizRepository
) {

    @Transactional(readOnly = true)
    fun getDashboard(learnerId: UUID): DashboardResponse {
        val recentLessons = lessonRepository
            .findAllByLearnerIdOrderByCreatedAtDesc(learnerId)
            .take(5)
            .map {
                RecentLessonSummary(
                    lessonId         = it.id,
                    title            = it.title,
                    estimatedMinutes = it.estimatedMinutes ?: 0,
                    createdAt        = it.createdAt.toString()
                )
            }

        val quizHistory = quizRepository
            .findAllByLearnerIdOrderByCreatedAtDesc(learnerId)
            .take(10)
            .map {
                QuizHistoryItem(
                    quizId          = it.id,
                    lessonTitle     = it.lesson.title,
                    scorePercentage = it.scorePercentage?.toDouble() ?: 0.0,
                    completedAt     = it.completedAt?.toString()
                )
            }

        return DashboardResponse(
            lessonsCompleted = lessonRepository.countByLearnerId(learnerId),
            avgQuizScore     = quizRepository.avgScoreByLearnerId(learnerId),
            recentLessons    = recentLessons,
            quizHistory      = quizHistory
        )
    }
}