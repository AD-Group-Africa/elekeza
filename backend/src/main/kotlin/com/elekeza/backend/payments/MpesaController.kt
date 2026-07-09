package com.elekeza.backend.payments

import org.springframework.http.ResponseEntity
import org.springframework.security.access.prepost.PreAuthorize
import org.springframework.web.bind.annotation.*

@RestController
@RequestMapping("/api/payments")
class MpesaController(
    private val mpesaService: MpesaService,
    private val transactionRepo: MpesaTransactionRepository
) {
    @PostMapping("/stkpush")
    fun initiatePayment(@RequestBody req: Map<String, Any>): ResponseEntity<Map<String, Any>> {
        val phone = req["phone"] as? String ?: return ResponseEntity.badRequest().body(mapOf("error" to "Phone required"))
        val amount = (req["amount"] as? Number)?.toDouble() ?: return ResponseEntity.badRequest().body(mapOf("error" to "Amount required"))
        val reference = req["reference"] as? String ?: "Elekeza Payment"
        val description = req["description"] as? String ?: "Payment for Elekeza services"
        return ResponseEntity.ok(mpesaService.stkPush(phone, amount, reference, description))
    }

    @PostMapping("/callback")
    fun callback(@RequestBody body: Map<String, Any>): ResponseEntity<Map<String, Any>> {
        return ResponseEntity.ok(mpesaService.processCallback(body))
    }

    @GetMapping("/status/{checkoutRequestId}")
    fun status(@PathVariable checkoutRequestId: String): ResponseEntity<Map<String, Any>> {
        return ResponseEntity.ok(mpesaService.getTransactionStatus(checkoutRequestId))
    }

    @GetMapping("/revenue")
    @PreAuthorize("hasAnyRole('ADMIN','SCHOOL_ADMIN')")
    fun revenue(): ResponseEntity<Map<String, Any>> {
        return ResponseEntity.ok(mpesaService.getRevenue())
    }

    @GetMapping("/transactions")
    @PreAuthorize("hasAnyRole('ADMIN','SCHOOL_ADMIN')")
    fun transactions(): ResponseEntity<List<MpesaTransaction>> {
        return ResponseEntity.ok(transactionRepo.findAll())
    }
}
