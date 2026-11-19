package com.elekeza.backend.calendar

import com.elekeza.backend.auth.User
import com.elekeza.backend.auth.UserRole
import com.elekeza.backend.institution.Institution
import com.elekeza.backend.institution.InstitutionRepository
import com.elekeza.backend.testutil.ApiTestSupport
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.transaction.annotation.Transactional
import java.time.Instant

/**
 * Sprint 3 authorization regression: /api/deadlines previously accepted
 * caller-supplied scope/target without validation, so a SCHOOL_ADMIN or
 * TEACHER could mint NATIONAL/REGIONAL rows, park institution-scoped rows on
 * another tenant's institution, or aim an INDIVIDUAL deadline at any user.
 *
 * Policy encoded here (documented in DeadlineController.create):
 *  - NATIONAL/REGIONAL: ADMIN only (no governance policy grants schools
 *    ministry-scale publishing rights; no region model exists yet — regional
 *    follows national-public visibility as the unresolved-but-safe default).
 *  - INSTITUTION: own institution only for SCHOOL_ADMIN/TEACHER; global ADMIN
 *    must name an existing institution.
 *  - INDIVIDUAL: real target required; self or same-institution only
 *    (ADMIN may target anyone).
 *  - CLASS: rejected — the Deadline entity has no class target model.
 * All tests roll back (@Transactional); no cleanup touches shared data.
 */
@Transactional
class DeadlineAuthorizationTest : ApiTestSupport() {

    @Autowired lateinit var deadlineRepo: DeadlineRepository
    @Autowired lateinit var institutionRepo: InstitutionRepository

    private lateinit var instA: Institution
    private lateinit var instB: Institution
    private lateinit var adminA: User
    private lateinit var teacherA: User
    private lateinit var teacherB: User
    private lateinit var studentA: User
    private lateinit var studentB: User
    private lateinit var globalAdmin: User

    private fun seed() {
        instA = institutionRepo.save(Institution(name = "Deadline Auth Academy A ${System.nanoTime()}"))
        instB = institutionRepo.save(Institution(name = "Deadline Auth Academy B ${System.nanoTime()}"))
        adminA = createUser("dl-admin-${System.nanoTime()}@t.local", ADMIN_PASS, "Admin A", UserRole.SCHOOL_ADMIN, instA.id)
        teacherA = createUser("dl-tea-${System.nanoTime()}@t.local", TEACHER_PASS, "Teacher A", UserRole.TEACHER, instA.id)
        teacherB = createUser("dl-tea-${System.nanoTime()}@t.local", TEACHER_PASS, "Teacher B", UserRole.TEACHER, instB.id)
        studentA = createUser("dl-stu-${System.nanoTime()}@t.local", LEARNER_PASS, "Student A", UserRole.STUDENT, instA.id)
        studentB = createUser("dl-stu-${System.nanoTime()}@t.local", LEARNER_PASS, "Student B", UserRole.STUDENT, instB.id)
        globalAdmin = createUser("dl-gadm-${System.nanoTime()}@t.local", ADMIN_PASS, "Global Admin", UserRole.ADMIN, null)
    }

    private fun createdAt(title: String, scope: DeadlineScope, extra: String = ""): String {
        require(extra.isBlank() || extra.startsWith(",")) { "extra must start with a comma" }
        val type = if (scope == DeadlineScope.REGIONAL) "SCHOOL_EVENT" else "EXAM"
        return "{\"title\":\"$title\",\"deadlineType\":\"$type\",\"scope\":\"$scope\",\"dueAt\":\"2026-12-01T10:00:00Z\"$extra}"
    }

    private fun sess(user: User) = login(user.email, when (user.role) {
        UserRole.STUDENT -> LEARNER_PASS
        UserRole.TEACHER -> TEACHER_PASS
        else -> ADMIN_PASS
    })

    private fun adminGlobalSession() = login(globalAdmin.email, ADMIN_PASS)

    @Test
    fun `school admin cannot create institution deadline for another institution`() {
        seed()
        val out = postJson("/api/deadlines", createdAt("Cross Tenant Exam", DeadlineScope.INSTITUTION, ",\"institutionId\":${instB.id}"), sess(adminA))
        assertThat(out.status).isEqualTo(403)
        // The write never happened — client-supplied IDs are not authorization.
        assertThat(deadlineRepo.findAll().none { it.title == "Cross Tenant Exam" }).isTrue()
    }

