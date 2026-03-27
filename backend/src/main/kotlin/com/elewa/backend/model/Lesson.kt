package com.elewa.backend.model

import jakarta.persistence.*
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

    @Column(columnDefinition = "jsonb")
    var quizQuestions: String? = null,

    @Column(updatable = false)
    val createdAt: Instant = Instant.now()
) {
    // Default constructor for JPA
    constructor() : this(learner = Learner())
}