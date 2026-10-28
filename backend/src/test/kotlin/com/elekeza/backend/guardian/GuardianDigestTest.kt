package com.elekeza.backend.guardian

import com.elekeza.backend.assignments.Assignment
import com.elekeza.backend.assignments.AssignmentRepository
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
import java.time.LocalDate

/**
 * Guardian daily digest tests: ward boundary, section completeness
 * (learning / attendance / classwork / fees) and honest empty states.
 */
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
@TestMethodOrder(MethodOrderer.OrderAnnotation::class)
class GuardianDigestTest : ApiTestSupport() {

    @Autowired lateinit var institutionRepo: InstitutionRepository
    @Autowired lateinit var classRepo: SchoolClassRepository
    @Autowired lateinit var enrollmentRepo: ClassEnrollmentRepository
    @Autowired lateinit var guardianLinkRepo: GuardianLinkRepository
    @Autowired lateinit var assignmentRepo: AssignmentRepository
    @Autowired lateinit var attendanceSessionRepo: com.elekeza.backend.attendance.AttendanceSessionRepository
    @Autowired lateinit var attendanceRecordRepo: com.elekeza.backend.attendance.AttendanceRecordRepository
    @Autowired lateinit var learnerRepo: com.elekeza.backend.auth.UserRepository

    private lateinit var inst: Institution
    private lateinit var clazz: SchoolClass
    private lateinit var ward: com.elekeza.backend.auth.User
    private lateinit var other: com.elekeza.backend.auth.User

    private val guardianEmail = "dg-guardian@test.local"
    private val wardEmail = "dg-ward@test.local"
    private val otherEmail = "dg-other@test.local"

    @BeforeAll
    fun setup() {
        inst = institutionRepo.save(Institution(name = "Digest Test School"))
        clazz = classRepo.save(SchoolClass(institutionId = inst.id, name = "Grade 3 Green", gradeLevel = "Grade 3"))
        ward = createUser(wardEmail, "pass123", "Ward One", com.elekeza.backend.auth.UserRole.STUDENT, inst.id)
        other = createUser(otherEmail, "pass123", "Not My Ward", com.elekeza.backend.auth.UserRole.STUDENT, inst.id)
        val g = createUser(guardianEmail, "pass123", "Digest Guardian", com.elekeza.backend.auth.UserRole.GUARDIAN, null)
        guardianLinkRepo.save(GuardianLink(guardianId = g.id, learnerId = ward.id, relationship = "PARENT"))
        enrollmentRepo.save(ClassEnrollment(classId = clazz.id, learnerId = ward.id))

        assignmentRepo.save(
            Assignment(
                institutionId = inst.id, classId = clazz.id, createdBy = ward.id,
                title = "Digest maths task", dueDate = LocalDate.now().plusDays(2)
            )
        )
    }

    @Test
    @Order(1)
    fun `guardian receives digest with all four sections`() {
        val guardian = login(guardianEmail, "pass123")
        val res = get("/api/guardian/wards/${ward.id}/digest", guardian)
        assertEquals(200, res.status, res.bodyText)
        assertEquals("Ward One", res.body?.get("learnerName")?.asText())

        val learning = res.body?.get("learning")
        assertNotNull(learning)
        assertEquals(0, learning?.get("lessonsCompleted")?.asInt())

        val attendance = res.body?.get("attendance")
        assertNotNull(attendance)
        assertTrue(attendance?.has("rate") == true)

        val classwork = res.body?.get("classwork")
        assertNotNull(classwork)
        assertEquals("Digest maths task", classwork?.get("dueSoon")?.get(0)?.get("title")?.asText())
        assertEquals(false, classwork?.get("dueSoon")?.get(0)?.get("submitted")?.asBoolean())

        assertNotNull(res.body?.get("fees"))
        assertEquals(0.0, res.body?.get("fees")?.get("outstanding")?.asDouble() ?: 0.0, 0.001)
    }

    @Test
    @Order(2)
    fun `guardian cannot view digest of unlinked learner`() {
        val guardian = login(guardianEmail, "pass123")
        val res = get("/api/guardian/wards/${other.id}/digest", guardian)
        assertEquals(403, res.status)
    }

    @Test
    @Order(3)
    fun `learner role cannot access digest endpoint`() {
        val learner = login(wardEmail, "pass123")
        val res = get("/api/guardian/wards/${ward.id}/digest", learner)
        assertEquals(403, res.status)
    }

    @Test
    @Order(4)
    fun `digest attendance rate matches the attendance endpoint policy (EXCUSED excluded)`() {
        // Seed marks inside the digest's 60-day window: 2 PRESENT, 1 ABSENT, 1 EXCUSED.
        val session = attendanceSessionRepo.save(
            com.elekeza.backend.attendance.AttendanceSession(classId = clazz.id, sessionDate = LocalDate.now().minusDays(1), recordedBy = ward.id)
        )
        fun rec(status: com.elekeza.backend.attendance.AttendanceStatus) =
            attendanceRecordRepo.save(
                com.elekeza.backend.attendance.AttendanceRecord(sessionId = session.id, learnerId = ward.id, status = status, recordedBy = ward.id)
            )
        rec(com.elekeza.backend.attendance.AttendanceStatus.PRESENT)
        rec(com.elekeza.backend.attendance.AttendanceStatus.PRESENT)
        rec(com.elekeza.backend.attendance.AttendanceStatus.ABSENT)
        rec(com.elekeza.backend.attendance.AttendanceStatus.EXCUSED)

        // Expected under the shared policy: (2 PRESENT + 0 LATE) / 3 assessed = 66.7%.
        // The old digest formula divided by ALL 4 records → 75%; this is the
        // regression this test pins: guardian and attendance numbers now agree.
        val guardian = login(guardianEmail, "pass123")
        val digest = get("/api/guardian/wards/${ward.id}/digest", guardian)
        assertEquals(200, digest.status, digest.bodyText)
        val attendance = digest.body?.get("attendance")
        assertNotNull(attendance?.get("periodLabel")?.asText())
        assertEquals("LAST_60_DAYS", attendance?.get("periodLabel")?.asText())
        assertEquals(66.7, attendance?.get("rate")?.asDouble() ?: 0.0, 0.001,
            "EXCUSED must be excluded from the guardian digest rate")

        // Cross-check: the staff-facing learner endpoint states the same number.
        val teacherEmail = "dg-teacher@test.local"
        createUserIfAbsent(teacherEmail)
        val teacherSession = login(teacherEmail, "teacherpass")
        val learnerHistory = get("/api/attendance/learners/${ward.id}", teacherSession)
        assertEquals(200, learnerHistory.status, learnerHistory.bodyText)
        assertEquals(
            attendance?.get("rate")?.asDouble() ?: 0.0,
            learnerHistory.body?.get("attendanceRate")?.asDouble() ?: 0.0,
            0.001,
            "guardian digest and learner attendance endpoint must agree exactly",
        )
    }

    private fun createUserIfAbsent(email: String) {
        if (learnerRepo.findByEmail(email) == null) {
            createUser(email, "teacherpass", "Digest Teacher", com.elekeza.backend.auth.UserRole.TEACHER, inst.id)
        }
    }
}
