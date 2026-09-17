package com.elekeza.backend.finance

import com.elekeza.backend.attendance.ClassEnrollment
import com.elekeza.backend.attendance.ClassEnrollmentRepository
import com.elekeza.backend.attendance.SchoolClass
import com.elekeza.backend.attendance.SchoolClassRepository
import com.elekeza.backend.institution.GuardianLink
import com.elekeza.backend.institution.GuardianLinkRepository
import com.elekeza.backend.institution.Institution
import com.elekeza.backend.institution.InstitutionRepository
import com.elekeza.backend.testutil.ApiTestSupport
import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.BeforeAll
import org.junit.jupiter.api.MethodOrderer
import org.junit.jupiter.api.Order
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.TestInstance
import org.junit.jupiter.api.TestMethodOrder
import org.springframework.beans.factory.annotation.Autowired

/**
 * HTTP-level finance tests: fee setup, charges, manual payments, allocation
 * and balance derivation, M-Pesa callback idempotency, and aggressive
 * authorization checks (tenant, guardian scope, learner restrictions).
 */
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
@TestMethodOrder(MethodOrderer.OrderAnnotation::class)
class FinanceApiTest : ApiTestSupport() {

    @Autowired lateinit var institutionRepo: InstitutionRepository
    @Autowired lateinit var classRepo: SchoolClassRepository
    @Autowired lateinit var enrollmentRepo: ClassEnrollmentRepository
    @Autowired lateinit var guardianLinkRepo: GuardianLinkRepository
    @Autowired lateinit var chargeRepo: LearnerChargeRepository
    @Autowired lateinit var paymentRepo: PaymentRepository
    @Autowired lateinit var allocationRepo: PaymentAllocationRepository
    @Autowired lateinit var periodRepo: AcademicPeriodRepository
    @Autowired lateinit var feeItemRepo: FeeItemRepository

    private lateinit var instA: Institution
    private lateinit var instB: Institution

    private val adminA = "fin-admin-a@test.local"
    private val adminB = "fin-admin-b@test.local"
    private val teacherA = "fin-teacher-a@test.local"
    private val guardianA = "fin-guardian-a@test.local"
    private val guardianB = "fin-guardian-b@test.local"
    private val learnerA1 = "fin-learner-a1@test.local"
    private val learnerA2 = "fin-learner-a2@test.local"
    private val learnerB1 = "fin-learner-b1@test.local"

    private var learnerA1Id: Long = 0
    private var learnerA2Id: Long = 0
    private var learnerB1Id: Long = 0
    private var periodId: Long = 0
    private var tuitionItemId: Long = 0

    @BeforeAll
    fun setup() {
        instA = institutionRepo.save(Institution(name = "Finance Test School A"))
        instB = institutionRepo.save(Institution(name = "Finance Test School B"))

        createUser(adminA, "pass123", "FinAdmin A", com.elekeza.backend.auth.UserRole.SCHOOL_ADMIN, instA.id)
        createUser(adminB, "pass123", "FinAdmin B", com.elekeza.backend.auth.UserRole.SCHOOL_ADMIN, instB.id)
        createUser(teacherA, "pass123", "FinTeacher A", com.elekeza.backend.auth.UserRole.TEACHER, instA.id)
        val gA = createUser(guardianA, "pass123", "FinGuardian A", com.elekeza.backend.auth.UserRole.GUARDIAN, null)
        val gB = createUser(guardianB, "pass123", "FinGuardian B", com.elekeza.backend.auth.UserRole.GUARDIAN, null)

        learnerA1Id = createUser(learnerA1, "pass123", "FinLearner A1", com.elekeza.backend.auth.UserRole.STUDENT, instA.id).id
        learnerA2Id = createUser(learnerA2, "pass123", "FinLearner A2", com.elekeza.backend.auth.UserRole.STUDENT, instA.id).id
        learnerB1Id = createUser(learnerB1, "pass123", "FinLearner B1", com.elekeza.backend.auth.UserRole.STUDENT, instB.id).id

        guardianLinkRepo.save(GuardianLink(guardianId = gA.id, learnerId = learnerA1Id, relationship = "PARENT"))
        guardianLinkRepo.save(GuardianLink(guardianId = gB.id, learnerId = learnerB1Id, relationship = "PARENT"))

        val period = periodRepo.save(AcademicPeriod(institutionId = instA.id, name = "2026 Term 1", isCurrent = true))
        periodId = period.id
        tuitionItemId = feeItemRepo.save(FeeItem(institutionId = instA.id, name = "Tuition", amount = 5000.0)).id
    }

    private fun adminLogin() = login(adminA, "pass123")

