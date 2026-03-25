package com.elewa.backend.domain

import jakarta.persistence.*
import java.time.Instant
import java.util.UUID

@Entity
@Table(name = "simplified_versions")
data class SimplifiedVersion(
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    val id: UUID? = null,

    @Column(name = "document_id", nullable = false)
    val documentId: UUID,

    @Column(nullable = false, length = 50)
    val level: String,

    @Column(name = "simplified_text", columnDefinition = "TEXT", nullable = false)
    val simplifiedText: String,

    @Column(columnDefinition = "numeric")
    var gradeLevel: Double,

    @Column(name = "word_count")
    val wordCount: Int? = null,

    @Column(name = "created_at", nullable = false, updatable = false)
    val createdAt: Instant = Instant.now()
)