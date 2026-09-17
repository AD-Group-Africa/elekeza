package com.elekeza.backend.attendance

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
import java.time.LocalDate

/**
 * HTTP-level attendance tests: authorization (teacher/admin/guardian/learner),
 * tenant isolation, roster validation, duplicate-save idempotency and the
 * full register workflow. Runs against the real stack (H2 + MockMvc).
 */
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
@TestMethodOrder(MethodOrderer.OrderAnnotation::class)
class AttendanceApiTest : ApiTestSupport() {

    @Autowired lateinit var institutionRepo: InstitutionRepository
    @Autowired lateinit var classRepo: SchoolClassRepository
    @Autowired lateinit var enrollmentRepo: ClassEnrollmentRepository
    @Autowired lateinit var guardianLinkRepo: com.elekeza.backend.institution.GuardianLinkRepository
    @Autowired private lateinit var sessionRepoAutowired: AttendanceSessionRepository
    @Autowired private lateinit var recordRepoAutowired: AttendanceRecordRepository
    private fun sessionRepoBean() = sessionRepoAutowired
    private fun recordRepoBean() = recordRepoAutowired

    private lateinit var instA: Institution
    private lateinit var instB: Institution
    private lateinit var classA: SchoolClass
    private lateinit var classB: SchoolClass
    private lateinit var learnerA1: com.elekeza.backend.auth.User
    private lateinit var learnerA2: com.elekeza.backend.auth.User
    private lateinit var learnerB1: com.elekeza.backend.auth.User

    private val teacherA = "att-teacher-a@test.local"
    private val teacherB = "att-teacher-b@test.local"
    private val adminA = "att-admin-a@test.local"
    private val adminB = "att-admin-b@test.local"
    private val guardianA = "att-guardian-a@test.local"
    private val guardianB = "att-guardian-b@test.local"
    private val learnerEmail1 = "att-learner-a1@test.local"
    private val learnerEmail2 = "att-learner-a2@test.local"


    @BeforeAll
    fun setup() {
        instA = institutionRepo.save(Institution(name = "Attendance Test School A"))
        instB = institutionRepo.save(Institution(name = "Attendance Test School B"))

        createUser(teacherA, "pass123", "Teacher A", com.elekeza.backend.auth.UserRole.TEACHER, instA.id)
        createUser(teacherB, "pass123", "Teacher B", com.elekeza.backend.auth.UserRole.TEACHER, instB.id)
        createUser(adminA, "pass123", "Admin A", com.elekeza.backend.auth.UserRole.SCHOOL_ADMIN, instA.id)
        createUser(adminB, "pass123", "Admin B", com.elekeza.backend.auth.UserRole.SCHOOL_ADMIN, instB.id)
        val guardianUserA = createUser(guardianA, "pass123", "Guardian A", com.elekeza.backend.auth.UserRole.GUARDIAN, null)
        val guardianUserB = createUser(guardianB, "pass123", "Guardian B", com.elekeza.backend.auth.UserRole.GUARDIAN, null)

        learnerA1 = createUser(learnerEmail1, "pass123", "Learner A1", com.elekeza.backend.auth.UserRole.STUDENT, instA.id)
        learnerA2 = createUser(learnerEmail2, "pass123", "Learner A2", com.elekeza.backend.auth.UserRole.STUDENT, instA.id)
        learnerB1 = createUser("att-learner-b1@test.local", "pass123", "Learner B1", com.elekeza.backend.auth.UserRole.STUDENT, instB.id)

        classA = classRepo.save(SchoolClass(institutionId = instA.id, name = "Grade 4 Blue", gradeLevel = "Grade 4"))
        classB = classRepo.save(SchoolClass(institutionId = instB.id, name = "Grade 5 Red", gradeLevel = "Grade 5"))

        enrollmentRepo.save(ClassEnrollment(classId = classA.id, learnerId = learnerA1.id))
        enrollmentRepo.save(ClassEnrollment(classId = classA.id, learnerId = learnerA2.id))
        enrollmentRepo.save(ClassEnrollment(classId = classB.id, learnerId = learnerB1.id))

        // Guardian A is linked to learner A1 only; Guardian B to learner B1.
        guardianLinkRepo.save(
            com.elekeza.backend.institution.GuardianLink(guardianId = guardianUserA.id, learnerId = learnerA1.id, relationship = "PARENT")
        )
        guardianLinkRepo.save(
            com.elekeza.backend.institution.GuardianLink(guardianId = guardianUserB.id, learnerId = learnerB1.id, relationship = "PARENT")
        )
    }

