package com.elekeza.backend.finance

import jakarta.persistence.*
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.stereotype.Repository
import java.time.Instant
import java.time.LocalDate

// ── Entities ──────────────────────────────────────────────────────────────────

@Entity
@Table(name = "academic_periods", indexes = [Index(name = "idx_period_institution", columnList = "institution_id")])
data class AcademicPeriod(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,
    @Column(name = "institution_id", nullable = false) val institutionId: Long,
    @Column(nullable = false) val name: String,          // "2026 Term 1"
    @Column(name = "start_date") val startDate: LocalDate? = null,
    @Column(name = "end_date") val endDate: LocalDate? = null,
    @Column(name = "is_current", nullable = false) val isCurrent: Boolean = false,
    @Column(name = "created_at", nullable = false) val createdAt: Instant = Instant.now()
)

@Entity
@Table(name = "fee_items", indexes = [Index(name = "idx_fee_item_institution", columnList = "institution_id")])
data class FeeItem(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,
    @Column(name = "institution_id", nullable = false) val institutionId: Long,
    @Column(nullable = false) val name: String,          // Tuition, Transport, Meals…
    @Column(columnDefinition = "VARCHAR(500)") val description: String? = null,
    @Column(nullable = false) val amount: Double,
    @Column(nullable = false) val active: Boolean = true,
    @Column(name = "created_at", nullable = false) val createdAt: Instant = Instant.now(),
    @Column(name = "updated_at", nullable = false) val updatedAt: Instant = Instant.now()
)

@Entity
@Table(name = "fee_structures", indexes = [Index(name = "idx_fee_structure_period", columnList = "period_id")])
data class FeeStructure(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,
    @Column(name = "institution_id", nullable = false) val institutionId: Long,
    @Column(name = "period_id", nullable = false) val periodId: Long,
    @Column(name = "fee_item_id", nullable = false) val feeItemId: Long,
    @Column(name = "class_id") val classId: Long? = null, // null = school-wide for the period
    @Column(nullable = false) val amount: Double,
    @Column(name = "created_at", nullable = false) val createdAt: Instant = Instant.now()
)

enum class ChargeStatus { PENDING, PARTIALLY_PAID, PAID, VOID }

@Entity
@Table(name = "learner_charges", indexes = [
    Index(name = "idx_charge_institution", columnList = "institution_id"),
    Index(name = "idx_charge_learner", columnList = "learner_id"),
    Index(name = "idx_charge_period", columnList = "period_id")
])
data class LearnerCharge(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,
    @Column(name = "institution_id", nullable = false) val institutionId: Long,
    @Column(name = "period_id", nullable = false) val periodId: Long,
    @Column(name = "fee_item_id", nullable = false) val feeItemId: Long,
    @Column(name = "learner_id", nullable = false) val learnerId: Long,
    @Column(nullable = false) val amount: Double,
    @Column(columnDefinition = "VARCHAR(500)") val description: String? = null,
    @Column(name = "charge_number", nullable = false, unique = true) val chargeNumber: String,
    @Column(name = "due_date") val dueDate: LocalDate? = null,
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20) var status: ChargeStatus = ChargeStatus.PENDING,
    @Column(name = "void_reason", columnDefinition = "VARCHAR(500)") var voidReason: String? = null,
    @Column(name = "created_by") val createdBy: Long? = null,
    @Column(name = "created_at", nullable = false) val createdAt: Instant = Instant.now(),
    @Column(name = "updated_at", nullable = false) var updatedAt: Instant = Instant.now()
)

enum class PaymentMethod { MPESA, CASH, BANK }
enum class PaymentStatus { PENDING, COMPLETED, FAILED }

@Entity
@Table(name = "payments", indexes = [
    Index(name = "idx_payment_institution", columnList = "institution_id"),
    Index(name = "idx_payment_learner", columnList = "learner_id"),
    Index(name = "idx_payment_checkout", columnList = "checkout_request_id")
])
data class Payment(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,
    @Column(name = "institution_id", nullable = false) val institutionId: Long,
    @Column(name = "learner_id", nullable = false) val learnerId: Long,
    @Column(nullable = false) val amount: Double,
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20) val method: PaymentMethod,
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20) var status: PaymentStatus = PaymentStatus.COMPLETED,
    @Column(name = "provider_ref", columnDefinition = "VARCHAR(100)") val providerRef: String? = null,
    @Column(name = "checkout_request_id", columnDefinition = "VARCHAR(100)") val checkoutRequestId: String? = null,
    @Column(columnDefinition = "VARCHAR(500)") val note: String? = null,
    @Column(name = "recorded_by") val recordedBy: Long? = null,   // who entered it (manual); null for provider callbacks
    @Column(name = "payment_number", nullable = false, unique = true) val paymentNumber: String,
    @Column(name = "paid_at", nullable = false) val paidAt: Instant = Instant.now(),
    @Column(name = "created_at", nullable = false) val createdAt: Instant = Instant.now()
)

