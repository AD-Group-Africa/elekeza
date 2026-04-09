package com.elewa.backend.dto

import java.util.UUID

data class TextUploadRequest(
    val text: String,
    val subject: String? = null
)

data class LessonResponse(
    val id: UUID,
    val title: String? = null,
    val sections: List<SectionResponse> = emptyList(),
    val keyTerms: List<KeyTermResponse> = emptyList(),
    val estimatedMinutes: Int? = null,
    val totalSections: Int? = null
)

data class SectionResponse(
    val id: UUID,
    val content: String,
    val timeSpentSeconds: Int
)

data class KeyTermResponse(
    val id: UUID,
    val term: String,
    val definition: String?,
    val wasTapped: Boolean
)

data class UpdateProgressRequest(
    val additionalSeconds: Int
)

data class SectionProgressResponse(
    val id: UUID,
    val timeSpentSeconds: Int
)

data class TermTapResponse(
    val id: UUID,
    val term: String
)

data class TermTapRequest(
    val termId: UUID
)

data class ImageUploadRequest(
    val base64Image: String,
    val mediaType: String
)

data class LessonHistoryItemResponse(
    val id: UUID,
    val title: String,
    val sourceType: String,
    val createdAt: String,
    val summary: String
)
