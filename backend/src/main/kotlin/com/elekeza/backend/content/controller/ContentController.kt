package com.elekeza.backend.content.controller

import com.elekeza.backend.auth.UserRepository
import com.elekeza.backend.content.ContentDto
import com.elekeza.backend.content.ContentRepository
import com.elekeza.backend.content.ContentService
import org.springframework.data.domain.PageRequest
import org.springframework.data.domain.Sort
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.security.core.userdetails.UserDetails
import org.springframework.web.bind.annotation.*
import org.springframework.web.multipart.MultipartFile
import org.springframework.web.server.ResponseStatusException

@RestController
@RequestMapping("/api/content")
class ContentController(
    private val contentService:    ContentService,
    private val contentRepository: ContentRepository,
    private val userRepository:    UserRepository
) {
    private fun resolveUserId(principal: UserDetails): Long =
        userRepository.findByEmail(principal.username)?.id
            ?: throw ResponseStatusException(HttpStatus.UNAUTHORIZED, "User not found")

    @PostMapping("/upload")
    fun upload(
        @AuthenticationPrincipal principal: UserDetails,
        @RequestParam("file") file: MultipartFile,
        @RequestParam(value = "sneType", required = false) sneType: String?
    ): ResponseEntity<ContentDto> {
        val userId  = resolveUserId(principal)
        val content = contentService.upload(userId, file, sneType)
        return ResponseEntity.status(202).body(content.toDto())
    }

    @GetMapping("/{id}")
    fun getById(
        @AuthenticationPrincipal principal: UserDetails,
        @PathVariable id: Long
    ): ResponseEntity<ContentDto> {
        val userId  = resolveUserId(principal)
        val content = contentService.getContent(id, userId)
        return ResponseEntity.ok(content.toDto())
    }

    @GetMapping("/list")
    fun list(
        @AuthenticationPrincipal principal: UserDetails,
        @RequestParam(defaultValue = "0") page: Int,
        @RequestParam(defaultValue = "20") size: Int
    ): ResponseEntity<*> {
        val userId   = resolveUserId(principal)
        val pageable = PageRequest.of(page, size.coerceAtMost(50), Sort.by("createdAt").descending())
        val results  = contentRepository.findByUserIdOrderByCreatedAtDesc(userId, pageable)
        return ResponseEntity.ok(mapOf(
            "data"       to results.content.map { it.toListDto() },
            "total"      to results.totalElements,
            "page"       to results.number,
            "totalPages" to results.totalPages
        ))
    }

    @DeleteMapping("/{id}")
    fun delete(
        @AuthenticationPrincipal principal: UserDetails,
        @PathVariable id: Long
    ): ResponseEntity<*> {
        val userId = resolveUserId(principal)
        contentService.deleteContent(id, userId)
        return ResponseEntity.ok(mapOf("message" to "Content deleted"))
    }
}