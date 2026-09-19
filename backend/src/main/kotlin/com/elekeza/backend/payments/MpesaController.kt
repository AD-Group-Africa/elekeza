package com.elekeza.backend.payments

import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.security.access.prepost.PreAuthorize
import org.springframework.web.bind.annotation.*
import org.springframework.web.server.ResponseStatusException

data class StkPushRequest(
    val phone: String,
    val amount: Double,
    val reference: String,
    val description: String? = null
)

/** Real Daraja-backed payment endpoints. Credentials and environment are supplied by configuration. */
@RestController
@RequestMapping("/api/payments")
class MpesaController(private val mpesaService: MpesaService) {

    @PostMapping("/stkpush")
    // Money movement is limited to school administrators (the school pays for
    // its account via the school payment page); learners/teachers must never
    // trigger charges.
    @PreAuthorize("hasAnyRole('ADMIN', 'SCHOOL_ADMIN')")
    fun stkPush(@RequestBody request: StkPushRequest): ResponseEntity<Map<String, Any>> {
        if (request.phone.isBlank() || request.amount <= 0 || request.reference.isBlank()) {
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, "phone, positive amount, and reference are required")
        }
        return ResponseEntity.ok(
            mpesaService.stkPush(
                request.phone,
                request.amount,
                request.reference,
                request.description?.takeIf { it.isNotBlank() } ?: request.reference
            )
        )
    }

    @PostMapping("/callback")
    fun callback(@RequestBody body: Map<String, Any>): ResponseEntity<Map<String, Any>> =
        ResponseEntity.ok(mpesaService.processCallback(body))

    @GetMapping("/revenue")
    // Transactions are not institution-tagged, so revenue is platform-wide
    // aggregate data — restricted to platform ADMINs only.
    @PreAuthorize("hasRole('ADMIN')")
    fun revenue(): ResponseEntity<Map<String, Any>> = ResponseEntity.ok(mpesaService.getRevenue())
}
