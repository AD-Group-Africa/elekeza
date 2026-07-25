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
    @PreAuthorize("hasAnyRole('ADMIN', 'SCHOOL_ADMIN')")
    fun revenue(): ResponseEntity<Map<String, Any>> = ResponseEntity.ok(mpesaService.getRevenue())
}
