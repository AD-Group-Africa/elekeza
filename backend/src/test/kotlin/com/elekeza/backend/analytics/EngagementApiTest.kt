package com.elekeza.backend.analytics

import com.elekeza.backend.auth.UserRole
import com.elekeza.backend.testutil.ApiTestSupport
import jakarta.servlet.http.Cookie
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.springframework.test.web.servlet.MvcResult
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders
import org.springframework.transaction.annotation.Transactional

/**
 * Engagement telemetry over real HTTP:
 *  - authenticated users can record only whitelisted event types
 *  - institution summaries are admin-only and return aggregate counts
 *  - SCHOOL_ADMIN cannot read another institution's summary
 */
@Transactional
class EngagementApiTest : ApiTestSupport() {

    private fun record(session: Cookie, json: String): MvcResult {
        val builder = MockMvcRequestBuilders.post("/api/engagement/events").cookie(session)
        val pair = csrf(session)
        return mockMvc.perform(
            builder.cookie(pair.cookie).header("X-XSRF-TOKEN", pair.token)
                .contentType("application/json").content(json)
        ).andReturn()
    }

    @Test
    fun `learner engagement events are recorded`() {
        val learnerEmail = "eng-learner-${System.nanoTime()}@example.com"
        createUser(learnerEmail, "learnerpass1", "Engaged Learner", UserRole.STUDENT, 1)
        val session = login(learnerEmail, "learnerpass1")

        val out = record(session, """{"eventType":"LESSON_STARTED","refType":"LESSON","refId":42}""")
        assertThat(out.response.status).isEqualTo(202)

        val a11y = record(session, """{"eventType":"TTS_USED","refType":"A11Y"}""")
        assertThat(a11y.response.status).isEqualTo(202)
    }

    @Test
    fun `unknown event types are rejected`() {
        val learnerEmail = "eng-bad-${System.nanoTime()}@example.com"
        createUser(learnerEmail, "learnerpass1", "Bad Event", UserRole.STUDENT, 1)
        val session = login(learnerEmail, "learnerpass1")

        val out = record(session, """{"eventType":"SOMETHING_ELSE"}""")
        assertThat(out.response.status).isEqualTo(400)
        assertThat(out.response.contentAsString).contains("Unknown event type")
    }

    @Test
    fun `school admin reads aggregate summary for their institution`() {
        // Seed a few events.
        val learnerEmail = "eng-summary-${System.nanoTime()}@example.com"
        createUser(learnerEmail, "learnerpass1", "Summary Learner", UserRole.STUDENT, 1)
        val learnerSession = login(learnerEmail, "learnerpass1")
        record(learnerSession, """{"eventType":"LESSON_STARTED"}""")
        record(learnerSession, """{"eventType":"LESSON_COMPLETED"}""")
        record(learnerSession, """{"eventType":"TTS_USED","refType":"A11Y"}""")

        val adminEmail = "eng-admin-${System.nanoTime()}@example.com"
        createUser(adminEmail, "adminpass1", "Summary Admin", UserRole.SCHOOL_ADMIN, 1)
        val session = login(adminEmail, "adminpass1")

        val out = mockMvc.perform(
            MockMvcRequestBuilders.get("/api/engagement/institutions/1/summary?days=30").cookie(session)
        ).andReturn()
        assertThat(out.response.status).isEqualTo(200)
        val body = out.response.contentAsString
        assertThat(body).contains(""""totalEvents":""").contains(""""activeUsers":""")
        assertThat(body).contains(""""accessibilityFeatureUses":""")
        // Aggregates only: no per-user rows.
        assertThat(body).doesNotContain(learnerEmail)
    }

    @Test
    fun `school admin cannot read another institution summary`() {
        val adminEmail = "eng-admin-x-${System.nanoTime()}@example.com"
        createUser(adminEmail, "adminpass1", "Wrong Tenant Admin", UserRole.SCHOOL_ADMIN, 1)
        val session = login(adminEmail, "adminpass1")

        val out = mockMvc.perform(
            MockMvcRequestBuilders.get("/api/engagement/institutions/2/summary").cookie(session)
        ).andReturn()
        assertThat(out.response.status).isEqualTo(403)
    }

    @Test
    fun `teachers cannot read institution summaries`() {
        val teacherEmail = "eng-teacher-${System.nanoTime()}@example.com"
        createUser(teacherEmail, "teacherpass1", "No Summary", UserRole.TEACHER, 1)
        val session = login(teacherEmail, "teacherpass1")

        val out = mockMvc.perform(
            MockMvcRequestBuilders.get("/api/engagement/institutions/1/summary").cookie(session)
        ).andReturn()
        assertThat(out.response.status).isEqualTo(403)
    }
}
