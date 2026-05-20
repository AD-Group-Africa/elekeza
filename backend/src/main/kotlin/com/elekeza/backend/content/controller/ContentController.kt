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

/**
 * FIX: Added /api/content/upload/text endpoint.
 * The frontend api.ts calls POST /content/upload/text with a JSON body:
 *   { text: string, language: string, title: string }
 * But the original ContentController only had /upload accepting multipart/form-data.
 * This mismatch meant text upload (the primary demo feature) never worked.
 */

data class TextUploadRequest(
    val text: String,
    val title: String,
    val language: String = "en",
    val sneType: String? = null
)

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

    /**
     * NEW: Text upload endpoint — matches frontend api.ts content.uploadText()
     * Accepts JSON body, wraps text as an in-memory MultipartFile equivalent,
     * then delegates to ContentService for AI processing.
     */
    @PostMapping("/upload/text")
    fun uploadText(
        @AuthenticationPrincipal principal: UserDetails,
        @RequestBody req: TextUploadRequest
    ): ResponseEntity<Map<String, Any>> {
        val userId = resolveUserId(principal)
        val content = contentService.uploadText(userId, req.text, req.title, req.sneType)
        return ResponseEntity.status(202).body(mapOf(
            "lessonId" to content.id,
            "title"    to (content.title ?: req.title),
            "status"   to content.status.name
        ))
    }

    /**
     * EXISTING: File upload — multipart/form-data
     */
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

    /**
     * FIX: Frontend calls /api/content/history but original endpoint was /list
     * Added /history as an alias mapping to the same logic.
     */
    @GetMapping("/history")
    fun history(
        @AuthenticationPrincipal principal: UserDetails,
        @RequestParam(defaultValue = "0") page: Int,
        @RequestParam(defaultValue = "20") size: Int
    ): ResponseEntity<*> = list(principal, page, size)

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