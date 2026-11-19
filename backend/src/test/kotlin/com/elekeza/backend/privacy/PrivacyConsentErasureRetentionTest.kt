package com.elekeza.backend.privacy

import com.elekeza.backend.auth.PasswordResetToken
import com.elekeza.backend.auth.PasswordResetTokenRepository
import com.elekeza.backend.auth.User
import com.elekeza.backend.auth.UserRole
import com.elekeza.backend.institution.GuardianLink
import com.elekeza.backend.institution.GuardianLinkRepository
import com.elekeza.backend.institution.Institution
import com.elekeza.backend.institution.InstitutionRepository
import com.elekeza.backend.notification.Notification
import com.elekeza.backend.notification.NotificationRepository
import com.elekeza.backend.testutil.ApiTestSupport
import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.BeforeAll
import org.junit.jupiter.api.MethodOrderer
import org.junit.jupiter.api.Order
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.TestInstance
import org.junit.jupiter.api.TestMethodOrder
import org.springframework.beans.factory.annotation.Autowired
import java.time.Instant
import java.time.OffsetDateTime
import java.time.temporal.ChronoUnit

/**
 * V21 privacy controls (pre-pilot audit P0 gaps):
 *  * guardian consent capture — including the rule that a consent for a learner
 *    requires a CURRENTLY ACTIVE guardian link (not merely an existing row),
 *  * idempotent re-consent and history-preserving withdrawal,
 *  * account erasure — identity destroyed, access revoked, school records kept,
 *  * retention — nothing deleted on a dry run, real sweep deletes on request.
 */
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
@TestMethodOrder(MethodOrderer.OrderAnnotation::class)
class PrivacyConsentErasureRetentionTest : ApiTestSupport() {

    @Autowired lateinit var consentRepo: ConsentRepository
    @Autowired lateinit var erasureLogRepo: ErasureLogRepository
    @Autowired lateinit var guardianLinkRepo: GuardianLinkRepository
    @Autowired lateinit var institutionRepo: InstitutionRepository
    @Autowired lateinit var passwordResetTokenRepo: PasswordResetTokenRepository
    @Autowired lateinit var notificationRepo: NotificationRepository
    @Autowired lateinit var retentionService: RetentionService
    @Autowired lateinit var erasureService: AccountErasureService

    private lateinit var institution: Institution
    private lateinit var learner: User

    private val guardianEmail = "privacy-guardian@test.local"
    private val otherGuardianEmail = "privacy-other-guardian@test.local"
    private val erasureEmail = "privacy-erase-me@test.local"
    private val revokedLinkEmail = "privacy-revoked-link@test.local"

    private var learnerConsentId: Long = 0

    @BeforeAll
    fun setup() {
        institution = institutionRepo.save(Institution(name = "Privacy Test Academy"))
        learner = createUser("privacy-learner@test.local", "pass123", "Privacy Learner", UserRole.STUDENT, institution.id)
        createUser(guardianEmail, "pass123", "Privacy Guardian", UserRole.GUARDIAN)
        createUser(otherGuardianEmail, "pass123", "Other Guardian", UserRole.GUARDIAN)
        createUser(erasureEmail, "pass123", "Erase Me", UserRole.GUARDIAN)
        createUser(revokedLinkEmail, "pass123", "Revoked Link Guardian", UserRole.GUARDIAN)

        val guardian = userRepo.findByEmail(guardianEmail)!!
        guardianLinkRepo.save(GuardianLink(guardianId = guardian.id, learnerId = learner.id, relationship = "PARENT"))

        // A link that exists but was revoked: consent must be refused.
        val revokedGuardian = userRepo.findByEmail(revokedLinkEmail)!!
        val revoked = guardianLinkRepo.save(
            GuardianLink(guardianId = revokedGuardian.id, learnerId = learner.id, relationship = "PARENT")
        )
        guardianLinkRepo.save(
            revoked.copy(id = revoked.id, revokedAt = Instant.now().minus(1, ChronoUnit.DAYS))
        )
    }

    // ── Consent ──────────────────────────────────────────────────────────────

    @Test
    @Order(1)
    fun `policy text is exposed with a version`() {
        val session = login(guardianEmail, "pass123")
        val res = get("/api/privacy/policy", session)
        assertEquals(200, res.status)
        val version = res.body!!["version"].asText()
        assertTrue(version.isNotBlank(), "a policy version must be published with the wording")
        assertEquals(ConsentType.entries.size, res.body!!["consents"].size())
    }

