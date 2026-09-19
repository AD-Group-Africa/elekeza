package com.elekeza.backend.waitlist

import jakarta.validation.Valid
import org.slf4j.LoggerFactory
import org.springframework.data.domain.PageRequest
import org.springframework.data.domain.Sort
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.security.access.prepost.PreAuthorize
import org.springframework.web.bind.annotation.*
import org.springframework.web.server.ResponseStatusException

@RestController
@RequestMapping("/api/waitlist")
class WaitlistController(
    private val waitlistRepository: WaitlistRepository
) {
    private val log = LoggerFactory.getLogger(WaitlistController::class.java)

    // POST /api/waitlist — PUBLIC, rate-limited by RateLimitFilter
    @PostMapping
    fun join(@Valid @RequestBody req: WaitlistRequest): ResponseEntity<*> {
        // Honeypot check — bots fill the hidden 'website' field
        if (!req.website.isNullOrBlank()) {
            log.info("Honeypot triggered from submission — discarding")
            return ResponseEntity.ok(mapOf("message" to "You're on the list!")) // silent drop
        }

        val normalizedEmail = req.email.lowercase().trim()

        if (waitlistRepository.existsByEmail(normalizedEmail)) {
            throw ResponseStatusException(HttpStatus.CONFLICT, "This email is already on the waitlist")
        }

        val entry = WaitlistEntry(
            name   = req.name.trim(),
            email  = normalizedEmail,
            role   = req.role.trim(),
            school = req.school?.trim()
        )
        waitlistRepository.save(entry)
        log.info("New waitlist signup: role={}", req.role)
        return ResponseEntity.status(201).body(mapOf("message" to "You're on the list! We'll be in touch soon."))
    }

    // GET /api/waitlist/count — PUBLIC
    @GetMapping("/count")
    fun count(): ResponseEntity<*> =
        ResponseEntity.ok(mapOf("count" to waitlistRepository.countAll()))

    // GET /api/waitlist/admin — ADMIN only, paginated
    @GetMapping("/admin")
    @PreAuthorize("hasRole('ADMIN')")
    fun adminList(
        @RequestParam(defaultValue = "0") page: Int,
        @RequestParam(defaultValue = "50") size: Int,
        @RequestParam(required = false) role: String?
    ): ResponseEntity<*> {
        val pageable = PageRequest.of(page, size.coerceAtMost(100), Sort.by("createdAt").descending())
        val results  = waitlistRepository.findAll(pageable)
        return ResponseEntity.ok(mapOf(
            "data"       to results.content.map { it.toDto() },
            "total"      to results.totalElements,
            "page"       to results.number,
            "totalPages" to results.totalPages
        ))
    }
}