    @Test
    @Order(1)
    fun `school admin creates fee item, structure and applies charges to enrolled class`() {
        val admin = adminLogin()
        val cls = classRepo.save(SchoolClass(institutionId = instA.id, name = "Fin Grade 3", gradeLevel = "Grade 3"))
        enrollmentRepo.save(ClassEnrollment(classId = cls.id, learnerId = learnerA1Id))
        enrollmentRepo.save(ClassEnrollment(classId = cls.id, learnerId = learnerA2Id))

        val structure = postJson("/api/finance/structures",
            """{"periodId":$periodId,"feeItemId":$tuitionItemId,"classId":${cls.id},"amount":5000.0}""", admin)
        assertEquals(200, structure.status)
        val structureId = structure.body!!["id"].asLong()

        val applied = postJson("/api/finance/structures/$structureId/apply", "{}", admin)
        assertEquals(200, applied.status)
        assertEquals(2, applied.body!!["created"].asInt(), "charges for both enrolled learners")

        // Re-apply is idempotent: no duplicate charges.
        val applied2 = postJson("/api/finance/structures/$structureId/apply", "{}", admin)
        assertEquals(0, applied2.body!!["created"].asInt())
    }

    @Test
    @Order(2)
    fun `manual payment auto-allocates and charge status transitions to PAID`() {
        val admin = adminLogin()
        val chargesBefore = get("/api/finance/charges?learnerId=$learnerA1Id", admin)
        assertEquals(200, chargesBefore.status)
        val chargeId = chargesBefore.body!!.firstOrNull { it["learnerId"].asLong() == learnerA1Id }!!["id"].asLong()

        val pay = postJson("/api/finance/payments/manual",
            """{"learnerId":$learnerA1Id,"amount":5000.0,"method":"CASH","note":"Term 1 tuition"}""", admin)
        assertEquals(200, pay.status)
        assertEquals("COMPLETED", pay.body!!["status"].asText())
        assertTrue(pay.body!!["allocations"].size() >= 1)

        val chargeAfter = get("/api/finance/charges?learnerId=$learnerA1Id", admin)
            .body!!.firstOrNull { it["id"].asLong() == chargeId }!!
        assertEquals("PAID", chargeAfter["status"].asText())
        assertEquals(0.0, chargeAfter["balance"].asDouble(), 0.01)
    }

    @Test
    @Order(3)
    fun `partial payment leaves PARTIALLY_PAID with server-derived balance`() {
        val admin = adminLogin()
        val charge = postJson("/api/finance/charges",
            """{"learnerId":$learnerA2Id,"periodId":$periodId,"feeItemId":$tuitionItemId,"amount":3000.0,"description":"Activity fee"}""", admin)
        assertEquals(200, charge.status)
        val chargeId = charge.body!!["id"].asLong()

        // Explicit allocation: the learner already has an older Tuition charge,
        // and auto-allocation (oldest due first) is exercised in Order 2 — here
        // the caller pins the money to the Activity fee.
        val pay = postJson("/api/finance/payments/manual",
            """{"learnerId":$learnerA2Id,"amount":1000.0,"method":"BANK","providerRef":"SLIP-001","allocations":[{"chargeId":$chargeId,"amount":1000.0}]}""", admin)
        assertEquals(200, pay.status)

        val after = get("/api/finance/charges?learnerId=$learnerA2Id", admin)
            .body!!.firstOrNull { it["id"].asLong() == chargeId }!!
        assertEquals("PARTIALLY_PAID", after["status"].asText())
        assertEquals(2000.0, after["balance"].asDouble(), 0.01)
        assertEquals(1000.0, after["paidAmount"].asDouble(), 0.01)
    }

    @Test
    @Order(4)
    fun `teacher cannot access finance endpoints`() {
        val teacher = login(teacherA, "pass123")
        assertEquals(403, get("/api/finance/charges", teacher).status)
        assertEquals(403, get("/api/finance/summary", teacher).status)
    }

    @Test
    @Order(5)
    fun `learner cannot create charges or manual payments`() {
        val learner = login(learnerA1, "pass123")
        assertEquals(403, postJson("/api/finance/charges",
            """{"learnerId":$learnerA1Id,"periodId":$periodId,"feeItemId":$tuitionItemId,"amount":1.0}""", learner).status)
        assertEquals(403, postJson("/api/finance/payments/manual",
            """{"learnerId":$learnerA1Id,"amount":100.0,"method":"CASH"}""", learner).status)
    }

