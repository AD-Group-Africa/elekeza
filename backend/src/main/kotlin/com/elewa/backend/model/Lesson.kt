package com.ELEKEZA.backend.model
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

    @ManyToOne
    @JoinColumn(name = "learner_id", nullable = false)
    var learner: Learner,

    var title: String = "",

    @Column(columnDefinition = "text")
    var rawText: String = "",

    var estimatedMinutes: Int? = null,

    @Enumerated(EnumType.STRING)
    var sourceType: SourceType? = null,

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    var quizQuestions: String? = null,

    @Column(updatable = false)
    val createdAt: Instant = Instant.now()
) {
    constructor() : this(learner = Learner())
}
