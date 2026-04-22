package com.elekeza.backend.learner

import com.elekeza.backend.auth.User
import jakarta.persistence.*
import java.time.LocalDateTime

@Entity
@Table(
    name = "lesson_progress",
    indexes = [
        Index(name = "idx_lp_user",    columnList = "user_id"),
        Index(name = "idx_lp_content", columnList = "content_id")
    ]
)
data class LessonProgress(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    val user: User,

    @Column(name = "content_id", nullable = false)
    val contentId: Long,

    @Column(name = "quiz_score")
    var quizScore: Double? = null,

    @Column(nullable = false)
    var completed: Boolean = false,

    @Column(name = "completed_at")
    var completedAt: LocalDateTime? = null,

    @Column(name = "created_at", updatable = false)
    val createdAt: LocalDateTime = LocalDateTime.now()
)