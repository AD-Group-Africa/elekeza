package com.elewa.backend.controller

import com.elewa.backend.dto.LessonResponse
import com.elewa.backend.service.FileUploadService
import org.springframework.http.ResponseEntity
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.security.core.userdetails.UserDetails
import org.springframework.web.bind.annotation.*
import org.springframework.web.multipart.MultipartFile
import java.util.UUID

// Add this endpoint to ContentController, or keep as a separate controller
@RestController
@RequestMapping("/api/content")
class FileUploadController(
    private val fileUploadService: FileUploadService
) {

    /**
     * POST /api/content/upload/file
     * Accepts: text/plain, application/pdf, application/msword,
     *          application/vnd.openxmlformats-officedocument.wordprocessingml.document
     * Max size: 10MB (configured in application.yaml)
     * Returns: same LessonResponse as /upload/text
     */
    @PostMapping("/upload/file", consumes = ["multipart/form-data"])
    fun uploadFile(
        @AuthenticationPrincipal principal: UserDetails,
        @RequestParam("file") file: MultipartFile
    ): ResponseEntity<LessonResponse> {
        val learnerId = UUID.fromString(principal.username)
        val lesson = fileUploadService.uploadFile(learnerId, file)
        return ResponseEntity.ok(lesson)
    }
}