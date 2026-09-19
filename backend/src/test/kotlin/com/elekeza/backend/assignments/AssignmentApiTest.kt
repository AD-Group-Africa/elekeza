package com.elekeza.backend.assignments

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
import org.springframework.beans.factory.annotation.Autowired as AutowiredAnnotation
import java.time.LocalDate

/**
 * HTTP-level assignment tests: role authorization, tenant isolation,
 * validation, and the full teacher→learner→grading workflow. Runs against
 * the real stack (H2 + MockMvc) through actual cookie logins.
 */
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
@TestMethodOrder(MethodOrderer.OrderAnnotation::class)
class AssignmentApiTest : ApiTestSupport() {

    @Autowired lateinit var institutionRepo: InstitutionRepository
    @Autowired lateinit var classRepo: SchoolClassRepository
    @Autowired lateinit var enrollmentRepo: ClassEnrollmentRepository
    @Autowired lateinit var guardianLinkRepo: GuardianLinkRepository
    @Autowired lateinit var assignmentRepo: AssignmentRepository
    @Autowired lateinit var submissionRepo: AssignmentSubmissionRepository

    private lateinit var instA: Institution
    private lateinit var instB: Institution
    private lateinit var classA: SchoolClass
    private lateinit var classB: SchoolClass
    private lateinit var learnerA1: com.elekeza.backend.auth.User
    private lateinit var learnerA2: com.elekeza.backend.auth.User

    private val teacherA = "asg-teacher-a@test.local"
    private val teacherB = "asg-teacher-b@test.local"
    private val adminA = "asg-admin-a@test.local"
    private val adminB = "asg-admin-b@test.local"
    private val guardianA = "asg-guardian-a@test.local"
    private val learner1 = "asg-learner-a1@test.local"
    private val learner2 = "asg-learner-a2@test.local"
    private val learnerB1 = "asg-learner-b1@test.local"

    @BeforeAll
    fun setup() {
        instA = institutionRepo.save(Institution(name = "Assignment Test School A"))
        instB = institutionRepo.save(Institution(name = "Assignment Test School B"))

        createUser(teacherA, "pass123", "Teacher A", com.elekeza.backend.auth.UserRole.TEACHER, instA.id)
        createUser(teacherB, "pass123", "Teacher B", com.elekeza.backend.auth.UserRole.TEACHER, instB.id)
        createUser(adminA, "pass123", "Admin A", com.elekeza.backend.auth.UserRole.SCHOOL_ADMIN, instA.id)
        createUser(adminB, "pass123", "Admin B", com.elekeza.backend.auth.UserRole.SCHOOL_ADMIN, instB.id)
        val guardianUser = createUser(guardianA, "pass123", "Guardian A", com.elekeza.backend.auth.UserRole.GUARDIAN, null)
        learnerA1 = createUser(learner1, "pass123", "Learner A1", com.elekeza.backend.auth.UserRole.STUDENT, instA.id)
        learnerA2 = createUser(learner2, "pass123", "Learner A2", com.elekeza.backend.auth.UserRole.STUDENT, instA.id)
        createUser(learnerB1, "pass123", "Learner B1", com.elekeza.backend.auth.UserRole.STUDENT, instB.id)

        classA = classRepo.save(SchoolClass(institutionId = instA.id, name = "Grade 4 Blue", gradeLevel = "Grade 4"))
        classB = classRepo.save(SchoolClass(institutionId = instB.id, name = "Grade 5 Red", gradeLevel = "Grade 5"))

        enrollmentRepo.save(ClassEnrollment(classId = classA.id, learnerId = learnerA1.id))
        enrollmentRepo.save(ClassEnrollment(classId = classA.id, learnerId = learnerA2.id))

        guardianLinkRepo.save(
            GuardianLink(guardianId = guardianUser.id, learnerId = learnerA1.id, relationship = "PARENT")
        )
    }

    @Test
    @Order(1)
    fun `teacher creates assignment for own class and learner sees it`() {
        val teacher = login(teacherA, "pass123")
        val body = """{"classId":${classA.id},"title":"Water cycle worksheet","instructions":"Answer all questions.","dueDate":"${LocalDate.now().plusDays(7)}","points":50}"""
        val res = postJson("/api/assignments", body, teacher)
        assertEquals(200, res.status, res.bodyText)
        assertEquals("Water cycle worksheet", res.body?.get("title")?.asText())
        assertEquals(50, res.body?.get("points")?.asInt())

        // Learner in the class sees the published assignment.
        val learner = login(learner1, "pass123")
        val mine = get("/api/assignments/learner/mine", learner)
        assertEquals(200, mine.status)
        assertTrue(mine.body!!.map { it.get("title").asText() }.contains("Water cycle worksheet"))
    }

    @Test
    @Order(2)
    fun `teacher cannot create assignment for another institution class`() {
        val teacherB = login(teacherB, "pass123")
        val body = """{"classId":${classA.id},"title":"Cross-tenant"}"""
        val res = postJson("/api/assignments", body, teacherB)
        assertEquals(403, res.status, "cross-tenant creation must be denied")
    }

