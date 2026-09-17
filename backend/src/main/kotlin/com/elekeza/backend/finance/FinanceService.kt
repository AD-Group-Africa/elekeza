package com.elekeza.backend.finance

import com.elekeza.backend.attendance.ClassEnrollmentRepository
import com.elekeza.backend.attendance.SchoolClassRepository
import com.elekeza.backend.auth.User
import com.elekeza.backend.auth.UserRepository
import com.elekeza.backend.auth.UserRole
import com.elekeza.backend.institution.GuardianLinkRepository
import com.elekeza.backend.institution.InstitutionRepository
import org.springframework.http.HttpStatus
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.server.ResponseStatusException
import java.time.Instant
import java.time.LocalDate
import java.util.concurrent.atomic.AtomicLong

/**
 * School finance service. Money state is always derived server-side:
 * charge status and balances come from charges minus allocations — the client
 * never submits balances or statuses. Authorization model:
 *
 *  - SCHOOL_ADMIN: full finance control within their own institution;
 *  - ADMIN: platform-wide;
 *  - GUARDIAN: read-only for linked wards, plus M-Pesa payment initiation
 *    when the provider is configured;
 *  - STUDENT: read-only for their own charges/payments;
 *  - TEACHER: no finance access.
 */
@Service
class FinanceService(
    private val periodRepo: AcademicPeriodRepository,
    private val feeItemRepo: FeeItemRepository,
    private val feeStructureRepo: FeeStructureRepository,
    private val chargeRepo: LearnerChargeRepository,
    private val paymentRepo: PaymentRepository,
    private val allocationRepo: PaymentAllocationRepository,
    private val userRepo: UserRepository,
    private val guardianLinkRepo: GuardianLinkRepository,
    private val institutionRepo: InstitutionRepository,
    private val enrollmentRepo: ClassEnrollmentRepository,
    private val classRepo: SchoolClassRepository,
    private val mpesaGateway: MpesaGateway
) {

    // ── Periods / items / structures ────────────────────────────────────────

    fun listPeriods(user: User): List<PeriodDto> {
        val inst = requireInstitution(user)
        return periodRepo.findByInstitutionIdOrderByNameDesc(inst).map {
            PeriodDto(it.id, it.name, it.startDate, it.endDate, it.isCurrent)
        }
    }

    @Transactional
    fun createPeriod(user: User, name: String, startDate: LocalDate?, endDate: LocalDate?, isCurrent: Boolean): PeriodDto {
        val inst = requireInstitution(user)
        if (name.isBlank()) throw ResponseStatusException(HttpStatus.BAD_REQUEST, "Period name is required")
        if (periodRepo.findByInstitutionIdOrderByNameDesc(inst).any { it.name == name.trim() }) {
            throw ResponseStatusException(HttpStatus.CONFLICT, "A period with this name already exists")
        }
        val saved = periodRepo.save(AcademicPeriod(
            institutionId = inst, name = name.trim(), startDate = startDate, endDate = endDate, isCurrent = isCurrent
        ))
        if (isCurrent) {
            // Only one current period per school.
            periodRepo.findByInstitutionIdOrderByNameDesc(inst)
                .filter { it.id != saved.id && it.isCurrent }
                .forEach { periodRepo.save(it.copy(isCurrent = false)) }
        }
        return PeriodDto(saved.id, saved.name, saved.startDate, saved.endDate, saved.isCurrent)
    }

    fun listFeeItems(user: User): List<FeeItemDto> {
        val inst = requireInstitution(user)
        return feeItemRepo.findByInstitutionIdOrderByActiveDescNameAsc(inst).map {
            FeeItemDto(it.id, it.name, it.description, it.amount, it.active)
        }
    }

    @Transactional
    fun createFeeItem(user: User, name: String, description: String?, amount: Double): FeeItemDto {
        val inst = requireInstitution(user)
        if (name.isBlank()) throw ResponseStatusException(HttpStatus.BAD_REQUEST, "Fee item name is required")
        if (amount < 0) throw ResponseStatusException(HttpStatus.BAD_REQUEST, "Amount must be non-negative")
        val saved = feeItemRepo.save(FeeItem(institutionId = inst, name = name.trim(), description = description, amount = amount))
        return FeeItemDto(saved.id, saved.name, saved.description, saved.amount, saved.active)
    }

    fun listStructures(user: User, periodId: Long?): List<FeeStructureDto> {
        val inst = requireInstitution(user)
        val rows = if (periodId != null) feeStructureRepo.findByInstitutionIdAndPeriodId(inst, periodId)
                   else feeStructureRepo.findAll().filter { it.institutionId == inst }
        val itemNames = feeItemRepo.findAll().filter { it.institutionId == inst }.associate { it.id to it.name }
        return rows.map { FeeStructureDto(it.id, it.periodId, it.feeItemId, itemNames[it.feeItemId] ?: "Item ${it.feeItemId}", it.classId, it.amount) }
    }

    @Transactional
    fun createStructure(user: User, periodId: Long, feeItemId: Long, classId: Long?, amount: Double): FeeStructureDto {
        val inst = requireInstitution(user)
        if (amount <= 0) throw ResponseStatusException(HttpStatus.BAD_REQUEST, "Amount must be positive")
        periodRepo.findById(periodId).orElse(null)?.takeIf { it.institutionId == inst }
            ?: throw ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid period")
        feeItemRepo.findById(feeItemId).orElse(null)?.takeIf { it.institutionId == inst && it.active }
            ?: throw ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid fee item")
        if (classId != null) {
            val cls = classRepo.findById(classId).orElse(null)
                ?: throw ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid class")
            if (cls.institutionId != inst) throw ResponseStatusException(HttpStatus.FORBIDDEN, "Class is not in your school")
        }
        val saved = feeStructureRepo.save(FeeStructure(
            institutionId = inst, periodId = periodId, feeItemId = feeItemId,
            classId = classId, amount = amount
        ))
        val itemName = feeItemRepo.findById(feeItemId).map { it.name }.orElse("Item")
        return FeeStructureDto(saved.id, saved.periodId, saved.feeItemId, itemName, saved.classId, saved.amount)
    }

    /**
     * Create learner charges for a whole class (or the whole school when the
     * structure has no class scope) from a fee structure. Existing non-void
     * charges for the same learner+period+item are left untouched, so re-runs
     * are idempotent.
     */
    @Transactional
    fun applyStructure(user: User, structureId: Long): Map<String, Any> {
        val structure = feeStructureRepo.findById(structureId).orElse(null)
            ?: throw ResponseStatusException(HttpStatus.NOT_FOUND, "Fee structure not found")
        if (user.role != UserRole.ADMIN && structure.institutionId != requireInstitution(user)) {
            throw ResponseStatusException(HttpStatus.FORBIDDEN, "Not authorized")
        }

        val learnerIds = if (structure.classId != null) {
            enrollmentRepo.findByClassIdAndActiveTrue(structure.classId!!).map { it.learnerId }
        } else {
            userRepo.findAll().filter { it.role == UserRole.STUDENT && it.institutionId == structure.institutionId }.map { it.id }
        }

        val period = periodRepo.findById(structure.periodId).orElse(null)
            ?: throw ResponseStatusException(HttpStatus.NOT_FOUND, "Period not found")
        val item = feeItemRepo.findById(structure.feeItemId).orElse(null)
            ?: throw ResponseStatusException(HttpStatus.NOT_FOUND, "Fee item not found")

        var created = 0
        learnerIds.forEach { learnerId ->
            val existing = chargeRepo.findByLearnerIdAndPeriodId(learnerId, structure.periodId)
                .any { it.feeItemId == structure.feeItemId && it.status != ChargeStatus.VOID }
            if (!existing) {
                chargeRepo.save(LearnerCharge(
                    institutionId = structure.institutionId, periodId = structure.periodId, feeItemId = structure.feeItemId,
                    learnerId = learnerId, amount = structure.amount,
                    description = "${item.name} — ${period.name}",
                    chargeNumber = nextChargeNumber(),
                    createdBy = user.id
                ))
                created++
            }
        }
        return mapOf("created" to created, "skippedExisting" to (learnerIds.size - created))
    }

    // ── Charges ─────────────────────────────────────────────────────────────

    fun listCharges(user: User, periodId: Long?, learnerId: Long?): List<ChargeDto> {
        return when {
            user.role == UserRole.STUDENT ->
                chargeRepo.findByLearnerIdOrderByCreatedAtDesc(user.id)
            user.role == UserRole.GUARDIAN -> {
                val wardIds = guardianLinkRepo.findByGuardianId(user.id).filter { it.isActive }.map { it.learnerId }
                if (learnerId != null && learnerId !in wardIds) {
                    throw ResponseStatusException(HttpStatus.FORBIDDEN, "Not your ward")
                }
                wardIds.flatMap { chargeRepo.findByLearnerIdOrderByCreatedAtDesc(it) }
            }
            user.role == UserRole.TEACHER ->
                throw ResponseStatusException(HttpStatus.FORBIDDEN, "Teachers have no finance access")
            else -> { // SCHOOL_ADMIN / ADMIN
                val inst = requireInstitution(user)
                if (learnerId != null) {
                    requireStaffLearnerAccess(user, learnerId)
                    chargeRepo.findByLearnerIdOrderByCreatedAtDesc(learnerId)
                        .filter { user.role == UserRole.ADMIN || it.institutionId == inst }
                } else if (periodId != null) {
                    chargeRepo.findByInstitutionIdAndPeriodIdOrderByCreatedAtDesc(inst, periodId)
                } else {
                    chargeRepo.findByInstitutionIdOrderByCreatedAtDesc(inst)
                }
            }
        }.map { toChargeDto(it) }
    }

    @Transactional
    fun createCharge(
        user: User,
        learnerId: Long, periodId: Long, feeItemId: Long, amount: Double, dueDate: LocalDate?, description: String?
    ): ChargeDto {
        if (user.role !in setOf(UserRole.SCHOOL_ADMIN, UserRole.ADMIN)) {
            throw ResponseStatusException(HttpStatus.FORBIDDEN, "Only school administrators can create charges")
        }
        val inst = requireInstitution(user)
        val learner = userRepo.findById(learnerId).orElse(null)
            ?: throw ResponseStatusException(HttpStatus.NOT_FOUND, "Learner not found")
        if (learner.role != UserRole.STUDENT) {
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, "Charges can only be created for learners")
        }
        if (learner.institutionId != inst) throw ResponseStatusException(HttpStatus.FORBIDDEN, "Learner is not in your school")
        if (amount <= 0) throw ResponseStatusException(HttpStatus.BAD_REQUEST, "Amount must be positive")
        periodRepo.findById(periodId).orElse(null)?.takeIf { it.institutionId == inst }
            ?: throw ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid period")
        feeItemRepo.findById(feeItemId).orElse(null)?.takeIf { it.institutionId == inst && it.active }
            ?: throw ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid fee item")

        val saved = chargeRepo.save(LearnerCharge(
            institutionId = inst, periodId = periodId, feeItemId = feeItemId,
            learnerId = learnerId, amount = amount, description = description,
            chargeNumber = nextChargeNumber(), dueDate = dueDate, createdBy = user.id
        ))
        return toChargeDto(saved)
    }

    // ── Payments ────────────────────────────────────────────────────────────

    /** Manual payment (cash / bank) recorded by school admin. */
    @Transactional
    fun recordManualPayment(user: User, req: ManualPaymentRequest): PaymentDto {
        if (user.role !in setOf(UserRole.SCHOOL_ADMIN, UserRole.ADMIN)) {
            throw ResponseStatusException(HttpStatus.FORBIDDEN, "Only school administrators can record manual payments")
        }
        val inst = requireInstitution(user)
        val method = runCatching { PaymentMethod.valueOf(req.method.uppercase()) }
            .getOrElse { throw ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid method '${req.method}'") }
        if (method == PaymentMethod.MPESA) {
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, "Use the M-Pesa flow for mobile money payments")
        }
        if (req.amount <= 0) throw ResponseStatusException(HttpStatus.BAD_REQUEST, "Amount must be positive")

        val learner = userRepo.findById(req.learnerId).orElse(null)
            ?: throw ResponseStatusException(HttpStatus.NOT_FOUND, "Learner not found")
        if (learner.institutionId != inst) throw ResponseStatusException(HttpStatus.FORBIDDEN, "Learner is not in your school")

        return createCompletedPayment(
            institutionId = inst, learnerId = learner.id, amount = req.amount,
            method = method, providerRef = req.providerRef, note = req.note,
            recordedBy = user.id, requestedAllocations = req.allocations
        )
    }

    /** Auto-allocate a payment across the learner's outstanding charges (oldest due first). */
    private fun allocateAutomatically(payment: Payment): List<PaymentAllocation> {
        var remaining = payment.amount
        val outstanding = chargeRepo.findByLearnerIdOrderByCreatedAtDesc(payment.learnerId)
            .filter { it.status != ChargeStatus.VOID }
            .sortedWith(compareBy({ it.dueDate ?: LocalDate.MAX }, { it.createdAt }))
            .map { it to allocatedFor(it.id) }
            .filter { (c, paid) -> paid + 0.001 < c.amount }
        val allocations = mutableListOf<PaymentAllocation>()
        for ((charge, paid) in outstanding) {
            if (remaining <= 0.001) break
            val owed = charge.amount - paid
            val portion = minOf(owed, remaining)
            allocations += allocationRepo.save(PaymentAllocation(paymentId = payment.id, chargeId = charge.id, amount = portion))
            remaining -= portion
        }
        return allocations
    }

    private fun allocatedFor(chargeId: Long): Double =
        allocationRepo.findByChargeId(chargeId).filter { it.amount > 0 }.sumOf { it.amount }

    /**
     * Single transactional entry point for completed payments (manual + M-Pesa
     * callback). Idempotency for provider payments is enforced by the caller
     * via checkoutRequestId/providerRef uniqueness checks.
     */
    @Transactional
    fun createCompletedPayment(
        institutionId: Long, learnerId: Long, amount: Double,
        method: PaymentMethod, providerRef: String?, note: String?,
        recordedBy: Long?, requestedAllocations: List<AllocationRequest>?
    ): PaymentDto {
        val payment = paymentRepo.save(Payment(
            institutionId = institutionId, learnerId = learnerId, amount = amount,
            method = method, status = PaymentStatus.COMPLETED,
            providerRef = providerRef, note = note, recordedBy = recordedBy,
            paymentNumber = nextPaymentNumber()
        ))

        val allocations = if (!requestedAllocations.isNullOrEmpty()) {
            // Explicit allocation: every charge must belong to the same learner,
            // amounts positive, total ≤ payment amount.
            val learnerChargeIds = chargeRepo.findByLearnerIdOrderByCreatedAtDesc(learnerId).map { it.id }.toSet()
            var total = 0.0
            val validated = requestedAllocations.map { a ->
                if (a.chargeId !in learnerChargeIds) {
                    throw ResponseStatusException(HttpStatus.BAD_REQUEST, "Charge ${a.chargeId} does not belong to this learner")
                }
                if (a.amount <= 0) throw ResponseStatusException(HttpStatus.BAD_REQUEST, "Allocation amounts must be positive")
                total += a.amount
                a
            }
            if (total > amount + 0.001) throw ResponseStatusException(HttpStatus.BAD_REQUEST, "Allocations exceed payment amount")
            validated.map { allocationRepo.save(PaymentAllocation(paymentId = payment.id, chargeId = it.chargeId, amount = it.amount)) }
        } else {
            allocateAutomatically(payment)
        }

        refreshChargeStatuses(allocations.map { it.chargeId }.toSet())
        return toPaymentDto(payment, allocations)
    }

    /** Recompute charge statuses from allocations — the only place status changes. */
    private fun refreshChargeStatuses(chargeIds: Set<Long>) {
        chargeIds.forEach { id ->
            chargeRepo.findById(id).ifPresent { charge ->
                val paid = allocatedFor(id)
                charge.status = when {
                    charge.status == ChargeStatus.VOID -> ChargeStatus.VOID
                    paid + 0.005 >= charge.amount -> ChargeStatus.PAID
                    paid > 0.005 -> ChargeStatus.PARTIALLY_PAID
                    else -> ChargeStatus.PENDING
                }
                charge.updatedAt = Instant.now()
                chargeRepo.save(charge)
            }
        }
    }

    // ── M-Pesa integration ──────────────────────────────────────────────────

    /**
     * Guardian/learner/admin initiates an STK push for a learner's fees. The
     * checkout request is remembered by the provider layer so the callback can
     * map it to a payment. No money is recorded until the provider callback
     * confirms success.
     */
    @Transactional
    fun initiateMpesaPayment(actor: User, req: StkPaymentRequest): Map<String, Any> {
        val learner = userRepo.findById(req.learnerId).orElse(null)
            ?: throw ResponseStatusException(HttpStatus.NOT_FOUND, "Learner not found")
        if (!canPayFor(actor, learner.id)) {
            throw ResponseStatusException(HttpStatus.FORBIDDEN, "Not authorized to pay for this learner")
        }
        if (req.amount <= 0) throw ResponseStatusException(HttpStatus.BAD_REQUEST, "Amount must be positive")

        val phone = req.phone ?: actor.phone
        if (phone.isNullOrBlank()) throw ResponseStatusException(HttpStatus.BAD_REQUEST, "A phone number is required for M-Pesa")

        val result = mpesaGateway.stkPush(phone, req.amount, "ELEKEZA-FEES-${learner.id}", "School fees — ${learner.name}")
        val checkoutId = result["checkoutRequestId"] as? String
        if (checkoutId.isNullOrBlank()) {
            throw ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "M-Pesa is not configured or rejected the request")
        }
        return mapOf(
            "checkoutRequestId" to checkoutId,
            "status" to "PENDING",
            "mock" to mpesaGateway.isMock,
            "message" to (result["message"] ?: "Check your phone and enter your M-Pesa PIN")
        )
    }

    /** Who may initiate a fee payment for a learner. */
    fun canPayFor(actor: User, learnerId: Long): Boolean {
        val learner = userRepo.findById(learnerId).orElse(null) ?: return false
        return when (actor.role) {
            UserRole.STUDENT -> actor.id == learner.id
            UserRole.GUARDIAN ->
                guardianLinkRepo.findByGuardianId(actor.id).any { it.learnerId == learner.id && it.isActive }
            UserRole.SCHOOL_ADMIN -> learner.institutionId == actor.institutionId
            UserRole.ADMIN -> true
            else -> false
        }
    }

    /**
     * Called when an M-Pesa callback confirms success. Idempotent: the
     * checkoutRequestId is the idempotency key — a second callback for the
     * same checkout finds the existing payment and returns null (no dupes).
     */
    @Transactional
    fun onMpesaSuccess(checkoutRequestId: String, learnerId: Long, amount: Double, receiptNumber: String?): PaymentDto? {
        if (paymentRepo.findByCheckoutRequestId(checkoutRequestId) != null) return null  // idempotent replay
        if (receiptNumber != null && paymentRepo.findByProviderRef(receiptNumber) != null) return null
        val learner = userRepo.findById(learnerId).orElse(null) ?: return null
        val instId = learner.institutionId ?: return null
        val payment = paymentRepo.save(Payment(
            institutionId = instId,
            learnerId = learnerId, amount = amount, method = PaymentMethod.MPESA,
            status = PaymentStatus.COMPLETED, providerRef = receiptNumber,
            checkoutRequestId = checkoutRequestId, paymentNumber = nextPaymentNumber()
        ))
        val allocations = allocateAutomatically(payment)
        refreshChargeStatuses(allocations.map { it.chargeId }.toSet())
        return toPaymentDto(payment, allocations)
    }

    // ── Read side ───────────────────────────────────────────────────────────

    fun listPayments(user: User, learnerId: Long?): List<PaymentDto> {
        return when {
            user.role == UserRole.STUDENT ->
                paymentRepo.findByLearnerIdOrderByPaidAtDesc(user.id)
            user.role == UserRole.GUARDIAN -> {
                val wardIds = guardianLinkRepo.findByGuardianId(user.id).filter { it.isActive }.map { it.learnerId }
                if (learnerId != null && learnerId !in wardIds) {
                    throw ResponseStatusException(HttpStatus.FORBIDDEN, "Not your ward")
                }
                wardIds.flatMap { paymentRepo.findByLearnerIdOrderByPaidAtDesc(it) }
            }
            user.role == UserRole.TEACHER ->
                throw ResponseStatusException(HttpStatus.FORBIDDEN, "Teachers have no finance access")
            else -> { // SCHOOL_ADMIN / ADMIN
                val inst = requireInstitution(user)
                if (learnerId != null) {
                    requireStaffLearnerAccess(user, learnerId)
                    paymentRepo.findByLearnerIdOrderByPaidAtDesc(learnerId)
                        .filter { user.role == UserRole.ADMIN || it.institutionId == inst }
                } else {
                    paymentRepo.findByInstitutionIdOrderByPaidAtDesc(inst)
                }
            }
        }.map { p -> toPaymentDto(p, allocationRepo.findByPaymentId(p.id)) }
    }

    /** Receipt for a payment — participant, linked guardian, or same-institution staff. */
    fun receipt(user: User, paymentId: Long): ReceiptDto {
        val payment = paymentRepo.findById(paymentId).orElse(null)
            ?: throw ResponseStatusException(HttpStatus.NOT_FOUND, "Payment not found")
        val learner = userRepo.findById(payment.learnerId).orElse(null)
        val allowed = when (user.role) {
            UserRole.STUDENT -> payment.learnerId == user.id
            UserRole.GUARDIAN ->
                guardianLinkRepo.findByGuardianId(user.id).any { it.learnerId == payment.learnerId && it.isActive }
            UserRole.ADMIN -> true
            UserRole.SCHOOL_ADMIN -> payment.institutionId == user.institutionId
            else -> false
        }
        if (!allowed) throw ResponseStatusException(HttpStatus.FORBIDDEN, "Not authorized for this receipt")

        val institutionName = institutionRepo.findById(payment.institutionId).map { it.name }.orElse("School")
        val allocations = allocationRepo.findByPaymentId(payment.id)
        val charges = allocations.mapNotNull { chargeRepo.findById(it.chargeId).orElse(null) }
        val itemNames = feeItemRepo.findAll().filter { it.institutionId == payment.institutionId }.associate { it.id to it.name }
        val recorderName = payment.recordedBy?.let { userRepo.findById(it).orElse(null)?.name }

        return ReceiptDto(
            receiptNumber = payment.paymentNumber,
            paymentId = payment.id,
            learnerId = payment.learnerId,
            learnerName = learner?.name ?: "Learner",
            institutionName = institutionName,
            amount = payment.amount,
            method = payment.method.name,
            providerRef = payment.providerRef,
            recordedByName = recorderName,
            paidAt = payment.paidAt,
            lines = allocations.map { a ->
                val c = charges.firstOrNull { it.id == a.chargeId }
                ReceiptLineDto(
                    chargeNumber = c?.chargeNumber ?: "-",
                    feeItemName = c?.let { itemNames[it.feeItemId] } ?: "Fee",
                    amount = a.amount,
                    chargeStatusAfter = c?.status?.name ?: "-"
                )
            }
        )
    }

    /** Finance dashboard figures — always derived from authoritative records. */
    fun summary(user: User, periodId: Long?): FinanceSummaryDto {
        if (user.role !in setOf(UserRole.SCHOOL_ADMIN, UserRole.ADMIN)) {
            throw ResponseStatusException(HttpStatus.FORBIDDEN, "Not authorized")
        }
        val inst = requireInstitution(user)
        val period = periodId?.let { periodRepo.findById(it).orElse(null)?.takeIf { p -> p.institutionId == inst } }
            ?: periodRepo.findByInstitutionIdAndIsCurrentTrue(inst)
        val charges = if (period != null) chargeRepo.findByInstitutionIdAndPeriodIdOrderByCreatedAtDesc(inst, period.id)
                      else chargeRepo.findByInstitutionIdOrderByCreatedAtDesc(inst)
        val active = charges.filter { it.status != ChargeStatus.VOID }
        val totalBilled = active.sumOf { it.amount }
        val totalCollected = active.sumOf { allocatedFor(it.id) }
        val allPayments = paymentRepo.findByInstitutionIdOrderByPaidAtDesc(inst)
        return FinanceSummaryDto(
            periodId = period?.id,
            periodName = period?.name,
            totalBilled = round2(totalBilled),
            totalCollected = round2(totalCollected),
            outstanding = round2(totalBilled - totalCollected),
            chargeCount = active.size.toLong(),
            paymentCount = allPayments.size.toLong(),
            recentPayments = allPayments.take(10).map { toPaymentDto(it, allocationRepo.findByPaymentId(it.id)) }
        )
    }

    // ── Helpers ─────────────────────────────────────────────────────────────

    private fun requireInstitution(user: User): Long =
        user.institutionId
            ?: if (user.role == UserRole.ADMIN) -1L
            else throw ResponseStatusException(HttpStatus.FORBIDDEN, "No institution linked to this account")

    private fun requireStaffLearnerAccess(user: User, learnerId: Long) {
        if (user.role == UserRole.ADMIN) return
        val learner = userRepo.findById(learnerId).orElse(null)
            ?: throw ResponseStatusException(HttpStatus.NOT_FOUND, "Learner not found")
        if (learner.institutionId != user.institutionId) {
            throw ResponseStatusException(HttpStatus.FORBIDDEN, "Learner is not in your school")
        }
    }

    private fun toChargeDto(c: LearnerCharge): ChargeDto {
        val paid = allocatedFor(c.id)
        val learner = userRepo.findById(c.learnerId).orElse(null)
        val period = periodRepo.findById(c.periodId).orElse(null)
        val item = feeItemRepo.findById(c.feeItemId).orElse(null)
        return ChargeDto(
            id = c.id, chargeNumber = c.chargeNumber, learnerId = c.learnerId,
            learnerName = learner?.name ?: "Learner", periodId = c.periodId,
            periodName = period?.name ?: "-", feeItemId = c.feeItemId,
            feeItemName = item?.name ?: "-", description = c.description,
            amount = c.amount, paidAmount = round2(paid), balance = round2(c.amount - paid),
            status = c.status.name, dueDate = c.dueDate, createdAt = c.createdAt
        )
    }

    private fun toPaymentDto(p: Payment, allocations: List<PaymentAllocation>): PaymentDto {
        val learner = userRepo.findById(p.learnerId).orElse(null)
        val chargeById = allocations.mapNotNull { chargeRepo.findById(it.chargeId).orElse(null) }.associateBy { it.id }
        return PaymentDto(
            id = p.id, paymentNumber = p.paymentNumber, learnerId = p.learnerId,
            learnerName = learner?.name ?: "Learner", amount = p.amount,
            method = p.method.name, status = p.status.name,
            providerRef = p.providerRef, note = p.note, paidAt = p.paidAt,
            allocations = allocations.map { a ->
                val c = chargeById[a.chargeId]
                AllocationDto(a.chargeId, c?.chargeNumber ?: "-", a.amount)
            }
        )
    }

    private fun nextChargeNumber(): String =
        "INV-${LocalDate.now().year}-${"%06d".format(chargeSeq.incrementAndGet() % 1000000)}"

    private fun nextPaymentNumber(): String =
        "RCP-${LocalDate.now().year}-${"%06d".format(chargeSeq.incrementAndGet() % 1000000)}"

    private fun round2(v: Double): Double = Math.round(v * 100.0) / 100.0

    private val chargeSeq = AtomicLong(System.currentTimeMillis() % 100000)
}
