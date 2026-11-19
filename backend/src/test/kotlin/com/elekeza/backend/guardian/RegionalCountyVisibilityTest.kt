package com.elekeza.backend.guardian

import com.elekeza.backend.auth.User
import com.elekeza.backend.auth.UserRole
import com.elekeza.backend.calendar.CountyKey
import com.elekeza.backend.calendar.Deadline
import com.elekeza.backend.calendar.DeadlineRepository
import com.elekeza.backend.calendar.DeadlineScope
import com.elekeza.backend.calendar.DeadlineType
import com.elekeza.backend.institution.GuardianLink
import com.elekeza.backend.institution.GuardianLinkRepository
import com.elekeza.backend.institution.Institution
import com.elekeza.backend.institution.InstitutionRepository
import com.elekeza.backend.testutil.ApiTestSupport
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.BeforeAll
import org.junit.jupiter.api.DisplayName
import org.junit.jupiter.api.MethodOrderer
import org.junit.jupiter.api.Order
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.TestInstance
import org.junit.jupiter.api.TestMethodOrder
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.test.context.TestPropertySource
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.time.temporal.ChronoUnit

/**
 * County scoping for REGIONAL school dates (V20).
 *
 * Runs on its own H2 database: the rest of the suite shares one in-memory
 * instance, and this class deliberately creates extra institutions and counties
 * that must not perturb other suites' fixtures.
 *
 * Tests the access policy, not the implementation: every assertion is about
 * what a particular guardian can see, and cross-county / cross-institution
 * leakage is asserted directly rather than inferred.
 */
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
@TestMethodOrder(MethodOrderer.OrderAnnotation::class)
@TestPropertySource(properties = [
    "spring.datasource.url=jdbc:h2:mem:elekeza-regional;DB_CLOSE_DELAY=-1;MODE=PostgreSQL",
])
class RegionalCountyVisibilityTest : ApiTestSupport() {

    @Autowired lateinit var institutionRepo: InstitutionRepository
    @Autowired lateinit var guardianLinkRepo: GuardianLinkRepository
    @Autowired lateinit var deadlineRepo: DeadlineRepository

    private lateinit var nairobi: Institution
    private lateinit var kisumu: Institution
    private lateinit var noCounty: Institution

    private lateinit var wardNairobi: User
    private lateinit var wardKisumu: User
    private lateinit var wardNoCounty: User

    private val tag = System.nanoTime().toString().takeLast(6)
    private val nairobiRegional = "Nairobi County Science Fair $tag"
    private val kisumuRegional = "Kisumu County Athletics $tag"
    private val mombasaRegional = "Mombasa County Music Festival $tag"
    private val uncodedRegional = "Regional date without county $tag"
    private val national = "National Exam Day $tag"

    private lateinit var twoCountyGuardian: User
    private lateinit var nairobiGuardian: User
    private lateinit var revokedGuardian: User
    private lateinit var expiredGuardian: User
    private lateinit var noCountyGuardian: User
    private lateinit var schoolAdmin: User

    private val created = mutableListOf<Long>()

