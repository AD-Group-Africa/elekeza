package com.elekeza.backend.attendance

import com.elekeza.backend.auth.UserRole
import com.elekeza.backend.institution.Institution
import com.elekeza.backend.institution.InstitutionRepository
import com.elekeza.backend.testutil.ApiTestSupport
import com.elekeza.backend.testutil.HttpOutcome
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.BeforeAll
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.TestInstance
import org.springframework.beans.factory.annotation.Autowired

/** Class creation and enrolment: permissions, tenant isolation, full workflow. */
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class ClassManagementApiTest : ApiTestSupport() {

    @Autowired lateinit var institutionRepo: InstitutionRepository

    private val adminA = "cls-admin-a@test.local"
    private val adminB = "cls-admin-b@test.local"
    private val teacherA = "cls-teacher-a@test.local"
    private var learnerA = 0L
    private var learnerB = 0L

    @BeforeAll
    fun setup() {
        val instA = institutionRepo.save(Institution(name = "Class Test School A"))
        val instB = institutionRepo.save(Institution(name = "Class Test School B"))
        createUser(adminA, "pass123", "Admin A", UserRole.SCHOOL_ADMIN, instA.id)
        createUser(adminB, "pass123", "Admin B", UserRole.SCHOOL_ADMIN, instB.id)
        createUser(teacherA, "pass123", "Teacher A", UserRole.TEACHER, instA.id)
        learnerA = createUser("cls-learner-a@test.local", "pass123", "Learner A", UserRole.STUDENT, instA.id).id
        learnerB = createUser("cls-learner-b@test.local", "pass123", "Learner B", UserRole.STUDENT, instB.id).id
    }

    private fun createClass(email: String, name: String): HttpOutcome =
        postJson("/api/attendance/classes", """{"name":"$name","gradeLevel":"Grade 4"}""", login(email, "pass123"))

    @Test
    fun `school admin creates a class, enrols and removes a learner`() {
        val created = createClass(adminA, "Grade 4 Workflow")
        assertEquals(201, created.status)
        val classId = created.body!!.get("id").asLong()

        val teacher = login(teacherA, "pass123")
        val enrolled = postJson("/api/attendance/classes/$classId/learners", """{"learnerIds":[$learnerA]}""", teacher)
        assertEquals(200, enrolled.status)
        assertEquals(1, enrolled.body!!.size())

        // Enrolling twice is idempotent.
        postJson("/api/attendance/classes/$classId/learners", """{"learnerIds":[$learnerA]}""", teacher)
        assertEquals(1, get("/api/attendance/classes/$classId/learners", teacher).body!!.size())

        assertEquals(200, delete("/api/attendance/classes/$classId/learners/$learnerA", teacher).status)
        assertEquals(0, get("/api/attendance/classes/$classId/learners", teacher).body!!.size())
    }

    @Test
    fun `teachers cannot create classes and duplicate names are rejected`() {
        assertEquals(403, createClass(teacherA, "Teacher Made").status)
        assertEquals(201, createClass(adminA, "Grade 5 Unique").status)
        assertEquals(409, createClass(adminA, "grade 5 unique").status)
    }

    @Test
    fun `classes and learners are isolated per school`() {
        val classId = createClass(adminA, "Grade 6 Isolated").body!!.get("id").asLong()
        // A learner from another school cannot be enrolled.
        val admin = login(adminA, "pass123")
        assertEquals(404, postJson("/api/attendance/classes/$classId/learners", """{"learnerIds":[$learnerB]}""", admin).status)
        // Another school's admin cannot see or change the class.
        val other = login(adminB, "pass123")
        assertEquals(404, get("/api/attendance/classes/$classId/learners", other).status)
        assertEquals(404, postJson("/api/attendance/classes/$classId/learners", """{"learnerIds":[$learnerB]}""", other).status)
    }
}
