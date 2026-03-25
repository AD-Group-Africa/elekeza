package com.elewa.backend.domain

import jakarta.persistence.*
import java.time.Instant
import java.util.UUID

@Entity
@Table(name = "documents")
data class Document(
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    val id: UUID? = null,

    @Column(name = "user_id", nullable = false)
    val userId: UUID,

    @Column(nullable = false, length = 500)
    val filename: String,

    @Column(name = "original_text", columnDefinition = "TEXT")
    var originalText: String? = null,

    @Column(name = "file_path", length = 1000)
    val filePath: String? = null,

    @Column(name = "file_size")
    val fileSize: Long? = null,

    @Column(name = "mime_type", length = 100)
    val mimeType: String? = null,

    @Column(length = 50)
    var status: String = "UPLOADED",

    @Column(name = "created_at", nullable = false, updatable = false)
    val createdAt: Instant = Instant.now(),

    @Column(name = "updated_at")
    var updatedAt: Instant = Instant.now()
) {
    // Metadata as a simple mutable map
    @Transient
    var metadata: MutableMap<String, Any> = mutableMapOf()
}