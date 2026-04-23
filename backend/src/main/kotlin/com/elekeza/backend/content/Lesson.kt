package com.elekeza.backend.content

import com.elekeza.backend.learner.Learner
import jakarta.persistence.*
import org.hibernate.annotations.JdbcTypeCode
import org.hibernate.type.SqlTypes
import java.time.Instant
import java.util.UUID

@Entity
@Table(name = "lessons")
class Lesson(
    @Id @GeneratedValue(strategy = GenerationType.UUID)
    val id: UUID = UUID.randomUUID(),

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "learner_id", nullable = false)
    var learner: Learner = Learner(),

    @Column(nullable = false) var title: String = "",
    @Column(columnDefinition = "text") var rawText: String = "",
    var estimatedMinutes: Int? = null,
    @Enumerated(EnumType.STRING) var sourceType: SourceType? = null,
    @JdbcTypeCode(SqlTypes.JSON) @Column(columnDefinition = "jsonb") var quizQuestions: String? = null,
    @Column(updatable = false) val createdAt: Instant = Instant.now()
)