    @Test
    @Order(1)
    fun `teacher can save attendance for their class and duplicates update instead of duplicating`() {
        val teacher = login(teacherA, "pass123")
        val date = LocalDate.now()
        val body = """
            {"records":[
              {"learnerId":${learnerA1.id},"status":"PRESENT"},
              {"learnerId":${learnerA2.id},"status":"ABSENT","note":"Sick"}
            ]}
        """.trimIndent()
        val res = postJson("/api/attendance/classes/${classA.id}/sessions?date=$date", body, teacher)
        assertEquals(200, res.status)
        assertEquals(1L, res.body?.get("counts")?.get("PRESENT")?.asLong())
        assertEquals(1L, res.body?.get("counts")?.get("ABSENT")?.asLong())

        // Save again with changed statuses: rows must UPDATE, not duplicate.
        val body2 = """
            {"records":[
              {"learnerId":${learnerA1.id},"status":"LATE"},
              {"learnerId":${learnerA2.id},"status":"PRESENT"}
            ]}
        """.trimIndent()
        val res2 = postJson("/api/attendance/classes/${classA.id}/sessions?date=$date", body2, teacher)
        assertEquals(200, res2.status)
        val sessionRepo = sessionRepoBean()
        val session = sessionRepo.findByClassIdAndSessionDate(classA.id, date)!!
        assertEquals(2, recordRepoBean().findBySessionId(session.id).size, "duplicate save must not create extra rows")
        assertEquals("LATE", recordRepoBean().findBySessionIdAndLearnerId(session.id, learnerA1.id)?.status?.name)
    }

    @Test
    @Order(2)
    fun `teacher cannot access a class in another institution`() {
        val teacherB = login(teacherB, "pass123")
        val res = get("/api/attendance/classes/${classA.id}/roster?date=${LocalDate.now()}", teacherB)
        assertEquals(403, res.status)
    }

    @Test
    @Order(3)
    fun `school admin cannot cross tenant boundary`() {
        val adminB = login(adminB, "pass123")
        val body = """{"records":[{"learnerId":${learnerA1.id},"status":"PRESENT"}]}"""
        val res = postJson("/api/attendance/classes/${classA.id}/sessions?date=${LocalDate.now()}", body, adminB)
        assertEquals(403, res.status)
    }

    @Test
    @Order(4)
    fun `guardian sees only linked ward attendance`() {
        val guardian = login(guardianA, "pass123")
        val ok = get("/api/attendance/learners/${learnerA1.id}", guardian)
        assertEquals(200, ok.status)

        // Unrelated learner → denied.
        val bad = get("/api/attendance/learners/${learnerA2.id}", guardian)
        assertEquals(403, bad.status)
    }

    @Test
    @Order(5)
    fun `learner can view own attendance but cannot modify it`() {
        val learner = login(learnerEmail1, "pass123")
        val ok = get("/api/attendance/learners/${learnerA1.id}", learner)
        assertEquals(200, ok.status)

        val body = """{"records":[{"learnerId":${learnerA2.id},"status":"PRESENT"}]}"""
        val res = postJson("/api/attendance/classes/${classA.id}/sessions?date=${LocalDate.now()}", body, learner)
        assertEquals(403, res.status)
    }

    @Test
    @Order(6)
    fun `malicious learner id in roster save is rejected`() {
        val teacher = login(teacherA, "pass123")
        val body = """{"records":[{"learnerId":${learnerB1.id},"status":"PRESENT"}]}"""
        val res = postJson("/api/attendance/classes/${classA.id}/sessions?date=${LocalDate.now().plusDays(1)}", body, teacher)
        assertEquals(400, res.status, "learner from another class must be rejected")
    }

    @Test
    @Order(7)
    fun `invalid status value is rejected`() {
        val teacher = login(teacherA, "pass123")
        val body = """{"records":[{"learnerId":${learnerA1.id},"status":"SLEEPING"}]}"""
        val res = postJson("/api/attendance/classes/${classA.id}/sessions?date=${LocalDate.now().plusDays(2)}", body, teacher)
        assertEquals(400, res.status)
    }

    @Test
    @Order(8)
    fun `admin summary works within own institution`() {
        val admin = login(adminA, "pass123")
        val res = get("/api/attendance/summary", admin)
        assertEquals(200, res.status)
        assertNotNull(res.body?.get("counts"))
    }
}