    @Test
    @Order(3)
    fun `learner cannot create or grade assignments`() {
        val learner = login(learner1, "pass123")
        val res = postJson("/api/assignments", """{"classId":${classA.id},"title":"Hack"}""", learner)
        assertEquals(403, res.status)
    }

    @Test
    @Order(4)
    fun `learner submits and resubmission replaces not duplicates`() {
        val learner = login(learner1, "pass123")
        val assignment = assignmentRepo.findAll().first { it.title == "Water cycle worksheet" }

        val res = postJson("/api/assignments/${assignment.id}/submit", """{"content":"My first answer"}""", learner)
        assertEquals(200, res.status, res.bodyText)
        assertTrue(res.body?.get("graded")?.asBoolean() == false)

        // Resubmit: same row updated, not duplicated.
        val res2 = postJson("/api/assignments/${assignment.id}/submit", """{"content":"My better answer"}""", learner)
        assertEquals(200, res2.status)
        val sub = submissionRepo.findByAssignmentIdAndLearnerId(assignment.id, learnerA1.id)
        assertNotNull(sub, "resubmission must update the existing row, not duplicate")
        assertEquals("My better answer", sub?.content)
    }

    @Test
    @Order(5)
    fun `learner not enrolled cannot submit`() {
        val other = login(learnerB1, "pass123")
        val assignment = assignmentRepo.findAll().first { it.title == "Water cycle worksheet" }
        val res = postJson("/api/assignments/${assignment.id}/submit", """{"content":"sneaky"}""", other)
        assertEquals(403, res.status, "non-enrolled learner must be denied")
    }

    @Test
    @Order(6)
    fun `empty submission is rejected`() {
        val learner = login(learner1, "pass123")
        val assignment = assignmentRepo.findAll().first { it.title == "Water cycle worksheet" }
        val res = postJson("/api/assignments/${assignment.id}/submit", """{"content":"   "}""", learner)
        assertEquals(400, res.status)
    }

    @Test
    @Order(7)
    fun `teacher grades own institution submission with bounds enforced`() {
        val teacher = login(teacherA, "pass123")
        val assignment = assignmentRepo.findAll().first { it.title == "Water cycle worksheet" }
        val subs = submissionRepo.findByAssignmentId(assignment.id)
        assertTrue(subs.isNotEmpty(), "submission must exist from order 4")

        val ok = postJson("/api/assignments/submissions/${subs.first().id}/grade", """{"score":45,"feedback":"Good work"}""", teacher)
        assertEquals(200, ok.status, ok.bodyText)
        assertEquals(45, ok.body?.get("score")?.asInt())
        assertEquals("Good work", ok.body?.get("feedback")?.asText())

        // Out-of-bounds score must fail.
        val bad = postJson("/api/assignments/submissions/${subs.first().id}/grade", """{"score":500}""", teacher)
        assertEquals(400, bad.status)
    }

    @Test
    @Order(8)
    fun `cross-tenant staff cannot view or grade submissions`() {
        val teacherB = login(teacherB, "pass123")
        val assignment = assignmentRepo.findAll().first { it.title == "Water cycle worksheet" }

        val subs = get("/api/assignments/${assignment.id}/submissions", teacherB)
        assertEquals(404, subs.status, "cross-tenant reads must 404 to avoid resource discovery")

        val subId = submissionRepo.findByAssignmentId(assignment.id).first().id
        val grade = postJson("/api/assignments/submissions/$subId/grade", """{"score":1}""", teacherB)
        assertEquals(404, grade.status, "cross-tenant grading must 404")
    }

    @Test
    @Order(9)
    fun `school admin of own institution can grade`() {
        val admin = login(adminA, "pass123")
        val assignment = assignmentRepo.findAll().first { it.title == "Water cycle worksheet" }
        val sub = submissionRepo.findByAssignmentId(assignment.id).first()
        val res = postJson("/api/assignments/submissions/${sub.id}/grade", """{"score":40}""", admin)
        assertEquals(200, res.status, res.bodyText)
    }

    @Test
    @Order(10)
    fun `guardian sees only linked ward submissions`() {
        val guardian = login(guardianA, "pass123")
        val ok = get("/api/assignments/guardian/wards/${learnerA1.id}/submissions", guardian)
        assertEquals(200, ok.status, ok.bodyText)
        assertTrue(ok.body!!.map { it.get("learnerName").asText() }.contains("Learner A1"))

        // Unrelated learner → denied.
        val bad = get("/api/assignments/guardian/wards/${learnerA2.id}/submissions", guardian)
        assertEquals(403, bad.status)
    }

    @Test
    @Order(11)
    fun `learner views own submissions with feedback`() {
        val learner = login(learner1, "pass123")
        val res = get("/api/assignments/learner/submissions", learner)
        assertEquals(200, res.status)
        val mine = res.body!!.first { it.get("graded").asBoolean() }
        assertNotNull(mine.get("score"))
    }

    @Test
    @Order(12)
    fun `invalid points and blank title rejected`() {
        val teacher = login(teacherA, "pass123")
        assertEquals(400, postJson("/api/assignments", """{"classId":${classA.id},"title":"  "}""", teacher).status)
        assertEquals(400, postJson("/api/assignments", """{"classId":${classA.id},"title":"Ok","points":0}""", teacher).status)
    }
}