@Entity
@Table(name = "payment_allocations", indexes = [
    Index(name = "idx_allocation_payment", columnList = "payment_id"),
    Index(name = "idx_allocation_charge", columnList = "charge_id")
])
data class PaymentAllocation(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,
    @Column(name = "payment_id", nullable = false) val paymentId: Long,
    @Column(name = "charge_id", nullable = false) val chargeId: Long,
    @Column(nullable = false) val amount: Double,
    @Column(name = "created_at", nullable = false) val createdAt: Instant = Instant.now()
)

// ── Repositories ──────────────────────────────────────────────────────────────

@Repository
interface AcademicPeriodRepository : JpaRepository<AcademicPeriod, Long> {
    fun findByInstitutionIdOrderByNameDesc(institutionId: Long): List<AcademicPeriod>
    fun findByInstitutionIdAndIsCurrentTrue(institutionId: Long): AcademicPeriod?
}

@Repository
interface FeeItemRepository : JpaRepository<FeeItem, Long> {
    fun findByInstitutionIdOrderByActiveDescNameAsc(institutionId: Long): List<FeeItem>
}

@Repository
interface FeeStructureRepository : JpaRepository<FeeStructure, Long> {
    fun findByInstitutionIdAndPeriodId(institutionId: Long, periodId: Long): List<FeeStructure>
}

@Repository
interface LearnerChargeRepository : JpaRepository<LearnerCharge, Long> {
    fun findByLearnerIdOrderByCreatedAtDesc(learnerId: Long): List<LearnerCharge>
    fun findByInstitutionIdOrderByCreatedAtDesc(institutionId: Long): List<LearnerCharge>
    fun findByInstitutionIdAndPeriodIdOrderByCreatedAtDesc(institutionId: Long, periodId: Long): List<LearnerCharge>
    fun findByLearnerIdAndPeriodId(learnerId: Long, periodId: Long): List<LearnerCharge>
}

@Repository
interface PaymentRepository : JpaRepository<Payment, Long> {
    fun findByLearnerIdOrderByPaidAtDesc(learnerId: Long): List<Payment>
    fun findByInstitutionIdOrderByPaidAtDesc(institutionId: Long): List<Payment>
    fun findByCheckoutRequestId(checkoutRequestId: String): Payment?
    fun findByProviderRef(providerRef: String): Payment?
}

@Repository
interface PaymentAllocationRepository : JpaRepository<PaymentAllocation, Long> {
    fun findByPaymentId(paymentId: Long): List<PaymentAllocation>
    fun findByChargeId(chargeId: Long): List<PaymentAllocation>
    fun findByPaymentIdIn(paymentIds: Collection<Long>): List<PaymentAllocation>
}

// ── DTOs ──────────────────────────────────────────────────────────────────────

data class PeriodDto(val id: Long, val name: String, val startDate: LocalDate?, val endDate: LocalDate?, val isCurrent: Boolean)

data class FeeItemDto(val id: Long, val name: String, val description: String?, val amount: Double, val active: Boolean)

data class FeeStructureDto(val id: Long, val periodId: Long, val feeItemId: Long, val feeItemName: String, val classId: Long?, val amount: Double)

data class ChargeDto(
    val id: Long,
    val chargeNumber: String,
    val learnerId: Long,
    val learnerName: String,
    val periodId: Long,
    val periodName: String,
    val feeItemId: Long,
    val feeItemName: String,
    val description: String?,
    val amount: Double,
    val paidAmount: Double,
    val balance: Double,
    val status: String,
    val dueDate: LocalDate?,
    val createdAt: Instant
)

data class PaymentDto(
    val id: Long,
    val paymentNumber: String,
    val learnerId: Long,
    val learnerName: String,
    val amount: Double,
    val method: String,
    val status: String,
    val providerRef: String?,
    val note: String?,
    val paidAt: Instant,
    val allocations: List<AllocationDto>
)

data class AllocationDto(val chargeId: Long, val chargeNumber: String, val amount: Double)

data class ManualPaymentRequest(
    val learnerId: Long,
    val amount: Double,
    val method: String,               // CASH | BANK (MPESA goes through STK push / callback)
    val note: String? = null,
    val providerRef: String? = null,
    val allocations: List<AllocationRequest>? = null   // optional explicit allocation; else auto
)

data class AllocationRequest(val chargeId: Long, val amount: Double)

data class FinanceSummaryDto(
    val periodId: Long?,
    val periodName: String?,
    val totalBilled: Double,
    val totalCollected: Double,
    val outstanding: Double,
    val chargeCount: Long,
    val paymentCount: Long,
    val recentPayments: List<PaymentDto>
)

data class StkPaymentRequest(val learnerId: Long, val amount: Double, val phone: String? = null)

data class ReceiptDto(
    val receiptNumber: String,
    val paymentId: Long,
    val learnerId: Long,
    val learnerName: String,
    val institutionName: String,
    val amount: Double,
    val method: String,
    val providerRef: String?,
    val recordedByName: String?,
    val paidAt: Instant,
    val lines: List<ReceiptLineDto>
)

data class ReceiptLineDto(val chargeNumber: String, val feeItemName: String, val amount: Double, val chargeStatusAfter: String)
