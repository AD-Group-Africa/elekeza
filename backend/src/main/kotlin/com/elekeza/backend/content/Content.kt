package com.elekeza.backend.content

import jakarta.persistence.*
import java.time.LocalDateTime

enum class ContentStatus { UPLOADING, PROCESSING, READY, FAILED }

@Entity
@Table(
    name = "content",
    indexes = [
        Index(name = "idx_content_user_id", columnList = "user_id"),
        Index(name = "idx_content_status",  columnList = "status")
    ]
)
data class Content(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,

    @Column(name = "user_id", nullable = false)
    val userId: Long,

    @Column(length = 255)
    val title: String? = null,

    @Column(name = "original_filename", length = 255)
    val originalFilename: String? = null,

    @Column(name = "file_path", columnDefinition = "TEXT")
    val filePath: String? = null,

    @Column(name = "sne_type", length = 50)
    val sneType: String? = null,

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    val status: ContentStatus = ContentStatus.UPLOADING,

    @Column(name = "simplified_text", columnDefinition = "TEXT")
    val simplifiedText: String? = null,

    @Column(name = "word_count")
    val wordCount: Int? = null,

    @Column(name = "created_at")
    val createdAt: LocalDateTime = LocalDateTime.now(),

    @Column(name = "updated_at")
    val updatedAt: LocalDateTime = LocalDateTime.now()
) {
    fun toDto() = ContentDto(
        id             = id,
        title          = title,
        sneType        = sneType,
        status         = status.name,
        simplifiedText = simplifiedText,
        wordCount      = wordCount,
        createdAt      = createdAt
    )

    fun toListDto() = ContentListDto(
        id               = id,
        title            = title,
        originalFilename = originalFilename,
        sneType          = sneType,
        status           = status.name,
        wordCount        = wordCount,
        createdAt        = createdAt
    )
}

data class ContentDto(
    val id:             Long,
    val title:          String?,
    val sneType:        String?,
    val status:         String,
    val simplifiedText: String?,
    val wordCount:      Int?,
    val createdAt:      LocalDateTime
)

data class ContentListDto(
    val id:               Long,
    val title:            String?,
    val originalFilename: String?,
    val sneType:          String?,
    val status:           String,
    val wordCount:        Int?,
    val createdAt:        LocalDateTime
)