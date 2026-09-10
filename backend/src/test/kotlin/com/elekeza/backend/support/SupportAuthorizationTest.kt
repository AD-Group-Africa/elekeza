package com.elekeza.backend.support

import com.elekeza.backend.auth.User
import com.elekeza.backend.auth.UserRepository
import com.elekeza.backend.auth.UserRole
import org.assertj.core.api.Assertions.assertThat
import org.assertj.core.api.Assertions.assertThatThrownBy
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.web.server.ResponseStatusException
import java.time.LocalDate

/**
 * Institution-boundary regression tests for the support module.
 *
 * A teacher must never be able to read or act on another institution's
 * learner signals or interventions. These tests reproduce the original
 * defects (unscoped listInterventions, acknowledge/dismiss, createIntervention)
 * and prove the fixes hold.
 */
@SpringBootTest(
    properties = [
        "spring.profiles.active=dev",
        "ai.client.type=mock",
        "ai.internal-secret=test-internal-secret",
        // Tests are authored against the dev profile's in-memory H2 demo seed.
        // Pin the datasource explicitly so ambient SPRING_DATASOURCE_* env vars
        // (e.g. GitLab CI's Postgres service) cannot redirect the context.
        "spring.datasource.url=jdbc:h2:mem:elekeza;DB_CLOSE_DELAY=-1;MODE=PostgreSQL",
        "spring.datasource.username=sa",
        "spring.datasource.password=",
    ]
)
class SupportAuthorizationTest {

    @Autowired lateinit var userRepo: UserRepository
    @Autowired lateinit var flagRepo: SupportFlagRepository
    @Autowired lateinit var interventionRepo: InterventionRepository
    @Autowired lateinit var institutionRepo: com.elekeza.backend.institution.InstitutionRepository
    @Autowired lateinit var service: SupportService

    private lateinit var teacherA: User   // Demo Academy (institution 1)
    private lateinit var studentA: User   // Demo Academy (institution 1)
    private lateinit var teacherB: User   // rival institution
    private lateinit var studentB: User   // rival institution

    @BeforeEach
    fun setUp() {
        teacherA = userRepo.findByEmail("teacher@elekeza.app")!!
        studentA = userRepo.findByEmail("student@elekeza.app")!!

        // Create a second institution so cross-institution access is testable.
        val institutionB = institutionRepo.save(com.elekeza.backend.institution.Institution(
            name = "Rival Academy",
            type = "SCHOOL",
            subCounty = "Rift",
            county = "Nakuru",
            plan = "STARTER",
            maxStudents = 100,
            maxTeachers = 10,
            contactEmail = "rival@example.com",
            isActive = true,
        ))

        teacherB = userRepo.save(User(
            email = "teacherB@example.com", password = "x", name = "Teacher B",
            role = UserRole.TEACHER, institutionId = institutionB.id,
        ))
        studentB = userRepo.save(User(
            email = "studentB@example.com", password = "x", name = "Student B",
            role = UserRole.STUDENT, institutionId = institutionB.id,
        ))
    }

    @AfterEach
    fun tearDown() {
        // Emails are UNIQUE — remove created rows so each test method starts
        // from the same clean state.
        val studentBId = userRepo.findByEmail("studentB@example.com")?.id
        if (studentBId != null) {
            listOf(SignalStatus.OPEN, SignalStatus.ACKNOWLEDGED, SignalStatus.DISMISSED).forEach { status ->
                flagRepo.findByLearnerIdInAndStatusOrderByCreatedAtDesc(setOf(studentBId), status)
                    .forEach { flagRepo.delete(it) }
            }
            interventionRepo.findByLearnerIdInOrderByCreatedAtDesc(setOf(studentBId)).forEach { interventionRepo.delete(it) }
        }
        // Remove interventions/flags created for the demo student during tests.
        interventionRepo.findByLearnerIdInOrderByCreatedAtDesc(setOf(studentA.id)).forEach { interventionRepo.delete(it) }
        listOf(SignalStatus.OPEN, SignalStatus.ACKNOWLEDGED, SignalStatus.DISMISSED).forEach { status ->
            flagRepo.findByLearnerIdInAndStatusOrderByCreatedAtDesc(setOf(studentA.id), status)
                .forEach { flagRepo.delete(it) }
        }
        userRepo.findByEmail("teacherB@example.com")?.let { userRepo.delete(it) }
        userRepo.findByEmail("studentB@example.com")?.let { userRepo.delete(it) }
        institutionRepo.findAll().filter { it.name == "Rival Academy" }.forEach { institutionRepo.delete(it) }
    }

