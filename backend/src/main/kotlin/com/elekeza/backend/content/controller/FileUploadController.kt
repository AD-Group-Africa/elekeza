package com.elekeza.backend.content.controller

import com.elekeza.backend.auth.UserRepository
import com.elekeza.backend.content.Content
import com.elekeza.backend.content.FileUploadService
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.security.core.userdetails.UserDetails
import org.springframework.web.bind.annotation.*
import org.springframework.web.multipart.MultipartFile
import org.springframework.web.server.ResponseStatusException

@RestController
@RequestMapping("/api/content")
class FileUploadController(
    private val fileUploadService: FileUploadService,
    private val userRepository:    UserRepository
) {
    private fun resolveUserId(principal: UserDetails): Long =
        userRepository.findByEmail(principal.username)?.id
            ?: throw ResponseStatusException(HttpStatus.UNAUTHORIZED, "User not found")

    @PostMapping("/upload/file", consumes = ["multipart/form-data"])
    fun uploadFile(
        @AuthenticationPrincipal principal: UserDetails,
        @RequestParam("file") file: MultipartFile
    ): ResponseEntity<Content> {
        val userId = resolveUserId(principal)
        return ResponseEntity.ok(fileUploadService.uploadFile(userId, file))
    }
}