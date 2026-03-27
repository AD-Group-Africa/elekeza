package com.elewa.backend.model

import jakarta.persistence.*
import java.time.Instant
import java.util.UUID

@Entity
@Table(name = "lesson_sections")
class LessonSection {

    @Id
    val id: UUID = UUID.randomUUID()

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "lesson_id", nullable = false)
    lateinit var lesson: Lesson

    @Column(name = "sequence_number", nullable = false)
    var sequenceNumber: Int = 0

    @Column(nullable = false, columnDefinition = "TEXT")
    lateinit var content: String

    @Column(name = "time_spent_seconds", nullable = false)
    var timeSpentSeconds: Int = 0

    @Column(name = "created_at", nullable = false, updatable = false)
    val createdAt: Instant = Instant.now()

    @Column(name = "updated_at", nullable = false)
    var updatedAt: Instant = Instant.now()
}