package com.elekeza.backend.config.seed

import com.elekeza.backend.attendance.*
import com.elekeza.backend.auth.User
import com.elekeza.backend.auth.UserRepository
import com.elekeza.backend.auth.UserRole
import com.elekeza.backend.finance.*
import com.elekeza.backend.institution.InstitutionRepository
import jakarta.transaction.Transactional
import org.slf4j.LoggerFactory
import org.springframework.boot.CommandLineRunner
import org.springframework.context.annotation.Profile
import org.springframework.core.annotation.Order
import org.springframework.security.crypto.password.PasswordEncoder
import org.springframework.stereotype.Component
import java.time.LocalDate
import java.time.LocalDateTime

/**
 * Attendance + Finance demo seed (dev profile, always on). Builds on the
 * accounts created by DataInitializer/ShowcaseDataInitializer:
 *
 *  - 3 classes with the dev learners enrolled by index;
 *  - 10 school days of attendance history with mixed statuses;
 *  - an academic period ("2026 Term 1"), fee items (Tuition/Meals/Transport),
 *    learner charges and payments demonstrating PAID / PARTIALLY_PAID /
 *    PENDING invoices, a manual CASH payment and a mock M-Pesa payment.
 *
 * Every step is guarded, so repeated boots never duplicate data. Runs on the
 * base dev seed too (single learner → 1 class member, 3 charges, 1 payment),
 * so local previews, demos and the E2E suite all share one deterministic
 * attendance/finance world.
 */