    @Test
    @Order(2)
    fun `guardian can consent for themselves`() {
        val session = login(guardianEmail, "pass123")
        val res = postJson("/api/privacy/consent", """{"type":"GUARDIAN_DATA_PROCESSING"}""", session)
        assertEquals(201, res.status, res.bodyText)
        assertEquals("GUARDIAN_DATA_PROCESSING", res.body!!["type"].asText())
        assertTrue(res.body!!["subjectUserId"].isNull)
    }

    @Test
    @Order(3)
    fun `guardian can consent for a linked learner`() {
        val session = login(guardianEmail, "pass123")
        val res = postJson(
            "/api/privacy/consent",
            """{"type":"LEARNER_DATA_PROCESSING","subjectUserId":${learner.id}}""",
            session
        )
        assertEquals(201, res.status, res.bodyText)
        learnerConsentId = res.body!!["id"].asLong()
        assertEquals(learner.id, res.body!!["subjectUserId"].asLong())
        assertEquals(ConsentService.POLICY_VERSION, res.body!!["policyVersion"].asText())
    }

    @Test
    @Order(4)
    fun `re-consenting is idempotent and does not duplicate history`() {
        val session = login(guardianEmail, "pass123")
        val res = postJson(
            "/api/privacy/consent",
            """{"type":"LEARNER_DATA_PROCESSING","subjectUserId":${learner.id}}""",
            session
        )
        assertEquals(201, res.status)
        assertEquals(learnerConsentId, res.body!!["id"].asLong(), "same consent must be returned, not a second row")
    }

    @Test
    @Order(5)
    fun `consent for an unlinked learner is refused`() {
        val session = login(otherGuardianEmail, "pass123")
        val res = postJson(
            "/api/privacy/consent",
            """{"type":"LEARNER_DATA_PROCESSING","subjectUserId":${learner.id}}""",
            session
        )
        assertEquals(403, res.status, res.bodyText)
    }

    @Test
    @Order(6)
    fun `consent for a learner with a revoked link is refused`() {
        val session = login(revokedLinkEmail, "pass123")
        val res = postJson(
            "/api/privacy/consent",
            """{"type":"LEARNER_DATA_PROCESSING","subjectUserId":${learner.id}}""",
            session
        )
        assertEquals(403, res.status, "a revoked link must not authorise consent on a child's behalf")
    }

    @Test
    @Order(7)
    fun `another guardian cannot withdraw someone else's consent`() {
        val session = login(otherGuardianEmail, "pass123")
        val res = postJson("/api/privacy/consent/$learnerConsentId/withdraw", "{}", session)
        assertEquals(403, res.status, res.bodyText)
    }

    @Test
    @Order(8)
    fun `withdrawal keeps the history row and stamps withdrawnAt`() {
        val session = login(guardianEmail, "pass123")
        val res = postJson("/api/privacy/consent/$learnerConsentId/withdraw", "{}", session)
        assertEquals(200, res.status, res.bodyText)
        assertFalse(res.body!!["withdrawnAt"].isNull)
        assertTrue(
            consentRepo.findById(learnerConsentId).get().withdrawnAt != null,
            "withdrawal must not delete the proof that consent existed"
        )
        // After withdrawal the consent is no longer active.
        assertEquals(
            false,
            consentRepo.findByUserIdAndConsentTypeAndWithdrawnAtIsNull(
                userRepo.findByEmail(guardianEmail)!!.id, ConsentType.LEARNER_DATA_PROCESSING
            ).any { it.subjectUserId == learner.id }
        )
    }

    // ── Erasure ──────────────────────────────────────────────────────────────

