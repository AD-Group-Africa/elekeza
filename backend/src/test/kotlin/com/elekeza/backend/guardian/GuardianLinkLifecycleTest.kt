package com.elekeza.backend.guardian

import com.elekeza.backend.auth.UserRole
import com.elekeza.backend.institution.GuardianLink
import com.elekeza.backend.institution.GuardianLinkRepository
import com.elekeza.backend.testutil.ApiTestSupport
import jakarta.servlet.http.Cookie
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.test.web.servlet.MvcResult
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders
import org.springframework.transaction.annotation.Transactional
import java.time.Instant
import java.time.temporal.ChronoUnit

/**
 * Guardian link lifecycle over real HTTP:
 *  - schools revoke and restore guardian↔learner links
 *  - temporary links carry an expiresAt
 *  - a revoked link immediately stops ward access (finance ward list)
 *  - cross-tenant targets are 404
 */
@Transactional
class GuardianLinkLifecycleTest : ApiTestSupport() {

    @Autowired lateinit var guardianLinkRepository: GuardianLinkRepository

    private fun csrfPost(session: Cookie, url: String): MvcResult {
        val builder = MockMvcRequestBuilders.post(url).cookie(session)
        val pair = csrf(session)
        return mockMvc.perform(builder.cookie(pair.cookie).header("X-XSRF-TOKEN", pair.token)).andReturn()
    }

    private fun linkPath(institutionId: Long, learnerId: Long, suffix: String) =
        "/api/institutions/$institutionId/learners/$learnerId/guardian-links/$suffix"

    @Test
    fun `revoking a guardian link removes ward access and restoring returns it`() {
        val adminEmail = "gl-admin-${System.nanoTime()}@example.com"
        createUser(adminEmail, "adminpass1", "Link Admin", UserRole.SCHOOL_ADMIN, 1)
        val session = login(adminEmail, "adminpass1")

        val guardian = createUser(
            "gl-guardian-${System.nanoTime()}@example.com", "guardianpass1", "Linked Guardian",
            UserRole.GUARDIAN, 1
        )
        val learner = createUser(
            "gl-learner-${System.nanoTime()}@example.com", "learnerpass1", "Linked Learner",
            UserRole.STUDENT, 1
        )
        guardianLinkRepository.save(
            GuardianLink(guardianId = guardian.id, learnerId = learner.id, relationship = "PARENT")
        )

        // Sanity: ward visible before revocation.
        val before = get("/api/guardian/wards", login(guardian.email, "guardianpass1"))
        assertThat(before.bodyText).contains(learner.name)

        // Revoke.
        val revoke = csrfPost(session, linkPath(1, learner.id, "${guardian.id}/revoke"))
        assertThat(revoke.response.status).isEqualTo(200)

        // Ward access gone.
        val after = get("/api/guardian/wards", login(guardian.email, "guardianpass1"))
        assertThat(after.bodyText).doesNotContain("\"name\":\"${learner.name}\"")

        // Restore.
        val restore = csrfPost(session, linkPath(1, learner.id, "${guardian.id}/restore"))
        assertThat(restore.response.status).isEqualTo(200)
        val restored = get("/api/guardian/wards", login(guardian.email, "guardianpass1"))
        assertThat(restored.bodyText).contains(learner.name)
    }

    @Test
    fun `temporary link expires at its expiresAt`() {
        val adminEmail = "gl-admin-t-${System.nanoTime()}@example.com"
        createUser(adminEmail, "adminpass1", "Temp Admin", UserRole.SCHOOL_ADMIN, 1)
        val session = login(adminEmail, "adminpass1")
        val guardian = createUser(
            "gl-temp-g-${System.nanoTime()}@example.com", "guardianpass1", "Temp Guardian",
            UserRole.GUARDIAN, 1
        )
        val learner = createUser(
            "gl-temp-l-${System.nanoTime()}@example.com", "learnerpass1", "Temp Learner",
            UserRole.STUDENT, 1
        )

        val future = Instant.now().plus(7, ChronoUnit.DAYS).toString()
        val grant = csrfPost(session, linkPath(1, learner.id, "${guardian.id}/temporary?expiresAt=$future"))
        assertThat(grant.response.status).isEqualTo(200)
        assertThat(grant.response.contentAsString).contains("expiresAt")

        val link = guardianLinkRepository.findByGuardianId(guardian.id).first()
        assertThat(link.currentlyActive()).isTrue()
        assertThat(link.expiresAt).isNotNull()
    }

    @Test
    fun `temporary grant in the past is rejected`() {
        val adminEmail = "gl-admin-p-${System.nanoTime()}@example.com"
        createUser(adminEmail, "adminpass1", "Past Admin", UserRole.SCHOOL_ADMIN, 1)
        val session = login(adminEmail, "adminpass1")
        val guardian = createUser(
            "gl-past-g-${System.nanoTime()}@example.com", "guardianpass1", "Past Guardian",
            UserRole.GUARDIAN, 1
        )
        val learner = createUser(
            "gl-past-l-${System.nanoTime()}@example.com", "learnerpass1", "Past Learner",
            UserRole.STUDENT, 1
        )

        val past = Instant.now().minus(1, ChronoUnit.DAYS).toString()
        val grant = csrfPost(session, linkPath(1, learner.id, "${guardian.id}/temporary?expiresAt=$past"))
        assertThat(grant.response.status).isEqualTo(400)
    }

    @Test
    fun `cross-tenant revoke is 404`() {
        val adminA = "gl-admin-x-${System.nanoTime()}@example.com"
        createUser(adminA, "adminpass1", "Tenant One Admin", UserRole.SCHOOL_ADMIN, 1)
        val session = login(adminA, "adminpass1")

        val guardianB = createUser(
            "gl-x-g-${System.nanoTime()}@example.com", "guardianpass1", "Tenant Two Guardian",
            UserRole.GUARDIAN, 2
        )
        val learnerB = createUser(
            "gl-x-l-${System.nanoTime()}@example.com", "learnerpass1", "Tenant Two Learner",
            UserRole.STUDENT, 2
        )
        guardianLinkRepository.save(
            GuardianLink(guardianId = guardianB.id, learnerId = learnerB.id, relationship = "PARENT")
        )

        val out = csrfPost(session, linkPath(1, learnerB.id, "${guardianB.id}/revoke"))
        assertThat(out.response.status).isEqualTo(404)
    }
}
