package com.elewa.backend.model

import jakarta.persistence.*
import java.time.Instant
import java.util.UUID

@Entity
@Table(name = "key_terms")
class KeyTerm {

    @Id
    val id: UUID = UUID.randomUUID()

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "lesson_id", nullable = false)
    lateinit var lesson: Lesson

    @Column(nullable = false)
    lateinit var term: String

    @Column(nullable = false, columnDefinition = "TEXT")
    var definition: String? = null

    @Column(name = "was_tapped", nullable = false)
    var wasTapped: Boolean = false

    @Column(name = "created_at", nullable = false, updatable = false)
    val createdAt: Instant = Instant.now()
}