    @Test
    @Order(9)
    fun `self erasure destroys identity, revokes access and keeps an evidence row`() {
        val erasedUser = userRepo.findByEmail(erasureEmail)!!
        // Give the account something to destroy: a live link and a live consent.
        guardianLinkRepo.save(GuardianLink(guardianId = erasedUser.id, learnerId = learner.id, relationship = "PARENT"))
        val session = login(erasureEmail, "pass123")
        postJson("/api/privacy/consent", """{"type":"GUARDIAN_DATA_PROCESSING"}""", session)

        val res = postJson("/api/privacy/erasure", """{"reason":"TEST_ERASURE"}""", session)
        assertEquals(200, res.status, res.bodyText)
        assertEquals(erasedUser.id, res.body!!["userId"].asLong())
        assertEquals(false, res.body!!["alreadyErased"].asBoolean())

        val reloaded = userRepo.findById(erasedUser.id).get()
        assertTrue(reloaded.email.startsWith(AccountErasureService.ERASED_EMAIL_PREFIX))
        assertTrue(reloaded.email.endsWith("@erased.invalid"))
        assertEquals(AccountErasureService.ERASED_NAME, reloaded.name)
        assertFalse(reloaded.active, "an erased account must not be able to log in")
        assertNull(reloaded.phone)
        assertNull(reloaded.gender)
        assertNull(userRepo.findByEmail(erasureEmail), "the original email must no longer resolve")

        val links = guardianLinkRepo.findByGuardianId(erasedUser.id)
        assertTrue(links.isNotEmpty())
        assertTrue(links.all { it.revokedAt != null }, "erasure must revoke every guardianship")

        val consents = consentRepo.findByUserIdOrderByGrantedAtDesc(erasedUser.id)
        assertTrue(consents.isNotEmpty())
        assertTrue(consents.all { it.withdrawnAt != null }, "erasure must withdraw active consents")

        assertTrue(erasureLogRepo.findByUserIdOrderByRequestedAtDesc(erasedUser.id).isNotEmpty())
    }

    @Test
    @Order(10)
    fun `erasing an already erased account is idempotent`() {
        // Erasure rewrites identity in the database, so the second call gets a
        // freshly loaded entity — exactly what the eraseByAdmin path does.
        val target = createUser("privacy-erase-twice@test.local", "pass123", "Erase Twice", UserRole.GUARDIAN)
        val first = erasureService.erase(target, target.id, "TEST_ERASURE")
        assertFalse(first.alreadyErased)

        val reloaded = userRepo.findById(target.id).get()
        val second = erasureService.erase(reloaded, target.id, "TEST_ERASURE")
        assertTrue(second.alreadyErased, "a second erasure must be recognised, not repeated")
        assertEquals(0, second.linksRevoked)
        assertEquals(
            2,
            erasureLogRepo.findByUserIdOrderByRequestedAtDesc(target.id).size,
            "both attempts must be evidenced"
        )
    }

    // ── Retention ────────────────────────────────────────────────────────────

    @Test
    @Order(11)
    fun `retention dry run reports without deleting, then the real sweep deletes`() {
        val staleNotification = notificationRepo.save(
            Notification(
                userId = learner.id,
                type = "TEST",
                title = "old",
                body = "old",
                createdAt = Instant.now().minus(RetentionService.NOTIFICATION_RETENTION_DAYS + 30, ChronoUnit.DAYS)
            )
        )
        val expiredReset = passwordResetTokenRepo.save(
            PasswordResetToken(
                userId = learner.id,
                tokenHash = "retention-test-${System.nanoTime()}",
                expiresAt = OffsetDateTime.now().minusDays(2)
            )
        )

        val dry = retentionService.run(dryRun = true)
        assertTrue(dry.dryRun)
        assertTrue(dry.totalDeleted >= 2, "dry run must count what it would remove: ${dry.totalDeleted}")
        assertTrue(notificationRepo.findById(staleNotification.id).isPresent, "dry run must not delete")
        assertTrue(passwordResetTokenRepo.findById(expiredReset.id).isPresent, "dry run must not delete")

        val real = retentionService.run(dryRun = false)
        assertFalse(real.dryRun)
        assertFalse(notificationRepo.findById(staleNotification.id).isPresent, "sweep must delete stale notifications")
        assertFalse(passwordResetTokenRepo.findById(expiredReset.id).isPresent, "sweep must delete expired reset tokens")
        assertTrue(real.totalDeleted >= 2)
    }

    @Test
    @Order(12)
    fun `retention is admin only and defaults to a dry run`() {
        val guardianSession = login(guardianEmail, "pass123")
        assertEquals(403, postJson("/api/admin/retention/run", "{}", guardianSession).status)

        val admin = createUser("privacy-admin@test.local", "pass123", "Privacy Admin", UserRole.ADMIN)
        val adminSession = login(admin.email, "pass123")
        assertEquals(200, get("/api/admin/retention/policy", adminSession).status)
        val run = postJson("/api/admin/retention/run", "{}", adminSession)
        assertEquals(200, run.status, run.bodyText)
        assertTrue(run.body!!["dryRun"].asBoolean(), "the manual endpoint must default to a dry run")
    }
}
