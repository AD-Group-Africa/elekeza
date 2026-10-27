package com.elekeza.backend.governance

import com.elekeza.backend.auth.RefreshTokenRepository
import com.elekeza.backend.auth.UserRole
import com.elekeza.backend.institution.Institution
import com.elekeza.backend.institution.InstitutionRepository
import com.elekeza.backend.testutil.ApiTestSupport
import jakarta.servlet.http.Cookie
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post

/**
 * HTTP-level regression suite for the 2026-10-15 governance-audit fixes.
 * It locks in, through the real filter chain (JWT filter + security config +
 * CSRF + real cookie login):
 *
 *  - T10/P0: a suspended account's existing access cookie stops working and
 *    the refresh leg no longer mints tokens (JwtAuthFilter + AuthController).
 *    The suspension is performed through the real staff-management API by a
 *    SCHOOL_ADMIN, exactly as in production. A control account proves the
 *    401 is attributable to suspension, not token damage.
 *  - T4/P1: /api/analytics/admin stays institution-scoped for SCHOOL_ADMIN
 *    and platform-wide only for ADMIN; /admin/overview stays ADMIN-only.
 *  - Baseline: unauthenticated privileged access is 401, wrong-role access
 *    is 403.
 *
 * All fixtures are throwaway in-memory users on the dev H2 profile; nothing
 * here touches production data or providers.
 */
class GovernanceRegressionTest : ApiTestSupport() {

    @Autowired lateinit var refreshTokenRepository: RefreshTokenRepository
    @Autowired lateinit var institutionRepository: InstitutionRepository

    private val suspendEmail = "gov-suspend-reg@example.com"
    private val controlEmail = "gov-suspend-control-reg@example.com"
    private val schoolAdminEmail = "gov-schooladmin-reg@example.com"
    private val otherSchoolEmail = "gov-other-school-reg@example.com"
    private val adminEmail = "gov-admin-reg@example.com"
    private val teacherEmail = "gov-teacher-reg@example.com"

    @AfterEach
    fun cleanUp() {
        // Refresh tokens are FK-linked to users; revoke them before deleting.
        // Never leave a deactivated fixture or a test institution behind.
        listOf(suspendEmail, controlEmail, schoolAdminEmail, otherSchoolEmail, adminEmail, teacherEmail)
            .forEach { email ->
                userRepo.findByEmail(email)?.let { u ->
                    userRepo.save(u.also { it.active = true })
                    refreshTokenRepository.deleteByUser(u)
                    userRepo.delete(u)
                }
            }
        institutionRepository.findAll()
            .filter { it.name == "GovTest Academy" }
            .forEach { institutionRepository.delete(it) }
    }

    private fun loginBoth(email: String, password: String): Pair<Cookie, Cookie> {
        val res = mockMvc.perform(
            post("/api/auth/login")
                .contentType("application/json")
                .content("""{"email":"$email","password":"$password"}""")
        ).andReturn()
        val access = res.response.cookies.first { it.name == "elekeza_access" }
        val refresh = res.response.cookies.first { it.name == "elekeza_refresh" }
        return access to refresh
    }

    /** Real staff status change through the tenant-scoped SCHOOL_ADMIN API. */
    private fun setActiveStaff(adminAccess: Cookie, userId: Long, active: Boolean): Int {
        // CSRF dance is required for state-changing requests.
        val pair = csrf(adminAccess)
        val res = mockMvc.perform(
            patch("/api/institutions/1/staff/$userId/active")
                .queryParam("active", active.toString())
                .cookie(adminAccess, pair.cookie)
                .header("X-XSRF-TOKEN", pair.token)
        ).andReturn()
        return res.response.status
    }



    // ------------------------------------------------------------------
    // T10/P0: suspended account cannot reuse session or refresh.
    // ------------------------------------------------------------------
    @Test
    fun `suspended staff account loses existing session and refresh leg`() {
        createUser(schoolAdminEmail, "gov-pass-123", "Suspend Admin", UserRole.SCHOOL_ADMIN, institutionId = 1)
        val adminAccess = login(schoolAdminEmail, "gov-pass-123")

        val staff = createUser(suspendEmail, "gov-pass-123", "Suspend Fixture", UserRole.TEACHER, institutionId = 1)
        val (access, refresh) = loginBoth(suspendEmail, "gov-pass-123")

        // Sanity: active account works with this cookie (200).
        assertThat(get("/api/auth/me", access).status).isEqualTo(200)

        // Suspend in a separate request — exactly the live incident: the
        // access cookie was minted before the suspension happened.
        assertThat(setActiveStaff(adminAccess, staff.id, active = false)).isEqualTo(200)

        assertThat(get("/api/auth/me", access).status).isEqualTo(401)

        // Refresh must also refuse to mint new tokens for a suspended user.
        val refreshRes = postJson(
            "/api/auth/refresh", "{}",
            Cookie("elekeza_refresh", refresh.value), withCsrf = false
        )
        assertThat(refreshRes.status).isEqualTo(401)

        // Reactivate through the same API; the SAME cookie works again, so
        // the 401s above are attributable to suspension, not token damage.
        assertThat(setActiveStaff(adminAccess, staff.id, active = true)).isEqualTo(200)
        assertThat(get("/api/auth/me", access).status).isEqualTo(200)

        // Control account that was never suspended: same login path, 200.
        createUser(controlEmail, "gov-pass-123", "Suspend Control", UserRole.TEACHER, institutionId = 1)
        val (controlAccess, _) = loginBoth(controlEmail, "gov-pass-123")
        assertThat(get("/api/auth/me", controlAccess).status).isEqualTo(200)
    }

