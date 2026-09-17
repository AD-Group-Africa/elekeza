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
}