@Component
@Profile("dev")
@Order(2)
class AttendanceFinanceSeed(
    private val userRepository: UserRepository,
    private val passwordEncoder: PasswordEncoder,
    private val institutionRepo: InstitutionRepository,
    private val classRepo: SchoolClassRepository,
    private val enrollmentRepo: ClassEnrollmentRepository,
    private val sessionRepo: AttendanceSessionRepository,
    private val recordRepo: AttendanceRecordRepository,
    private val periodRepo: AcademicPeriodRepository,
    private val feeItemRepo: FeeItemRepository,
    private val structureRepo: FeeStructureRepository,
    private val chargeRepo: LearnerChargeRepository,
    private val paymentRepo: PaymentRepository,
    private val allocationRepo: PaymentAllocationRepository,
    private val financeService: FinanceService
) : CommandLineRunner {

    private val log = LoggerFactory.getLogger(AttendanceFinanceSeed::class.java)

    @Transactional
    override fun run(vararg args: String?) {
        if (classRepo.count() > 0) {
            log.info("Attendance/finance seed already present — skipping.")
            return
        }
        log.info("Seeding attendance + finance demo data...")

        val instId = institutionRepo.findAll().firstOrNull()?.id
            ?: institutionRepo.save(com.elekeza.backend.institution.Institution(name = "Sunrise Inclusive Academy")).id

        val staff = userRepository.findAll().filter { it.institutionId == instId }
        val admin = staff.firstOrNull { it.role == UserRole.ADMIN }
            ?: createUserIfAbsent("admin@elekeza.app", "admin123", "Grace Njeri", UserRole.ADMIN, instId)
        val teacher = userRepository.findByEmail("teacher@elekeza.app")?.takeIf { it.institutionId == instId }
            ?: createUserIfAbsent("teacher@elekeza.app", "teacher123", "Alice Mwalimu", UserRole.TEACHER, instId)
        val learners = userRepository.findAll()
            .filter { it.role == UserRole.STUDENT && it.institutionId == instId }
            .sortedBy { it.id }

        // ── Classes + enrollments ───────────────────────────────────────────
        val classDefs = listOf(
            Triple("Grade 4 Blue", "Grade 4", teacher),
            Triple("Grade 5 Green", "Grade 5", teacher),
            Triple("Grade 6 Orange", "Grade 6", admin)
        )
        val classes = classDefs.mapIndexed { i, (name, grade, _) ->
            classRepo.findByInstitutionIdOrderByNameAsc(instId).firstOrNull { it.name == name }
                ?: classRepo.save(SchoolClass(institutionId = instId, name = name, gradeLevel = grade))
        }
        learners.forEachIndexed { idx, learner ->
            val cls = classes[idx % classes.size]
            val enrolled = enrollmentRepo.findByLearnerIdAndActiveTrue(learner.id).any { it.classId == cls.id }
            if (!enrolled) enrollmentRepo.save(ClassEnrollment(classId = cls.id, learnerId = learner.id))
        }

        // ── Attendance history: last 10 weekdays, mixed statuses ────────────
        val statuses = listOf(
            AttendanceStatus.PRESENT, AttendanceStatus.PRESENT, AttendanceStatus.PRESENT,
            AttendanceStatus.LATE, AttendanceStatus.ABSENT, AttendanceStatus.PRESENT,
            AttendanceStatus.EXCUSED, AttendanceStatus.PRESENT, AttendanceStatus.PRESENT, AttendanceStatus.LATE
        )
        var dayOffset = 1
        var seeded = 0
        val teacherUser = teacher
        while (seeded < 10 && dayOffset < 25) {
            val date = LocalDate.now().minusDays(dayOffset.toLong())
            if (date.dayOfWeek.value > 5) { dayOffset++; continue }   // school days only
            classes.forEachIndexed { ci, cls ->
                if (sessionRepo.findByClassIdAndSessionDate(cls.id, date) != null) return@forEachIndexed
                val session = sessionRepo.save(AttendanceSession(classId = cls.id, sessionDate = date, recordedBy = teacherUser.id))
                val members = enrollmentRepo.findByClassIdAndActiveTrue(cls.id).map { it.learnerId }.sorted()
                members.forEachIndexed { li, learnerId ->
                    // Deterministic variation: mostly PRESENT with realistic scatter.
                    val status = statuses[(li * 3 + ci + dayOffset) % statuses.size]
                    recordRepo.save(AttendanceRecord(
                        sessionId = session.id, learnerId = learnerId, status = status, recordedBy = teacherUser.id
                    ))
                }
            }
            seeded++
            dayOffset++
        }

        // ── Finance: period, items, structures, charges, payments ──────────
        val period = periodRepo.findByInstitutionIdAndIsCurrentTrue(instId)
            ?: periodRepo.save(AcademicPeriod(institutionId = instId, name = "2026 Term 1", isCurrent = true,
                startDate = LocalDate.of(LocalDate.now().year, 1, 6), endDate = LocalDate.of(LocalDate.now().year, 4, 4)))

        val tuition = ensureItem("Tuition", "Term tuition fee", 12000.0)
        val meals = ensureItem("Meals", "Lunch programme", 3000.0)
        val transport = ensureItem("Transport", "School bus", 4500.0)

        // Structures per item (school-wide for the period).
        listOf(tuition to 12000.0, meals to 3000.0, transport to 4500.0).forEach { (item, amount) ->
            val exists = structureRepo.findByInstitutionIdAndPeriodId(instId, period.id).any { it.feeItemId == item.id }
            if (!exists) {
                structureRepo.save(FeeStructure(
                    institutionId = instId, periodId = period.id, feeItemId = item.id, amount = amount
                ))
            }
        }

        // Charges for the first 6 learners: full term billing per learner.
        val chargedLearners = learners.take(6)
        chargedLearners.forEach { learner ->
            listOf(tuition, meals, transport).forEach { item ->
                val exists = chargeRepo.findByLearnerIdAndPeriodId(learner.id, period.id)
                    .any { it.feeItemId == item.id && it.status != ChargeStatus.VOID }
                if (!exists) {
                    chargeRepo.save(LearnerCharge(
                        institutionId = instId, periodId = period.id, feeItemId = item.id,
                        learnerId = learner.id, amount = item.amount,
                        description = "${item.name} — ${period.name}",
                        chargeNumber = nextNumber("INV"),
                        dueDate = LocalDate.now().plusDays(14), createdBy = admin.id
                    ))
                }
            }
        }

        // Payments: Juma (learner 1) fully paid via CASH; learner 2 half-paid
        // via CASH; learner 3 has a mock M-Pesa payment; learners 4–6 unpaid.
        fun payCash(learnerId: Long, amount: Double, note: String) {
            val payment = paymentRepo.save(Payment(
                institutionId = instId, learnerId = learnerId, amount = amount,
                method = PaymentMethod.CASH, status = PaymentStatus.COMPLETED,
                note = note, recordedBy = admin.id, paymentNumber = nextNumber("RCP")
            ))
            finishAllocations(payment)
        }

        fun payMpesaMock(learnerId: Long, amount: Double, checkoutId: String, receipt: String) {
            if (paymentRepo.findByCheckoutRequestId(checkoutId) != null) return
            val payment = paymentRepo.save(Payment(
                institutionId = instId, learnerId = learnerId, amount = amount,
                method = PaymentMethod.MPESA, status = PaymentStatus.COMPLETED,
                providerRef = receipt, checkoutRequestId = checkoutId,
                paymentNumber = nextNumber("RCP")
            ))
            finishAllocations(payment)
        }

        val l1 = chargedLearners.getOrNull(0)
        val l2 = chargedLearners.getOrNull(1)
        val l3 = chargedLearners.getOrNull(2)
        if (l1 != null && paymentRepo.findByLearnerIdOrderByPaidAtDesc(l1.id).isEmpty()) {
            payCash(l1.id, 19500.0, "Term 1 full payment — recorded at school office")
        }
        if (l2 != null && paymentRepo.findByLearnerIdOrderByPaidAtDesc(l2.id).isEmpty()) {
            payCash(l2.id, 9750.0, "Part payment — balance promised before mid-term")
        }
        if (l3 != null && paymentRepo.findByLearnerIdOrderByPaidAtDesc(l3.id).isEmpty()) {
            payMpesaMock(l3.id, 4500.0, "ws_CO_SEED_MOCK_1", "SEEDMPESA01")
        }

        log.info("Attendance + finance seed complete: {} classes, {} learners, {} payments.",
            classes.size, learners.size, paymentRepo.count())
    }

    private fun finishAllocations(payment: Payment) {
        // Same auto-allocation rules as production: oldest due first.
        var remaining = payment.amount
        chargeRepo.findByLearnerIdOrderByCreatedAtDesc(payment.learnerId)
            .filter { it.status != ChargeStatus.VOID }
            .sortedWith(compareBy({ it.dueDate ?: LocalDate.MAX }, { it.createdAt }))
            .forEach { charge ->
                if (remaining <= 0.005) return@forEach
                val paid = allocationRepo.findByChargeId(charge.id).sumOf { it.amount }
                val owed = charge.amount - paid
                if (owed > 0.005) {
                    val portion = minOf(owed, remaining)
                    allocationRepo.save(PaymentAllocation(paymentId = payment.id, chargeId = charge.id, amount = portion))
                    remaining -= portion
                    charge.status = if (portion + paid + 0.005 >= charge.amount) ChargeStatus.PAID else ChargeStatus.PARTIALLY_PAID
                    charge.updatedAt = LocalDateTime.now().atOffset(java.time.ZoneOffset.UTC).toInstant()
                    chargeRepo.save(charge)
                }
            }
    }

    private fun ensureItem(name: String, description: String, amount: Double): FeeItem {
        val instId = institutionRepo.findById(1L).orElseThrow().id
        return feeItemRepo.findByInstitutionIdOrderByActiveDescNameAsc(instId).firstOrNull { it.name == name }
            ?: feeItemRepo.save(FeeItem(institutionId = instId, name = name, description = description, amount = amount))
    }

    private fun nextNumber(prefix: String): String =
        "$prefix-${LocalDate.now().year}-SEED${(System.currentTimeMillis() % 100000).toInt()}"

    private fun createUserIfAbsent(email: String, rawPassword: String, name: String, role: UserRole, institutionId: Long?): User =
        userRepository.findByEmail(email) ?: userRepository.save(
            User(email = email, name = name, password = passwordEncoder.encode(rawPassword), role = role, institutionId = institutionId)
        )
}
