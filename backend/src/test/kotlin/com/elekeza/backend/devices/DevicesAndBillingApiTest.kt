package com.elekeza.backend.devices

import com.elekeza.backend.auth.UserRole
import com.elekeza.backend.billing.BillingService
import com.elekeza.backend.billing.CountryConfigRepository
import com.elekeza.backend.testutil.ApiTestSupport
import jakarta.servlet.http.Cookie
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.test.web.servlet.MvcResult
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders
import org.springframework.transaction.annotation.Transactional

/**
 * Device registry + billing architecture + regional configuration:
 *  - schools register, activate, assign and revoke devices (tenant-scoped)
 *  - a learner sees only their own device assignment
 *  - billing entitlements follow subscription state; plans are self-seeding
 *  - country configuration exists for Kenya and is read via API
 */
@Transactional
class DevicesAndBillingApiTest : ApiTestSupport() {

    @Autowired lateinit var billingService: BillingService
    @Autowired lateinit var countryConfigRepository: CountryConfigRepository

    private fun write(session: Cookie, method: String, url: String, json: String? = null): MvcResult {
        val builder = when (method) {
            "POST" -> MockMvcRequestBuilders.post(url)
            "PATCH" -> MockMvcRequestBuilders.patch(url)
            "DELETE" -> MockMvcRequestBuilders.delete(url)
            else -> MockMvcRequestBuilders.get(url)
        }.cookie(session)
        val pair = if (method == "GET") null else csrf(session)
        val request = if (pair != null) builder.cookie(pair.cookie).header("X-XSRF-TOKEN", pair.token) else builder
        return mockMvc.perform(
            if (json != null) request.contentType("application/json").content(json) else request
        ).andReturn()
    }

    private fun adminSession(): Pair<Cookie, String> {
        val email = "dev-admin-${System.nanoTime()}@example.com"
        createUser(email, "adminpass1", "Device Admin", UserRole.SCHOOL_ADMIN, 1)
        return Pair(login(email, "adminpass1"), email)
    }

    @Test
    fun `device lifecycle - register activate assign revoke`() {
        val (session, _) = adminSession()

        val registered = write(
            session, "POST", "/api/devices",
            """{"deviceCode":"EK-DV-${System.nanoTime()}","label":"Tablet 1"}"""
        )
        assertThat(registered.response.status).isEqualTo(201)
        val deviceId = com.fasterxml.jackson.databind.json.JsonMapper()
            .readTree(registered.response.contentAsString)["id"].asLong()

        // Learner cannot be assigned before activation.
        val learner = createUser("dev-learner-${System.nanoTime()}@example.com", "learnerpass1", "Device Learner", UserRole.STUDENT, 1)
        val early = write(session, "POST", "/api/devices/$deviceId/assign/${learner.id}")
        assertThat(early.response.status).isEqualTo(409)

        val activated = write(session, "PATCH", "/api/devices/$deviceId/status?status=ACTIVE")
        assertThat(activated.response.status).isEqualTo(200)

        val assigned = write(session, "POST", "/api/devices/$deviceId/assign/${learner.id}")
        assertThat(assigned.response.status).isEqualTo(200)

        // The learner sees their own device; a stranger does not.
        val mine = mockMvc.perform(
            MockMvcRequestBuilders.get("/api/devices/mine").cookie(login(learner.email, "learnerpass1"))
        ).andReturn()
        assertThat(mine.response.contentAsString).contains("EK-DV-")

        val stranger = createUser("dev-stranger-${System.nanoTime()}@example.com", "learnerpass1", "Stranger", UserRole.STUDENT, 1)
        val strangerMine = mockMvc.perform(
            MockMvcRequestBuilders.get("/api/devices/mine").cookie(login(stranger.email, "learnerpass1"))
        ).andReturn()
        assertThat(strangerMine.response.contentAsString).contains(""""device":null""")

        // Revocation clears the assignment.
        val revoked = write(session, "PATCH", "/api/devices/$deviceId/status?status=REVOKED")
        assertThat(revoked.response.status).isEqualTo(200)
        val afterRevocation = mockMvc.perform(
            MockMvcRequestBuilders.get("/api/devices/mine").cookie(login(learner.email, "learnerpass1"))
        ).andReturn()
        assertThat(afterRevocation.response.contentAsString).contains(""""device":null""")
    }