    private fun flagFor(studentId: Long, teacherId: Long): SupportFlag =
        flagRepo.save(SupportFlag(
            learnerId = studentId,
            teacherId = teacherId,
            signalType = SignalType.LOW_PERFORMANCE,
            status = SignalStatus.OPEN,
            reasons = "Test signal",
        ))

    // ── Cross-institution list ──────────────────────────────────────────────

    @Test
    fun `teacher cannot list another institution's interventions by learner id`() {
        interventionRepo.save(Intervention(
            learnerId = studentB.id,
            teacherId = teacherB.id,
            type = InterventionType.EXTRA_PRACTICE,
            target = "private target",
            startDate = LocalDate.now(),
        ))

        // teacherA asks for studentB's interventions — must get nothing.
        val result = service.listInterventions(teacherA, studentB.id)
        assertThat(result).isEmpty()
    }

    @Test
    fun `teacher can list their own institution's interventions by learner id`() {
        interventionRepo.save(Intervention(
            learnerId = studentA.id,
            teacherId = teacherA.id,
            type = InterventionType.REVIEW_SESSION,
            target = "revision",
            startDate = LocalDate.now(),
        ))
        val result = service.listInterventions(teacherA, studentA.id)
        assertThat(result.map { it.target }).containsExactly("revision")
    }

    // ── Cross-institution acknowledge / dismiss ─────────────────────────────

    @Test
    fun `teacher cannot acknowledge another institution's signal`() {
        val flag = flagFor(studentB.id, teacherB.id)
        assertThat(service.acknowledge(flag.id, teacherA)).isFalse()
        assertThat(flagRepo.findById(flag.id).get().status).isEqualTo(SignalStatus.OPEN)
    }

    @Test
    fun `teacher cannot dismiss another institution's signal`() {
        val flag = flagFor(studentB.id, teacherB.id)
        assertThat(service.dismiss(flag.id, teacherA)).isFalse()
        assertThat(flagRepo.findById(flag.id).get().status).isEqualTo(SignalStatus.OPEN)
    }

    @Test
    fun `teacher can acknowledge their own institution's signal`() {
        val flag = flagFor(studentA.id, teacherA.id)
        assertThat(service.acknowledge(flag.id, teacherA)).isTrue()
        assertThat(flagRepo.findById(flag.id).get().status).isEqualTo(SignalStatus.ACKNOWLEDGED)
    }

    // ── Cross-institution intervention creation ─────────────────────────────

    @Test
    fun `teacher cannot create an intervention for another institution's learner`() {
        assertThatThrownBy {
            service.createIntervention(
                teacher = teacherA,
                learnerId = studentB.id,
                signalId = null,
                type = InterventionType.OTHER,
                target = "should not be created",
                startDate = LocalDate.now(),
                reviewDate = null,
            )
        }.isInstanceOf(ResponseStatusException::class.java)
            .hasMessageContaining("not found in your institution")

        assertThat(interventionRepo.findAll().none { it.target == "should not be created" }).isTrue()
    }

    @Test
    fun `teacher can create an intervention for their own institution's learner`() {
        val created = service.createIntervention(
            teacher = teacherA,
            learnerId = studentA.id,
            signalId = null,
            type = InterventionType.PEER_SUPPORT,
            target = "peer review",
            startDate = LocalDate.now(),
            reviewDate = LocalDate.now().plusWeeks(2),
        )
        assertThat(created.learnerId).isEqualTo(studentA.id)
        assertThat(created.status).isEqualTo(InterventionStatus.ACTIVE)
    }

    // ── Cross-institution outcome update ────────────────────────────────────

    @Test
    fun `teacher cannot update another institution's intervention outcome`() {
        val intervention = interventionRepo.save(Intervention(
            learnerId = studentB.id,
            teacherId = teacherB.id,
            type = InterventionType.PARENT_CONTACT,
            target = "phone call",
            startDate = LocalDate.now(),
        ))
        val updated = service.updateOutcome(teacherA, intervention.id, InterventionStatus.COMPLETED, "done")
        assertThat(updated).isNull()
        assertThat(interventionRepo.findById(intervention.id).get().status).isEqualTo(InterventionStatus.ACTIVE)
    }

    // ── Signals list scoping ────────────────────────────────────────────────

    @Test
    fun `teacher signal list only contains their own institution's learners`() {
        flagFor(studentA.id, teacherA.id)
        flagFor(studentB.id, teacherB.id)

        val view = service.findByLearnerIds(listOf(studentA.id), teacherA)
        assertThat(view.map { it.learnerId }).containsExactly(studentA.id)
    }
}
