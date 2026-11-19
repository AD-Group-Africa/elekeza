package com.elekeza.backend.guardian

import com.elekeza.backend.calendar.Deadline
import com.elekeza.backend.calendar.DeadlineRepository
import com.elekeza.backend.calendar.DeadlineScope
import com.elekeza.backend.calendar.DeadlineType
import com.elekeza.backend.institution.GuardianLink
import com.elekeza.backend.institution.GuardianLinkRepository
import com.elekeza.backend.institution.Institution
import com.elekeza.backend.institution.InstitutionRepository
import com.elekeza.backend.testutil.ApiTestSupport
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.transaction.annotation.Transactional
import java.time.Instant
import java.time.temporal.ChronoUnit
import java.util.UUID

/**
 * Sprint 3 regression: a guardian may only see a school's private dates while
 * the guardian link is valid — ACTIVE, not revoked, and not past its expiry
 * (GuardianLink.currentlyActive()). NATIONAL/REGIONAL stay public in
 * every state; revoked/expired links must not resurrect school-dated rows on
 * /api/guardian/schedule, and the schedule's ward-lesson section must honor
 * the same lifecycle.
 */
@Transactional
class GuardianDeadlineLinkLifecycleTest : ApiTestSupport() {

    @Autowired lateinit var institutionRepo: InstitutionRepository
    @Autowired lateinit var guardianLinkRepo: GuardianLinkRepository
    @Autowired lateinit var deadlineRepo: DeadlineRepository

    private fun uniq() = UUID.randomUUID().toString().take(8)

    @Test
    fun `guardian sees linked school's dates while the link is active`() {
        val inst = institutionRepo.save(Institution(name = "Lifecycle Academy A ${uniq()}"))
        val ward = createUser("lc-ward-${uniq()}@t.local", "learnerpass1", "Ward", com.elekeza.backend.auth.UserRole.STUDENT, inst.id)
        val guardian = createUser("lc-guard-${uniq()}@t.local", "guardianpass1", "Active Guardian", com.elekeza.backend.auth.UserRole.GUARDIAN, null)
        guardianLinkRepo.save(GuardianLink(guardianId = guardian.id, learnerId = ward.id, relationship = "PARENT"))

        val title = "Linked School Sports Day ${uniq()}"
        deadlineRepo.save(Deadline(
            title = title, deadlineType = DeadlineType.SCHOOL_EVENT, scope = DeadlineScope.INSTITUTION,
            dueAt = Instant.now().plus(3, ChronoUnit.DAYS), institutionId = inst.id, createdBy = guardian.id))

        val titles = scheduleTitles(login(guardian.email, "guardianpass1"))
        assertTrue(titles.contains(title), "active link must reveal the school's dates, got $titles")
    }

    @Test
    fun `revoked link no longer grants school-date visibility`() {
        val inst = institutionRepo.save(Institution(name = "Lifecycle Academy B ${uniq()}"))
        val ward = createUser("lc-ward-${uniq()}@t.local", "learnerpass1", "Ward", com.elekeza.backend.auth.UserRole.STUDENT, inst.id)
        val guardian = createUser("lc-guard-${uniq()}@t.local", "guardianpass1", "Revoked Guardian", com.elekeza.backend.auth.UserRole.GUARDIAN, null)
        guardianLinkRepo.save(GuardianLink(
            guardianId = guardian.id, learnerId = ward.id, relationship = "PARENT",
            revokedAt = Instant.now().minus(1, ChronoUnit.HOURS)))

        val title = "Revoked School Day ${uniq()}"
        deadlineRepo.save(Deadline(
            title = title, deadlineType = DeadlineType.SCHOOL_EVENT, scope = DeadlineScope.INSTITUTION,
            dueAt = Instant.now().plus(3, ChronoUnit.DAYS), institutionId = inst.id, createdBy = guardian.id))

        val titles = scheduleTitles(login(guardian.email, "guardianpass1"))
        assertFalse(titles.contains(title), "revoked link must not reveal the school's dates, got $titles")

        // Blocked flag alone (isActive=false) is equally terminal.
        guardianLinkRepo.save(GuardianLink(
            guardianId = guardian.id, learnerId = ward.id, relationship = "OTHER", isActive = false))
        val titles2 = scheduleTitles(login(guardian.email, "guardianpass1"))
        assertFalse(titles2.contains(title))
    }

    @Test
    fun `expired link no longer grants school-date visibility`() {
        val inst = institutionRepo.save(Institution(name = "Lifecycle Academy C ${uniq()}"))
        val ward = createUser("lc-ward-${uniq()}@t.local", "learnerpass1", "Ward", com.elekeza.backend.auth.UserRole.STUDENT, inst.id)
        val guardian = createUser("lc-guard-${uniq()}@t.local", "guardianpass1", "Expired Guardian", com.elekeza.backend.auth.UserRole.GUARDIAN, null)
        guardianLinkRepo.save(GuardianLink(
            guardianId = guardian.id, learnerId = ward.id, relationship = "CAREGIVER",
            expiresAt = Instant.now().minus(1, ChronoUnit.HOURS)))

        val title = "Expired School Day ${uniq()}"
        deadlineRepo.save(Deadline(
            title = title, deadlineType = DeadlineType.SCHOOL_EVENT, scope = DeadlineScope.INSTITUTION,
            dueAt = Instant.now().plus(3, ChronoUnit.DAYS), institutionId = inst.id, createdBy = guardian.id))

        val titles = scheduleTitles(login(guardian.email, "guardianpass1"))
        assertFalse(titles.contains(title), "expired link must not reveal the school's dates, got $titles")
    }

    @Test
    fun `national dates stay visible regardless of link state`() {
        val guardian = createUser("lc-guard-${uniq()}@t.local", "guardianpass1", "No Link Guardian", com.elekeza.backend.auth.UserRole.GUARDIAN, null)
        val title = "Always Visible National ${uniq()}"
        deadlineRepo.save(Deadline(
            title = title, deadlineType = DeadlineType.EXAM, scope = DeadlineScope.NATIONAL,
            dueAt = Instant.now().plus(3, ChronoUnit.DAYS), institutionId = null, createdBy = guardian.id))

        val titles = scheduleTitles(login(guardian.email, "guardianpass1"))
        assertTrue(titles.contains(title), "national dates must stay visible without any link, got $titles")
        // And the linkless guardian sees nothing institution-private.
        deadlineRepo.save(Deadline(
            title = "Private ${uniq()}", deadlineType = DeadlineType.EXAM, scope = DeadlineScope.INSTITUTION,
            dueAt = Instant.now().plus(3, ChronoUnit.DAYS), institutionId = institutionRepo.save(Institution(name = "No Link School ${uniq()}")).id,
            createdBy = guardian.id))
        val titles2 = scheduleTitles(login(guardian.email, "guardianpass1"))
        assertTrue(titles2.none { it.startsWith("Private ") })
        assertEquals(titles, titles2)
    }

    private fun scheduleTitles(session: jakarta.servlet.http.Cookie): List<String> {
        val res = get("/api/guardian/schedule", session)
        assertEquals(200, res.status, res.bodyText)
        return (res.body ?: throw AssertionError("null body")).map { it.get("title").asText() }
    }
}