    @Test
    fun `device unassign clears the open assignment and label edits persist`() {
        val (session, _) = adminSession()
        val tenantId = 1L

        val registered = write(
            session, "POST", "/api/devices",
            """{"deviceCode":"EK-DV-U-${System.nanoTime()}","label":"Cart A"}"""
        )
        assertThat(registered.response.status).isEqualTo(201)
        val deviceId = com.fasterxml.jackson.databind.json.JsonMapper()
            .readTree(registered.response.contentAsString)["id"].asLong()

        val learner = createUser("dev-unassign-${System.nanoTime()}@example.com", "learnerpass1", "Unassign Learner", UserRole.STUDENT, tenantId)
        write(session, "PATCH", "/api/devices/$deviceId/status?status=ACTIVE")
        val assigned = write(session, "POST", "/api/devices/$deviceId/assign/${learner.id}")
        assertThat(assigned.response.status).isEqualTo(200)

        // Edit the label (Sprint 3 gap) and confirm it persists.
        val relabelled = write(session, "PATCH", "/api/devices/$deviceId", """{"label":"Cart A - North wing"}""")
        assertThat(relabelled.response.status).isEqualTo(200)
        assertThat(com.fasterxml.jackson.databind.json.JsonMapper()
            .readTree(relabelled.response.contentAsString)["label"].asText()).isEqualTo("Cart A - North wing")

        // Unassign (Sprint 3 gap): the open assignment closes, learner loses the device.
        val unassigned = write(session, "DELETE", "/api/devices/$deviceId/assignment")
        assertThat(unassigned.response.status).isEqualTo(200)
        assertThat(com.fasterxml.jackson.databind.json.JsonMapper()
            .readTree(unassigned.response.contentAsString)["assignedLearnerId"].isNull).isTrue()

        val mine = mockMvc.perform(
            MockMvcRequestBuilders.get("/api/devices/mine").cookie(login(learner.email, "learnerpass1"))
        ).andReturn()
        assertThat(mine.response.contentAsString).contains(""""device":null""")

        // Unassign is idempotent when nothing is open.
        val again = write(session, "DELETE", "/api/devices/$deviceId/assignment")
        assertThat(again.response.status).isEqualTo(200)

        // Over-long labels are rejected, not truncated.
        val tooLong = write(session, "PATCH", "/api/devices/$deviceId", """{"label":"${"x".repeat(201)}"}""")
        assertThat(tooLong.response.status).isEqualTo(400)
    }

    @Test
    fun `cross-tenant device access is 404`() {
        val (sessionA, _) = adminSession()
        val registered = write(sessionA, "POST", "/api/devices", """{"deviceCode":"EK-DV-X-${System.nanoTime()}"}""")
        val deviceId = com.fasterxml.jackson.databind.json.JsonMapper()
            .readTree(registered.response.contentAsString)["id"].asLong()

        val adminB = "dev-admin-b-${System.nanoTime()}@example.com"
        createUser(adminB, "adminpass1", "Other Admin", UserRole.SCHOOL_ADMIN, 2)
        val sessionB = login(adminB, "adminpass1")

        val out = write(sessionB, "PATCH", "/api/devices/$deviceId/status?status=ACTIVE")
        assertThat(out.response.status).isEqualTo(404)
    }

    @Test
    fun `billing - plans self-seed, entitlements follow subscription, invoice issued`() {
        billingService.ensureSeedPlans()

        val (session, _) = adminSession()
        val entitlementsBefore = mockMvc.perform(
            MockMvcRequestBuilders.get("/api/billing/institutions/1/entitlements").cookie(session)
        ).andReturn()
        assertThat(entitlementsBefore.response.status).isEqualTo(200)

        // Start a paid (trialing) subscription → entitled.
        val started = write(session, "POST", "/api/billing/institutions/1/subscriptions?planCode=GROWTH")
        assertThat(started.response.status).isEqualTo(200)
        assertThat(started.response.contentAsString).contains("GROWTH")

        val entitlements = mockMvc.perform(
            MockMvcRequestBuilders.get("/api/billing/institutions/1/entitlements").cookie(session)
        ).andReturn()
        assertThat(entitlements.response.contentAsString).contains(""""entitled":true""")
        assertThat(entitlements.response.contentAsString).contains("GROWTH")

        // Invoice for the period.
        val invoice = write(session, "POST", "/api/billing/institutions/1/invoices")
        assertThat(invoice.response.status).isEqualTo(200)
        assertThat(invoice.response.contentAsString).contains("OPEN")

        // Plans are publicly readable.
        val plans = mockMvc.perform(MockMvcRequestBuilders.get("/api/billing/plans")).andReturn()
        assertThat(plans.response.status).isEqualTo(200)
        assertThat(plans.response.contentAsString).contains("STARTER")
    }

    @Test
    fun `cross-tenant billing access is forbidden`() {
        billingService.ensureSeedPlans()
        val (sessionA, _) = adminSession()
        val adminB = "dev-admin-bill-${System.nanoTime()}@example.com"
        createUser(adminB, "adminpass1", "Other Admin", UserRole.SCHOOL_ADMIN, 2)
        val sessionB = login(adminB, "adminpass1")

        val out = write(sessionB, "POST", "/api/billing/institutions/1/subscriptions?planCode=GROWTH")
        assertThat(out.response.status).isEqualTo(403)
    }

    @Test
    fun `country configuration exposes Kenya with real values`() {
        val out = mockMvc.perform(MockMvcRequestBuilders.get("/api/countries/KE")).andReturn()
        assertThat(out.response.status).isEqualTo(200)
        val body = out.response.contentAsString
        assertThat(body).contains("Kenya")
        assertThat(body).contains("KES")
        assertThat(body).contains("Africa/Nairobi")
    }
}