    @BeforeAll
    fun setup() {
        nairobi = institutionRepo.save(Institution(name = "Nairobi Academy $tag", county = "Nairobi"))
        kisumu = institutionRepo.save(Institution(name = "Kisumu Academy $tag", county = "Kisumu"))
        noCounty = institutionRepo.save(Institution(name = "Unregistered Academy $tag", county = null))

        wardNairobi = createUser("rcv-ward-nbi-$tag@test.local", "pass123", "Ward Nairobi", UserRole.STUDENT, nairobi.id)
        wardKisumu = createUser("rcv-ward-ksm-$tag@test.local", "pass123", "Ward Kisumu", UserRole.STUDENT, kisumu.id)
        wardNoCounty = createUser("rcv-ward-none-$tag@test.local", "pass123", "Ward No County", UserRole.STUDENT, noCounty.id)

        twoCountyGuardian = createUser("rcv-g2-$tag@test.local", "pass123", "Two County Guardian", UserRole.GUARDIAN, null)
        guardianLinkRepo.save(GuardianLink(guardianId = twoCountyGuardian.id, learnerId = wardNairobi.id, relationship = "PARENT"))
        guardianLinkRepo.save(GuardianLink(guardianId = twoCountyGuardian.id, learnerId = wardKisumu.id, relationship = "PARENT"))

        nairobiGuardian = createUser("rcv-g1-$tag@test.local", "pass123", "Nairobi Guardian", UserRole.GUARDIAN, null)
        guardianLinkRepo.save(GuardianLink(guardianId = nairobiGuardian.id, learnerId = wardNairobi.id, relationship = "PARENT"))

        revokedGuardian = createUser("rcv-grev-$tag@test.local", "pass123", "Revoked Guardian", UserRole.GUARDIAN, null)
        guardianLinkRepo.save(
            GuardianLink(
                guardianId = revokedGuardian.id, learnerId = wardNairobi.id, relationship = "PARENT",
                revokedAt = Instant.now().minus(1, ChronoUnit.HOURS)
            )
        )

        expiredGuardian = createUser("rcv-gexp-$tag@test.local", "pass123", "Expired Guardian", UserRole.GUARDIAN, null)
        guardianLinkRepo.save(
            GuardianLink(
                guardianId = expiredGuardian.id, learnerId = wardNairobi.id, relationship = "PARENT",
                expiresAt = Instant.now().minus(1, ChronoUnit.HOURS)
            )
        )

        noCountyGuardian = createUser("rcv-gnone-$tag@test.local", "pass123", "No County Guardian", UserRole.GUARDIAN, null)
        guardianLinkRepo.save(GuardianLink(guardianId = noCountyGuardian.id, learnerId = wardNoCounty.id, relationship = "PARENT"))

        schoolAdmin = createUser("rcv-admin-$tag@test.local", "pass123", "Regional Admin", UserRole.ADMIN, null)

        val future = at(LocalDate.now().plusDays(3))
        save(national, DeadlineScope.NATIONAL, null, future)
        save(nairobiRegional, DeadlineScope.REGIONAL, CountyKey.normalize("Nairobi"), future)
        save(kisumuRegional, DeadlineScope.REGIONAL, CountyKey.normalize("Kisumu"), future)
        save(mombasaRegional, DeadlineScope.REGIONAL, CountyKey.normalize("Mombasa"), future)
        save(uncodedRegional, DeadlineScope.REGIONAL, null, future)
    }

    private fun at(date: LocalDate): Instant =
        date.atTime(9, 0).atZone(ZoneId.systemDefault()).toInstant().truncatedTo(ChronoUnit.MINUTES)

    private fun save(title: String, scope: DeadlineScope, county: String?, dueAt: Instant, institutionId: Long? = null): Deadline {
        val d = deadlineRepo.save(
            Deadline(
                title = title, deadlineType = DeadlineType.SCHOOL_EVENT, scope = scope,
                dueAt = dueAt, institutionId = institutionId, countyCode = county, createdBy = wardNairobi.id
            )
        )
        created += d.id
        return d
    }

    private fun schoolDateTitles(outcome: com.elekeza.backend.testutil.HttpOutcome): List<String> {
        val body = outcome.body ?: return emptyList()
        return body.filter { it.get("type")?.asText() == "School Date" }
            .map { it.get("title").asText() }
    }

    private fun deadlineTitles(outcome: com.elekeza.backend.testutil.HttpOutcome): List<String> {
        val body = outcome.body ?: return emptyList()
        return body.map { it.get("title").asText() }
    }

    private fun scheduleOf(user: User): List<String> =
        schoolDateTitles(get("/api/guardian/schedule", login(user.email, "pass123")))

    private fun deadlinesOf(user: User): List<String> =
        deadlineTitles(get("/api/deadlines", login(user.email, "pass123")))

    // ── 1 & 4: national + multi-county ───────────────────────────────────────

    @Test
    @Order(1)
    @DisplayName("a guardian sees national dates from any county")
    fun nationalVisibleAcrossCounties() {
        val titles = scheduleOf(twoCountyGuardian)
        assertThat(titles).contains(national)
    }

