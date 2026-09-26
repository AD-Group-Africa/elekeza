package com.elekeza.backend.accessibility

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

/**
 * Accessibility profile behavior over real HTTP:
 *  - a learner reads/updates their own profile
 *  - teachers of the same institution can set a learner's profile
 *  - guardians can READ a linked ward's profile but never WRITE it
 *  - unlinked guardians and other tenants get 403/404
 *  - unknown keys and out-of-range values are rejected
 */
@Transactional
class AccessibilityProfileApiTest : ApiTestSupport() {

    @Autowired lateinit var guardianLinkRepository: GuardianLinkRepository

    private fun putProfile(session: Cookie, userId: Long, json: String): MvcResult {
        val builder = MockMvcRequestBuilders.put("/api/accessibility-profiles/$userId").cookie(session)
        val pair = csrf(session)
        return mockMvc.perform(
            builder.cookie(pair.cookie).header("X-XSRF-TOKEN", pair.token)
                .contentType("application/json").content(json)
        ).andReturn()
    }

    private fun getProfile(session: Cookie, userId: Long): MvcResult =
        mockMvc.perform(MockMvcRequestBuilders.get("/api/accessibility-profiles/$userId").cookie(session)).andReturn()

    @Test
    fun `learner updates and reads their own profile`() {
        val learnerEmail = "a11y-learner-${System.nanoTime()}@example.com"
        val learner = createUser(learnerEmail, "learnerpass1", "A11y Learner", UserRole.STUDENT, 1)
        val session = login(learnerEmail, "learnerpass1")

        val out = putProfile(
            session, learner.id,
            """{"settings":{"theme":"calm","textScale":1.4,"ttsEnabled":true,"ttsRate":0.9,"reducedMotion":true}}"""
        )
        assertThat(out.response.status).isEqualTo(200)
        assertThat(out.response.contentAsString).contains("calm")

        val read = getProfile(session, learner.id)
        assertThat(read.response.status).isEqualTo(200)
        assertThat(read.response.contentAsString).contains("ttsEnabled")
        assertThat(read.response.contentAsString).contains("ttsRate")
    }

    @Test
    fun `teacher of the same institution can set a learner profile`() {
        val teacherEmail = "a11y-teacher-${System.nanoTime()}@example.com"
        createUser(teacherEmail, "teacherpass1", "A11y Teacher", UserRole.TEACHER, 1)
        val session = login(teacherEmail, "teacherpass1")
        val learner = createUser(
            "a11y-target-${System.nanoTime()}@example.com", "learnerpass1", "Target Learner",
            UserRole.STUDENT, 1
        )

        val out = putProfile(session, learner.id, """{"settings":{"plainLanguage":true}}""")
        assertThat(out.response.status).isEqualTo(200)
        assertThat(out.response.contentAsString).contains("plainLanguage")
    }

    @Test
    fun `guardian can read a linked ward profile but cannot write it`() {
        val guardianEmail = "a11y-guardian-${System.nanoTime()}@example.com"
        val guardian = createUser(guardianEmail, "guardianpass1", "A11y Guardian", UserRole.GUARDIAN, 1)
        val session = login(guardianEmail, "guardianpass1")
        val learner = createUser(
            "a11y-ward-${System.nanoTime()}@example.com", "learnerpass1", "Ward Learner",
            UserRole.STUDENT, 1
        )
        guardianLinkRepository.save(
            GuardianLink(guardianId = guardian.id, learnerId = learner.id, relationship = "PARENT")
        )

        val read = getProfile(session, learner.id)
        assertThat(read.response.status).isEqualTo(200)

        val write = putProfile(session, learner.id, """{"settings":{"theme":"light"}}""")
        assertThat(write.response.status).isEqualTo(403)
    }

    @Test
    fun `unlinked guardian gets 403 on read`() {
        val guardianEmail = "a11y-stranger-${System.nanoTime()}@example.com"
        createUser(guardianEmail, "guardianpass1", "Unlinked", UserRole.GUARDIAN, 1)
        val session = login(guardianEmail, "guardianpass1")
        val learner = createUser(
            "a11y-other-${System.nanoTime()}@example.com", "learnerpass1", "Other Learner",
            UserRole.STUDENT, 1
        )
        assertThat(getProfile(session, learner.id).response.status).isEqualTo(403)
    }

    @Test
    fun `unknown setting keys and invalid values are rejected`() {
        val learnerEmail = "a11y-validate-${System.nanoTime()}@example.com"
        val learner = createUser(learnerEmail, "learnerpass1", "Validator", UserRole.STUDENT, 1)
        val session = login(learnerEmail, "learnerpass1")

        val unknown = putProfile(session, learner.id, """{"settings":{"diagnosis":"dyslexia"}}""")
        assertThat(unknown.response.status).isEqualTo(400)
        assertThat(unknown.response.contentAsString).contains("Unknown accessibility setting")

        val outOfRange = putProfile(session, learner.id, """{"settings":{"textScale":5}}""")
        assertThat(outOfRange.response.status).isEqualTo(400)

        val badTheme = putProfile(session, learner.id, """{"settings":{"theme":"neon"}}""")
        assertThat(badTheme.response.status).isEqualTo(400)
    }
}