    @Test
    fun `school admin can create institution deadline for own institution`() {
        seed()
        val out = postJson("/api/deadlines", createdAt("Own Inst Exam", DeadlineScope.INSTITUTION), sess(adminA))
        assertThat(out.status).isEqualTo(200)
        val stored = deadlineRepo.findAll().first { it.title == "Own Inst Exam" }
        // Omitting institutionId defaults to the actor's own institution.
        assertThat(stored.institutionId).isEqualTo(instA.id)
    }

    @Test
    fun `teacher cannot create national or regional deadlines, admin can`() {
        seed()
        val teacherSession = sess(teacherA)
        assertThat(postJson("/api/deadlines", createdAt("Teacher National", DeadlineScope.NATIONAL), teacherSession).status).isEqualTo(403)
        assertThat(postJson("/api/deadlines", createdAt("Teacher Regional", DeadlineScope.REGIONAL), teacherSession).status).isEqualTo(403)
        assertThat(deadlineRepo.findAll().none { it.title.startsWith("Teacher ") }).isTrue()

        val adminSession = adminGlobalSession()
        assertThat(postJson("/api/deadlines", createdAt("National Mock Exam", DeadlineScope.NATIONAL), adminSession).status).isEqualTo(200)
        assertThat(postJson("/api/deadlines", createdAt("Regional Science Fair", DeadlineScope.REGIONAL), adminSession).status).isEqualTo(200)
    }

    @Test
    fun `admin institution-scoped creation works for a named and existing institution`() {
        seed()
        val adminSession = adminGlobalSession()
        assertThat(postJson("/api/deadlines", createdAt("Admin Inst Exam", DeadlineScope.INSTITUTION, ",\"institutionId\":${instA.id}"), adminSession).status).isEqualTo(200)
        // A nonexistent institution is 404, not a silent orphan row.
        assertThat(postJson("/api/deadlines", createdAt("Admin Phantom", DeadlineScope.INSTITUTION, ",\"institutionId\":99999999"), adminSession).status).isEqualTo(404)
    }

    @Test
    fun `teacher cannot target an individual deadline at another institution's user`() {
        seed()
        val out = postJson("/api/deadlines", createdAt("Student B Individual", DeadlineScope.INDIVIDUAL, ",\"userId\":${studentB.id}"), sess(teacherA))
        assertThat(out.status).isEqualTo(403)
        assertThat(deadlineRepo.findAll().none { it.title == "Student B Individual" }).isTrue()
    }

    @Test
    fun `individual deadline requires a real aligned target`() {
        seed()
        val session = sess(teacherA)
        // Missing target.
        assertThat(postJson("/api/deadlines", createdAt("No Target", DeadlineScope.INDIVIDUAL), session).status).isEqualTo(400)
        // Nonexistent target.
        assertThat(postJson("/api/deadlines", createdAt("Ghost Target", DeadlineScope.INDIVIDUAL, ",\"userId\":99999999"), session).status).isEqualTo(404)
        // Inconsistent scope/target combination.
        assertThat(postJson("/api/deadlines",
            "{\"title\":\"Both Targets\",\"deadlineType\":\"EXAM\",\"scope\":\"INDIVIDUAL\",\"dueAt\":\"2026-12-01T10:00:00Z\",\"userId\":${studentA.id},\"institutionId\":${instA.id}}",
            session).status).isEqualTo(400)
    }

    @Test
    fun `invalid dueAt and blank title are rejected as 400`() {
        seed()
        val session = sess(teacherA)
        assertThat(postJson("/api/deadlines",
            "{\"title\":\"Bad Date\",\"deadlineType\":\"EXAM\",\"dueAt\":\"not-a-date\"}", session).status).isEqualTo(400)
        assertThat(postJson("/api/deadlines",
            "{\"title\":\"   \",\"deadlineType\":\"EXAM\",\"dueAt\":\"2026-12-01T10:00:00Z\"}", session).status).isEqualTo(400)
        // CLASS scope has no target model — rejected, never silently stored.
        assertThat(postJson("/api/deadlines", createdAt("Class Dead End", DeadlineScope.CLASS), session).status).isEqualTo(400)
    }

