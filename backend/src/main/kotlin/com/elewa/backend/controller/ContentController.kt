package com.elewa.backend.controller

import com.elewa.backend.dto.*
import com.elewa.backend.service.ContentService
import org.springframework.http.ResponseEntity
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.security.core.userdetails.UserDetails
import org.springframework.web.bind.annotation.*
import java.util.UUID

@RestController
@RequestMapping("/api/content")
class ContentController(
    private val contentService: ContentService
) {

    @PostMapping("/upload/text")
    fun uploadText(
        @AuthenticationPrincipal principal: UserDetails,
        @RequestBody request: TextUploadRequest
    ): ResponseEntity<LessonResponse> {
        val learnerId = UUID.fromString(principal.username)
        return ResponseEntity.ok(contentService.uploadText(learnerId, request))
    }

    @GetMapping("/lessons/{lessonId}")
    fun getLesson(
        @AuthenticationPrincipal principal: UserDetails,
        @PathVariable lessonId: UUID
    ): ResponseEntity<LessonResponse> {
        val learnerId = UUID.fromString(principal.username)
        return ResponseEntity.ok(contentService.getLesson(learnerId, lessonId))
    }

    @PatchMapping("/lessons/{lessonId}/sections/{sectionId}/progress")
    fun updateSectionProgress(
        @AuthenticationPrincipal principal: UserDetails,
        @PathVariable lessonId: UUID,
        @PathVariable sectionId: UUID,
        @RequestBody request: UpdateProgressRequest
    ): ResponseEntity<SectionProgressResponse> {
        val learnerId = UUID.fromString(principal.username)
        return ResponseEntity.ok(contentService.updateSectionProgress(learnerId, lessonId, sectionId, request))
    }

    @PostMapping("/lessons/{lessonId}/term-tap")
    fun tapTerm(
        @AuthenticationPrincipal principal: UserDetails,
        @PathVariable lessonId: UUID,
        @RequestBody request: TermTapRequest
    ): ResponseEntity<TermTapResponse> {
        val learnerId = UUID.fromString(principal.username)
        return ResponseEntity.ok(contentService.tapTerm(learnerId, lessonId, request.termId))
    }
}

// Simple request DTO for term tap
data class TermTapRequest(val termId: UUID)