    // ------------------------------------------------------------------
    // T4/P1: analytics /admin is scoped by role.
    // ------------------------------------------------------------------
    @Test
    fun `school admin analytics are institution scoped while admin stays platform wide`() {
        createUser(schoolAdminEmail, "gov-pass-123", "Scoped School Admin", UserRole.SCHOOL_ADMIN, institutionId = 1)
        val schoolAdminAccess = login(schoolAdminEmail, "gov-pass-123")

        val scopedBefore = get("/api/analytics/admin", schoolAdminAccess)
        assertThat(scopedBefore.status).isEqualTo(200)

        // Create a SECOND institution, then a learner in it. This is what
        // makes the cross-institution leak detectable at all (the dev seed
        // ships only one school).
        val secondInstitution = institutionRepository.save(
            Institution(name = "GovTest Academy", county = "Test County", subCounty = "Test Sub-County")
        )
        val otherSchoolStudent = createUser(
            otherSchoolEmail, "gov-pass-123", "Other School Learner",
            UserRole.STUDENT, institutionId = secondInstitution.id
        )
        assertThat(otherSchoolStudent.institutionId).isEqualTo(secondInstitution.id)

        val scoped = get("/api/analytics/admin", schoolAdminAccess)
        assertThat(scoped.status).isEqualTo(200)
        // Institution-scoped: exactly the learners of institution 1, and
        // institution count 1 — the other school's learner does not leak in.
        assertThat(scoped.body!!["totalLearners"].asLong())
            .isEqualTo(userRepo.findAll().count { it.role == UserRole.STUDENT && it.institutionId == 1L }.toLong())
        assertThat(scoped.body!!["totalInstitutions"].asInt()).isEqualTo(1)

        // Platform ADMIN (own institution also set) still sees EVERYTHING.
        createUser(adminEmail, "gov-pass-123", "Platform Admin Fixture", UserRole.ADMIN, institutionId = 1)
        val platformAdminAccess = login(adminEmail, "gov-pass-123")
        val platformWide = get("/api/analytics/admin", platformAdminAccess)
        assertThat(platformWide.status).isEqualTo(200)
        // Platform-wide counts equal the full repository (including the new
        // institution — a scoped PRESCHOOL view would not).
        assertThat(platformWide.body!!["totalLearners"].asLong())
            .isEqualTo(userRepo.findAll().count { it.role == UserRole.STUDENT }.toLong())
        assertThat(platformWide.body!!["totalInstitutions"].asInt())
            .isEqualTo(institutionRepository.count().toInt())
        // The scoped admin's view is strictly narrower than the platform view.
        assertThat(scoped.body!!["totalLearners"].asLong())
            .isLessThan(platformWide.body!!["totalLearners"].asLong())
    }

    // ------------------------------------------------------------------
    // Overview stays ADMIN-only; unauthenticated/wrong-role restrictive.
    // ------------------------------------------------------------------
    @Test
    fun `analytics overview stays admin only and wrong role access is denied at the boundary`() {
        createUser(schoolAdminEmail, "gov-pass-123", "Scoped School Admin", UserRole.SCHOOL_ADMIN, institutionId = 1)
        createUser(teacherEmail, "gov-pass-123", "Scoped Teacher", UserRole.TEACHER, institutionId = 1)
        createUser(adminEmail, "gov-pass-123", "Platform Admin Fixture", UserRole.ADMIN, institutionId = 1)
        val schoolAdminAccess = login(schoolAdminEmail, "gov-pass-123")
        val platformAdminAccess = login(adminEmail, "gov-pass-123")
        val teacherAccess = login(teacherEmail, "gov-pass-123")

        // SCHOOL_ADMIN passes the URL rule but must fail method-level ADMIN.
        assertThat(get("/api/analytics/admin/overview", schoolAdminAccess).status).isEqualTo(403)
        assertThat(get("/api/analytics/admin/overview", platformAdminAccess).status).isEqualTo(200)

        // Unauthenticated privileged access: structured 401, never data.
        val unauth = get("/api/analytics/admin", null)
        assertThat(unauth.status).isEqualTo(401)
        assertThat(unauth.body!!["code"].asText()).isEqualTo("AUTH_REQUIRED")

        // Wrong role against a privileged endpoint: structured 403.
        val teacherDenied = get("/api/analytics/admin", teacherAccess)
        assertThat(teacherDenied.status).isEqualTo(403)
        assertThat(teacherDenied.body!!["code"].asText()).isEqualTo("ACCESS_DENIED")
    }
}
