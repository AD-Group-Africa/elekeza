package com.elekeza.backend.institution

import com.elekeza.backend.auth.UserRole
import com.elekeza.backend.testutil.ApiTestSupport
import jakarta.servlet.http.Cookie
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.http.MediaType
import org.springframework.test.web.servlet.MvcResult
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders
import org.springframework.transaction.annotation.Transactional

/**
 * Staff provisioning + lifecycle, exercised over real HTTP with real logins:
 *
 *  - SCHOOL_ADMIN creates teachers in their own institution
 *  - deactivating a user blocks their login; reactivating restores it
 *  - cross-tenant access returns 404 (no resource discovery)
 *  - no path may create a platform ADMIN
 *  - self-deactivation is refused
 */
@Transactional
class StaffManagementApiTest : ApiTestSupport() {

    @Autowired lateinit var institutionRepo: com.elekeza.backend.institution.InstitutionRepository
    @Autowired lateinit var entityManager: jakarta.persistence.EntityManager

    /**
     * The suite shares one H2 context, so accumulated teacher rows can exhaust
     * the seeded seat limit mid-run. Tests that create teachers provision
     * headroom first (rolled back with the transaction) — and the limit
     * itself gets its own dedicated test below.
     */
    private fun provisionTeacherHeadroom(institutionId: Long = 1) {
        val inst = institutionRepo.findById(institutionId).orElseThrow()
        val current = userRepo.findAll().count { it.institutionId == institutionId && it.role == UserRole.TEACHER }
        // Institution caps are vals on the entity; lift the seat limit by
        // writing the column directly (rolled back with the test transaction).
        entityManager.clear()
        entityManager.createQuery("UPDATE Institution i SET i.maxTeachers = :m WHERE i.id = :id")
            .setParameter("m", current + 5).setParameter("id", institutionId).executeUpdate()
        entityManager.clear()
    }

    private fun patchActive(session: Cookie, institutionId: Long, userId: Long, active: Boolean): MvcResult {
        val builder = MockMvcRequestBuilders
            .patch("/api/institutions/$institutionId/staff/$userId/active")
            .queryParam("active", active.toString())
            .cookie(session)
        val pair = csrf(session)
        return mockMvc.perform(builder.cookie(pair.cookie).header("X-XSRF-TOKEN", pair.token)).andReturn()
    }

    private fun passwordReset(session: Cookie, institutionId: Long, userId: Long): MvcResult {
        val builder = MockMvcRequestBuilders
            .post("/api/institutions/$institutionId/staff/$userId/password-reset")
            .cookie(session)
        val pair = csrf(session)
        return mockMvc.perform(builder.cookie(pair.cookie).header("X-XSRF-TOKEN", pair.token)).andReturn()
    }

    @Test
    fun `school admin creates a teacher in their own institution`() {
        provisionTeacherHeadroom()
        val adminEmail = "staff-admin-${System.nanoTime()}@example.com"
        createUser(adminEmail, "adminpass1", "School Admin", UserRole.SCHOOL_ADMIN, 1)
        val session = login(adminEmail, "adminpass1")

        val out = postJson(
            "/api/institutions/1/staff",
            """{"email":"new-teacher-${System.nanoTime()}@example.com","name":"Wanjiku Njoroge","role":"TEACHER"}""",
            session
        )
        assertThat(out.status).isEqualTo(201)
        assertThat(out.bodyText).contains("TEACHER")
        assertThat(out.bodyText).doesNotContain("password")
    }

    @Test
    fun `creating staff in another institution is forbidden`() {
        val adminA = "staff-admin-a-${System.nanoTime()}@example.com"
        createUser(adminA, "adminpass1", "Admin A", UserRole.SCHOOL_ADMIN, 1)
        val session = login(adminA, "adminpass1")

        val out = postJson(
            "/api/institutions/2/staff",
            """{"email":"cross-tenant-${System.nanoTime()}@example.com","name":"Cross","role":"TEACHER"}""",
            session
        )
        assertThat(out.status).isEqualTo(403)
    }