    @Test
    @Order(6)
    fun `guardian sees only linked ward charges and cannot see another learner`() {
        val guardian = login(guardianA, "pass123")
        val ok = get("/api/finance/charges", guardian)
        assertEquals(200, ok.status)
        assertTrue(ok.body!!.all { it["learnerId"].asLong() == learnerA1Id }, "guardian only sees linked ward")

        val bad = get("/api/finance/charges?learnerId=$learnerA2Id", guardian)
        assertEquals(403, bad.status, "guardian requesting an unrelated learner must be denied")
    }

    @Test
    @Order(7)
    fun `school admin cannot cross tenant boundary on learners`() {
        val adminB = login(adminB, "pass123")
        val body = """{"learnerId":$learnerA1Id,"amount":100.0,"method":"CASH"}"""
        val res = postJson("/api/finance/payments/manual", body, adminB)
        assertEquals(403, res.status, "admin B cannot record payments for school A learner")
    }

    @Test
    @Order(8)
    fun `client cannot manipulate amount or reassign payment to another learner`() {
        val admin = adminLogin()
        // Amount manipulation: zero/negative amounts rejected.
        assertEquals(400, postJson("/api/finance/payments/manual",
            """{"learnerId":$learnerA1Id,"amount":0,"method":"CASH"}""", admin).status)
        assertEquals(400, postJson("/api/finance/payments/manual",
            """{"learnerId":$learnerA1Id,"amount":-50,"method":"CASH"}""", admin).status)

        // Payment reassignment: an explicit allocation pointing at another
        // learner's charge must be rejected.
        val otherCharge = get("/api/finance/charges?learnerId=$learnerA2Id", admin).body!!.first()!!["id"].asLong()
        val res = postJson("/api/finance/payments/manual",
            """{"learnerId":$learnerA1Id,"amount":100.0,"method":"CASH","allocations":[{"chargeId":$otherCharge,"amount":100.0}]}""", admin)
        assertEquals(400, res.status, "allocating another learner's charge must fail")
    }

    @Test
    @Order(9)
    fun `receipt is available to payer school and guardian but not strangers`() {
        val admin = adminLogin()
        val pay = postJson("/api/finance/payments/manual",
            """{"learnerId":$learnerA2Id,"amount":500.0,"method":"CASH","note":"Top-up"}""", admin)
        val paymentId = pay.body!!["id"].asLong()

        assertEquals(200, get("/api/finance/receipts/$paymentId", admin).status)
        assertEquals(200, get("/api/finance/receipts/$paymentId", login(learnerA2, "pass123")).status)

        // Guardian A is not linked to learner A2 → denied.
        assertEquals(403, get("/api/finance/receipts/$paymentId", login(guardianA, "pass123")).status)
    }

    @Test
    @Order(10)
    fun `duplicate M-Pesa callback creates exactly one payment (idempotency)`() {
        val admin = adminLogin()
        // Outstanding charge for the learner.
        postJson("/api/finance/charges",
            """{"learnerId":$learnerA2Id,"periodId":$periodId,"feeItemId":$tuitionItemId,"amount":2000.0,"description":"Transport"}""", admin)

        val checkoutId = "ws_CO_TEST_IDEMPOTENCY_1"
        val svc = financeServiceBean()

        val first = svc.onMpesaSuccess(checkoutId, learnerA2Id, 1500.0, "QGH7XYZ123")
        assertNotNull(first, "first callback should create the payment")

        val second = svc.onMpesaSuccess(checkoutId, learnerA2Id, 1500.0, "QGH7XYZ123")
        assertNull(second, "duplicate callback must be a no-op")

        val paymentsFor = paymentRepo.findByLearnerIdOrderByPaidAtDesc(learnerA2Id)
            .count { it.checkoutRequestId == checkoutId }
        assertEquals(1, paymentsFor, "exactly one payment for the checkout id")
    }

    @Test
    @Order(11)
    fun `provider callback cannot forge an unknown learner`() {
        val svc = financeServiceBean()
        val res = svc.onMpesaSuccess("ws_CO_FORGED_1", 999999L, 999.0, "FORGED1")
        assertNull(res, "callback for unknown learner must be rejected")
    }

    @Test
    @Order(12)
    fun `finance summary derives figures from authoritative records`() {
        val admin = adminLogin()
        val res = get("/api/finance/summary", admin)
        assertEquals(200, res.status)
        val billed = res.body!!["totalBilled"].asDouble()
        val collected = res.body!!["totalCollected"].asDouble()
        val outstanding = res.body!!["outstanding"].asDouble()
        assertEquals(billed - collected, outstanding, 0.05, "outstanding = billed - collected")
        assertTrue(res.body!!["recentPayments"].isArray)
    }

    @Autowired private lateinit var financeServiceAutowired: FinanceService
    private fun financeServiceBean() = financeServiceAutowired
}
