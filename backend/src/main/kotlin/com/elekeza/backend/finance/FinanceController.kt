package com.elekeza.backend.finance

import com.elekeza.backend.auth.User
import org.springframework.http.ResponseEntity
import org.springframework.security.access.prepost.PreAuthorize
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.web.bind.annotation.*
import java.time.LocalDate

@RestController
@RequestMapping("/api/finance")
class FinanceController(
    private val financeService: FinanceService,
    private val mpesaGateway: MpesaGateway
) {

    // ── Setup (school admin / platform admin) ───────────────────────────

    @GetMapping("/periods")
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN', 'ADMIN')")
    fun periods(@AuthenticationPrincipal user: User): List<PeriodDto> = financeService.listPeriods(user)

    @PostMapping("/periods")
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN', 'ADMIN')")
    fun createPeriod(
        @AuthenticationPrincipal user: User,
        @RequestBody body: CreatePeriodRequest
    ): PeriodDto = financeService.createPeriod(user, body.name, body.startDate, body.endDate, body.isCurrent)

    @GetMapping("/fee-items")
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN', 'ADMIN')")
    fun feeItems(@AuthenticationPrincipal user: User): List<FeeItemDto> = financeService.listFeeItems(user)

    @PostMapping("/fee-items")
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN', 'ADMIN')")
    fun createFeeItem(@AuthenticationPrincipal user: User, @RequestBody body: CreateFeeItemRequest): FeeItemDto =
        financeService.createFeeItem(user, body.name, body.description, body.amount)

    @GetMapping("/structures")
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN', 'ADMIN')")
    fun structures(@AuthenticationPrincipal user: User, @RequestParam(required = false) periodId: Long?): List<FeeStructureDto> =
        financeService.listStructures(user, periodId)

    @PostMapping("/structures")
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN', 'ADMIN')")
    fun createStructure(@AuthenticationPrincipal user: User, @RequestBody body: CreateStructureRequest): FeeStructureDto =
        financeService.createStructure(user, body.periodId, body.feeItemId, body.classId, body.amount)

    @PostMapping("/structures/{id}/apply")
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN', 'ADMIN')")
    fun applyStructure(@AuthenticationPrincipal user: User, @PathVariable id: Long): Map<String, Any> =
        financeService.applyStructure(user, id)

    // ── Charges ─────────────────────────────────────────────────────────

    @GetMapping("/charges")
    @PreAuthorize("hasAnyRole('STUDENT', 'GUARDIAN', 'SCHOOL_ADMIN', 'ADMIN')")
    fun charges(
        @AuthenticationPrincipal user: User,
        @RequestParam(required = false) periodId: Long?,
        @RequestParam(required = false) learnerId: Long?
    ): List<ChargeDto> = financeService.listCharges(user, periodId, learnerId)

    @PostMapping("/charges")
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN', 'ADMIN')")
    fun createCharge(@AuthenticationPrincipal user: User, @RequestBody body: CreateChargeRequest): ChargeDto =
        financeService.createCharge(user, body.learnerId, body.periodId, body.feeItemId, body.amount, body.dueDate, body.description)

    // ── Payments ────────────────────────────────────────────────────────

    @GetMapping("/payments")
    @PreAuthorize("hasAnyRole('STUDENT', 'GUARDIAN', 'SCHOOL_ADMIN', 'ADMIN')")
    fun payments(@AuthenticationPrincipal user: User, @RequestParam(required = false) learnerId: Long?): List<PaymentDto> =
        financeService.listPayments(user, learnerId)

    @PostMapping("/payments/manual")
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN', 'ADMIN')")
    fun manualPayment(@AuthenticationPrincipal user: User, @RequestBody body: ManualPaymentRequest): PaymentDto =
        financeService.recordManualPayment(user, body)

    @PostMapping("/payments/mpesa/initiate")
    @PreAuthorize("hasAnyRole('STUDENT', 'GUARDIAN', 'SCHOOL_ADMIN', 'ADMIN')")
    fun initiateMpesa(@AuthenticationPrincipal user: User, @RequestBody body: StkPaymentRequest): Map<String, Any> =
        financeService.initiateMpesaPayment(user, body)

    /** Honest mode flag so the UI never pretends production M-Pesa is live. */
    @GetMapping("/payments/mpesa/mode")
    @PreAuthorize("isAuthenticated()")
    fun mpesaMode(): Map<String, Any> = mapOf("mock" to mpesaGateway.isMock)

    @GetMapping("/receipts/{paymentId}")
    @PreAuthorize("hasAnyRole('STUDENT', 'GUARDIAN', 'SCHOOL_ADMIN', 'ADMIN')")
    fun receipt(@AuthenticationPrincipal user: User, @PathVariable paymentId: Long): ReceiptDto =
        financeService.receipt(user, paymentId)

    // ── Dashboard ───────────────────────────────────────────────────────

    @GetMapping("/summary")
    @PreAuthorize("hasAnyRole('SCHOOL_ADMIN', 'ADMIN')")
    fun summary(@AuthenticationPrincipal user: User, @RequestParam(required = false) periodId: Long?): FinanceSummaryDto =
        financeService.summary(user, periodId)
}

data class CreatePeriodRequest(
    val name: String,
    val startDate: LocalDate? = null,
    val endDate: LocalDate? = null,
    val isCurrent: Boolean = false
)

data class CreateFeeItemRequest(val name: String, val description: String? = null, val amount: Double)

data class CreateStructureRequest(val periodId: Long, val feeItemId: Long, val classId: Long? = null, val amount: Double)

data class CreateChargeRequest(
    val learnerId: Long,
    val periodId: Long,
    val feeItemId: Long,
    val amount: Double,
    val dueDate: LocalDate? = null,
    val description: String? = null
)