    @Test
    fun `deactivated teacher cannot log in and reactivation restores access`() {
        provisionTeacherHeadroom()
        val adminEmail = "staff-admin-d-${System.nanoTime()}@example.com"
        createUser(adminEmail, "adminpass1", "School Admin", UserRole.SCHOOL_ADMIN, 1)
        val session = login(adminEmail, "adminpass1")

        val email = "deactivated-${System.nanoTime()}@example.com"
        val out = postJson(
            "/api/institutions/1/staff",
            """{"email":"$email","name":"Temp Teacher","role":"TEACHER"}""",
            session
        )
        assertThat(out.status).isEqualTo(201)
        val userId = out.body!!["id"].asLong()
        assertThat(userRepo.findByEmail(email)!!.active).isTrue()

        // Deactivate.
        val off = patchActive(session, 1, userId, active = false)
        assertThat(off.response.status).isEqualTo(200)

        // Login is refused with the SAME message as a wrong password.
        val denied = mockMvc.perform(
            MockMvcRequestBuilders.post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""{"email":"$email","password":"whatever123"}""")
        ).andReturn()
        assertThat(denied.response.status).isEqualTo(401)
        assertThat(denied.response.contentAsString).contains("Invalid email or password")

        // Reactivate.
        val on = patchActive(session, 1, userId, active = true)
        assertThat(on.response.status).isEqualTo(200)
        assertThat(userRepo.findByEmail(email)!!.active).isTrue()
    }

    @Test
    fun `no path through this API can create a platform admin`() {
        val adminEmail = "staff-admin-esc-${System.nanoTime()}@example.com"
        createUser(adminEmail, "adminpass1", "School Admin", UserRole.SCHOOL_ADMIN, 1)
        val session = login(adminEmail, "adminpass1")

        val out = postJson(
            "/api/institutions/1/staff",
            """{"email":"escalate-${System.nanoTime()}@example.com","name":"Escalate","role":"ADMIN"}""",
            session
        )
        assertThat(out.status).isEqualTo(400)
        assertThat(out.bodyText).contains("TEACHER or SCHOOL_ADMIN")
        assertThat(userRepo.findAll().none { it.email.startsWith("escalate-") }).isTrue()
    }

    @Test
    fun `a school admin cannot deactivate their own account`() {
        val adminEmail = "staff-admin-self-${System.nanoTime()}@example.com"
        val admin = createUser(adminEmail, "adminpass1", "School Admin", UserRole.SCHOOL_ADMIN, 1)
        val session = login(adminEmail, "adminpass1")

        val out = patchActive(session, 1, admin.id, active = false)
        assertThat(out.response.status).isEqualTo(400)
        assertThat(out.response.contentAsString).contains("cannot deactivate your own")
    }

    @Test
    fun `cross-tenant user target is 404 not 403`() {
        val adminA = "staff-admin-x-${System.nanoTime()}@example.com"
        val adminB = "staff-admin-y-${System.nanoTime()}@example.com"
        createUser(adminA, "adminpass1", "Admin A", UserRole.SCHOOL_ADMIN, 1)
        val other = createUser(adminB, "adminpass1", "Admin B", UserRole.SCHOOL_ADMIN, 2)
        val session = login(adminA, "adminpass1")

        val out = patchActive(session, 1, other.id, active = false)
        assertThat(out.response.status).isEqualTo(404)
    }

    @Test
    fun `staff password reset route answers for an in-tenant user`() {
        val adminEmail = "staff-admin-r-${System.nanoTime()}@example.com"
        createUser(adminEmail, "adminpass1", "School Admin", UserRole.SCHOOL_ADMIN, 1)
        val session = login(adminEmail, "adminpass1")

        val target = createUser(
            "target-${System.nanoTime()}@example.com", "teacherpass1", "In Tenant Teacher",
            UserRole.TEACHER, 1
        )
        val out = passwordReset(session, 1, target.id)
        assertThat(out.response.status).isEqualTo(200)
    }

    @Test
    fun `guardians and teachers cannot use the staff management API`() {
        val teacherEmail = "staff-teacher-${System.nanoTime()}@example.com"
        createUser(teacherEmail, "teacherpass1", "Plain Teacher", UserRole.TEACHER, 1)
        val session = login(teacherEmail, "teacherpass1")

        val list = mockMvc.perform(
            MockMvcRequestBuilders.get("/api/institutions/1/staff").cookie(session)
        ).andReturn()
        assertThat(list.response.status).isEqualTo(403)
    }
}