    @Test
    @Order(2)
    @DisplayName("a guardian with wards in two counties sees the regional date for each county")
    fun multiCountyGuardianSeesBothCounties() {
        val titles = scheduleOf(twoCountyGuardian)
        assertThat(titles).contains(nairobiRegional, kisumuRegional)
        assertThat(titles).doesNotContain(mombasaRegional)
    }

    // ── 2 & 3: matching vs non-matching county ──────────────────────────────

    @Test
    @Order(3)
    @DisplayName("a regional date is visible to a guardian whose active ward attends school in that county")
    fun regionalVisibleForMatchingCounty() {
        assertThat(scheduleOf(nairobiGuardian)).contains(nairobiRegional)
    }

    @Test
    @Order(4)
    @DisplayName("a regional date is hidden from a guardian whose wards attend school in another county")
    fun regionalHiddenForOtherCounty() {
        assertThat(scheduleOf(nairobiGuardian)).doesNotContain(kisumuRegional, mombasaRegional)
    }

    // ── 5: institution scope stays institution-scoped ────────────────────────

    @Test
    @Order(5)
    @DisplayName("institution dates remain restricted to the ward's own institution")
    fun institutionDatesStayScoped() {
        val kisumuOnly = "Kisumu Athletics Day $tag"
        save(kisumuOnly, DeadlineScope.INSTITUTION, null, at(LocalDate.now().plusDays(4)), institutionId = kisumu.id)
        assertThat(scheduleOf(twoCountyGuardian)).contains(kisumuOnly)
        assertThat(scheduleOf(nairobiGuardian)).doesNotContain(kisumuOnly)
    }

    // ── 6 & 7: fail closed on missing county data ───────────────────────────

    @Test
    @Order(6)
    @DisplayName("a regional date with no county is visible to nobody")
    fun uncodedRegionalIsInvisible() {
        assertThat(scheduleOf(twoCountyGuardian)).doesNotContain(uncodedRegional)
        assertThat(scheduleOf(nairobiGuardian)).doesNotContain(uncodedRegional)
        assertThat(scheduleOf(noCountyGuardian)).doesNotContain(uncodedRegional)
        // and it is not globally visible through the deadline endpoint either
        assertThat(deadlinesOf(nairobiGuardian)).doesNotContain(uncodedRegional)
    }

    @Test
    @Order(7)
    @DisplayName("a ward at an institution with no county grants no regional visibility")
    fun missingInstitutionCountyGrantsNothing() {
        val titles = scheduleOf(noCountyGuardian)
        assertThat(titles).doesNotContain(nairobiRegional, kisumuRegional, mombasaRegional)
        assertThat(titles).contains(national) // national is unaffected
    }

    // ── 8 & 9: link lifecycle ───────────────────────────────────────────────

    @Test
    @Order(8)
    @DisplayName("a revoked guardian link exposes no ward-linked dates")
    fun revokedLinkExposesNothing() {
        val titles = scheduleOf(revokedGuardian)
        assertThat(titles).doesNotContain(nairobiRegional)
        assertThat(titles).contains(national)
    }

    @Test
    @Order(9)
    @DisplayName("an expired guardian link exposes no ward-linked dates")
    fun expiredLinkExposesNothing() {
        val titles = scheduleOf(expiredGuardian)
        assertThat(titles).doesNotContain(nairobiRegional)
        assertThat(titles).contains(national)
    }

    // ── 10: endpoint authorization ──────────────────────────────────────────

    @Test
    @Order(10)
    @DisplayName("anonymous and non-guardian callers cannot read the guardian schedule")
    fun scheduleIsAuthorized() {
        assertThat(get("/api/guardian/schedule", null).status).isEqualTo(401)
        val learnerSession = login(wardNairobi.email, "pass123")
        assertThat(get("/api/guardian/schedule", learnerSession).status).isEqualTo(403)
    }

    // ── 11: date boundaries ─────────────────────────────────────────────────