    @Test
    fun `individual deadlines are visible only to their target user`() {
        seed()
        val title = "Targeted Mock ${System.nanoTime()}"
        assertThat(postJson("/api/deadlines",
            "{\"title\":\"$title\",\"deadlineType\":\"EXAM\",\"scope\":\"INDIVIDUAL\",\"dueAt\":\"2026-12-01T10:00:00Z\",\"userId\":${studentA.id}}",
            adminGlobalSession()).status).isEqualTo(200)

        assertThat(get("/api/deadlines", sess(studentA)).bodyText).contains(title)
        assertThat(get("/api/deadlines", sess(studentB)).bodyText).doesNotContain(title)
        // Sharing the school does not expose another user's individual deadline.
        assertThat(get("/api/deadlines", sess(teacherA)).bodyText).doesNotContain(title)
    }

    @Test
    fun `national dates remain publicly visible across institutions`() {
        seed()
        val adminSession = adminGlobalSession()
        val national = "Cross School National ${System.nanoTime()}"
        val regional = "Cross School Regional ${System.nanoTime()}"
        assertThat(postJson("/api/deadlines", createdAt(national, DeadlineScope.NATIONAL), adminSession).status).isEqualTo(200)
        assertThat(postJson("/api/deadlines", createdAt(regional, DeadlineScope.REGIONAL), adminSession).status).isEqualTo(200)

        val viewer = get("/api/deadlines", sess(teacherB))
        assertThat(viewer.bodyText).contains(national)
        // Regional deadlines are not globally visible until a region model exists.
        assertThat(viewer.bodyText).doesNotContain(regional)
    }

    @Test
    fun `regional deadlines are visible only to admin`() {
        seed()
        val adminSession = adminGlobalSession()
        val regional = "Regional Deadline ${System.nanoTime()}"
        assertThat(postJson("/api/deadlines", createdAt(regional, DeadlineScope.REGIONAL), adminSession).status).isEqualTo(200)

        val teacherSession = sess(teacherA)
        val viewer = get("/api/deadlines", teacherSession)
        assertThat(viewer.bodyText).doesNotContain(regional)

        val adminGlobalSession = adminGlobalSession()
        val adminViewer = get("/api/deadlines", adminGlobalSession)
        assertThat(adminViewer.bodyText).contains(regional)
    }

    @Test
    fun `delete requires creator or admin`() {
        seed()
        val teacherSession = sess(teacherA)
        val own = postJson("/api/deadlines", createdAt("Delete Mine", DeadlineScope.INSTITUTION), teacherSession)
        assertThat(own.status).isEqualTo(200)
        val ownId = own.body!!["id"].asLong()

        // Creator deletes their own row.
        val del = delete("/api/deadlines/$ownId", teacherSession)
        assertThat(del.status).isEqualTo(200)
        assertThat(del.body!!["success"].asBoolean()).isTrue()

        // A colleague at the same institution cannot delete someone else's row.
        val others = deadlineRepo.save(Deadline(
            title = "Not Mine ${System.nanoTime()}", deadlineType = DeadlineType.EXAM,
            scope = DeadlineScope.INSTITUTION, dueAt = Instant.parse("2026-12-01T10:00:00Z"),
            institutionId = instA.id, createdBy = adminA.id))
        val stranger = delete("/api/deadlines/${others.id}", teacherSession)
        assertThat(stranger.status).isEqualTo(403)
        assertThat(deadlineRepo.findById(others.id).orElse(null)).isNotNull()

        // ADMIN can delete any row.
        val adminDel = delete("/api/deadlines/${others.id}", adminGlobalSession())
        assertThat(adminDel.status).isEqualTo(200)
        assertThat(adminDel.body!!["success"].asBoolean()).isTrue()
    }

    companion object {
        private const val ADMIN_PASS = "adminpass1"
        private const val TEACHER_PASS = "teacherpass1"
        private const val LEARNER_PASS = "learnerpass1"
    }
}
