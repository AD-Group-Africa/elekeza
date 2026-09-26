package com.elekeza.backend.devices

import com.elekeza.backend.auth.UserRole
import com.elekeza.backend.billing.BillingPlanRepository
import com.elekeza.backend.billing.BillingService
import com.elekeza.backend.testutil.ApiTestSupport
import jakarta.servlet.http.Cookie
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.test.web.servlet.MvcResult
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders
import org.springframework.transaction.annotation.Transactional

/**
 * Device registry + billing entitlements over real HTTP:
 *  - school admin registers a device, activates it, assigns a learner
 *  - cross-tenant device targets are 404
 *  - learner sees their own device; revocation unassigns it
 *  - billing plans list is public; entitlements default to not-entitled and
 *    become entitled after starting a subscription
 */
@Transactional
class DeviceBillingApiTest : ApiTestSupport() {

    @Autowired lateinit var billingService: BillingService

    private fun op(session: Cookie, method: String, url: String, json: String? = null): MvcResult {
        val builder = when (method) {
            "POST" -> MockMvcRequestBuilders.post(url)
            "PATCH" -> MockMvcRequestBuilders.patch(url)
            else -> MockMvcRequestBuilders.get(url)
        }.cookie(session)
        val pair = csrf(session)
        var b = builder.cookie(pair.cookie).header("X-XSRF-TOKEN", pair.token)
        if (json != null) b = b.contentType("application/json").content(json)
        return mockMvc.perform(b).andReturn()
    }

    @Test
    fun `device lifecycle - register, activate, assign, learner reads it, revoke unassigns`() {
        val adminEmail = "dev-admin-${System.nanoTime()}@example.com"
        val admin = createUser(adminEmail, "adminpass1", "Device Admin", UserRole.SCHOOL_ADMIN, 1)
        val session = login(adminEmail, "adminpass1")

        val registered = op(session, "POST", "/api/devices", """{"deviceCode":"EK-DV-${System.nanoTime()}","label":"Tablet 1"}""")
        assertThat(registered.response.status).isEqualTo(201)
        val deviceCode = com.fasterxml.jackson.databind.json.JsonMapper().readTree(registered.response.contentAsString)["deviceCode"].asText()

        // Duplicate registration is 409.
        assertThat(op(session, "POST", "/api/devices", """{"deviceCode":"$deviceCode"}""").response.status).isEqualTo(409)

        val list = com.fasterxml.jackson.databind.json.JsonMapper().readTree(
            op(session, "GET", "/api/devices").response.contentAsString
        )
        val deviceId = list[0]["id"].asLong()

        assertThat(op(session, "PATCH", "/api/devices/$deviceId/status?status=ACTIVE").response.status).isEqualTo(200)

        val learner = createUser(
            "dev-learner-${System.nanoTime()}@example.com", "learnerpass1", "Device Learner",
            UserRole.STUDENT, 1
        )
        assertThat(op(session, "POST", "/api/devices/$deviceId/assign/${learner.id}").response.status).isEqualTo(200)

        // The learner sees their own device.
        val learnerSession = login(learner.email, "learnerpass1")
        val mine = com.fasterxml.jackson.databind.json.JsonMapper().readTree(
            op(learnerSession, "GET", "/api/devices/mine").response.contentAsString
        )
        assertThat(mine["device"]["deviceCode"].asText()).isEqualTo(deviceCode)

        // Revocation removes the assignment.
        assertThat(op(session, "PATCH", "/api/devices/$deviceId/status?status=REVOKED").response.status).isEqualTo(200)
        val mineAfter = com.fasterxml.jackson.databind.json.JsonMapper().readTree(
            op(learnerSession, "GET", "/api/devices/mine").response.contentAsString
        )
        assertThat(mineAfter["device"].isNull).isTrue()
    }

    @Test
    fun `cross-tenant device target is 404`() {
        val adminA = "dev-a-${System.nanoTime()}@example.com"
        createUser(adminA, "adminpass1", "Tenant A Admin", UserRole.SCHOOL_ADMIN, 1)
        val sessionA = login(adminA, "adminpass1")

        val adminB = "dev-b-${System.nanoTime()}@example.com"
        createUser(adminB, "adminpass1", "Tenant B Admin", UserRole.SCHOOL_ADMIN, 2)
        val sessionB = login(adminB, "adminpass1")
        val registeredB = com.fasterxml.jackson.databind.json.JsonMapper().readTree(
            op(sessionB, "POST", "/api/devices", """{"deviceCode":"EK-DV-B${System.nanoTime()}"}""").response.contentAsString
        )
        val deviceIdB = registeredB["id"].asLong()

        assertThat(op(sessionA, "PATCH", "/api/devices/$deviceIdB/status?status=ACTIVE").response.status).isEqualTo(404)
    }

    @Test
    fun `billing - plans listed, entitlements flip with subscription`() {
        billingService.ensureSeedPlans()
        val adminEmail = "bill-admin-${System.nanoTime()}@example.com"
        val admin = createUser(adminEmail, "adminpass1", "Billing Admin", UserRole.SCHOOL_ADMIN, 1)
        val session = login(adminEmail, "adminpass1")

        // Plans are publicly readable.
        val plans = get("/api/billing/plans", null)
        assertThat(plans.status).isEqualTo(200)
        assertThat(plans.bodyText).contains("STARTER")

        // Default: no subscription → not entitled.
        val before = com.fasterxml.jackson.databind.json.JsonMapper().readTree(
            op(session, "GET", "/api/billing/institutions/1/entitlements").response.contentAsString
        )
        assertThat(before["entitled"].asBoolean()).isFalse()

        // Start a paid plan → entitled with seat limits from the plan.
        assertThat(
            op(session, "POST", "/api/billing/institutions/1/subscriptions?planCode=SCHOOL", null).response.status
        ).isEqualTo(200)
        val after = com.fasterxml.jackson.databind.json.JsonMapper().readTree(
            op(session, "GET", "/api/billing/institutions/1/entitlements").response.contentAsString
        )
        assertThat(after["entitled"].asBoolean()).isTrue()
        assertThat(after["planCode"].asText()).isEqualTo("SCHOOL")
        assertThat(after["maxStudents"].asInt()).isGreaterThan(50)

        // Cross-tenant entitlements are forbidden.
        assertThat(op(session, "GET", "/api/billing/institutions/2/entitlements").response.status).isEqualTo(403)
    }
}