    @Test
    @Order(11)
    @DisplayName("the schedule excludes past dates while the deadline list keeps them")
    fun dateBoundaryBehaviour() {
        val pastRegional = "Past Nairobi Event $tag"
        save(pastRegional, DeadlineScope.REGIONAL, CountyKey.normalize("Nairobi"), at(LocalDate.now().minusDays(2)))

        assertThat(scheduleOf(nairobiGuardian)).doesNotContain(pastRegional)
        assertThat(deadlinesOf(nairobiGuardian)).contains(pastRegional)
    }

    // ── 12: the two endpoints agree ─────────────────────────────────────────

    @Test
    @Order(12)
    @DisplayName("both endpoints return the same regional visibility for a guardian")
    fun endpointsAgree() {
        val viaSchedule = scheduleOf(nairobiGuardian)
        val viaDeadlines = deadlinesOf(nairobiGuardian)

        assertThat(viaSchedule).contains(nairobiRegional)
        assertThat(viaDeadlines).contains(nairobiRegional)

        assertThat(viaSchedule).doesNotContain(kisumuRegional, mombasaRegional)
        assertThat(viaDeadlines).doesNotContain(kisumuRegional, mombasaRegional)
    }

    // ── creation contract ───────────────────────────────────────────────────

    @Test
    @Order(13)
    @DisplayName("an admin can create a county-scoped regional date and the county is normalised")
    fun adminCreatesCountyScopedRegional() {
        val session = login(schoolAdmin.email, "pass123")
        val res = postJson(
            "/api/deadlines",
            """{"title":"Normalised County $tag","deadlineType":"SCHOOL_EVENT","scope":"REGIONAL","dueAt":"${at(LocalDate.now().plusDays(5))}","county":"  NAIROBI  County "}""",
            session
        )
        assertThat(res.status).isEqualTo(200)
        assertThat(res.body?.get("countyCode")?.asText()).isEqualTo("nairobi")
        res.body?.get("id")?.asLong()?.let { created += it }
    }

    @Test
    @Order(14)
    @DisplayName("a county on a non-regional deadline is rejected")
    fun countyOnInstitutionScopeRejected() {
        val session = login(schoolAdmin.email, "pass123")
        val res = postJson(
            "/api/deadlines",
            """{"title":"Wrong Scope County $tag","deadlineType":"EXAM","scope":"NATIONAL","dueAt":"${at(LocalDate.now().plusDays(5))}","county":"Nairobi"}""",
            session
        )
        assertThat(res.status).isEqualTo(400)
    }

    @Test
    @Order(15)
    @DisplayName("a county that normalises to nothing is rejected rather than silently stored")
    fun blankCountyRejected() {
        val session = login(schoolAdmin.email, "pass123")
        val res = postJson(
            "/api/deadlines",
            """{"title":"Blank County $tag","deadlineType":"SCHOOL_EVENT","scope":"REGIONAL","dueAt":"${at(LocalDate.now().plusDays(5))}","county":"   "}""",
            session
        )
        assertThat(res.status).isEqualTo(400)
    }

    // ── normaliser ──────────────────────────────────────────────────────────

    @Test
    @Order(16)
    @DisplayName("county normalisation ignores case, spacing, punctuation and a trailing 'County'")
    fun countyNormalisation() {
        assertThat(CountyKey.normalize("Nairobi")).isEqualTo("nairobi")
        assertThat(CountyKey.normalize("  NAIROBI  ")).isEqualTo("nairobi")
        assertThat(CountyKey.normalize("Nairobi County")).isEqualTo("nairobi")
        assertThat(CountyKey.normalize("Taita-Taveta")).isEqualTo("taita taveta")
        assertThat(CountyKey.normalize("Murang'a")).isEqualTo("muranga")
        assertThat(CountyKey.normalize("   ")).isNull()
        assertThat(CountyKey.normalize(null)).isNull()
        assertThat(CountyKey.matches("Nairobi", "nairobi county")).isTrue()
        assertThat(CountyKey.matches("Nairobi", null)).isFalse()
    }
}
