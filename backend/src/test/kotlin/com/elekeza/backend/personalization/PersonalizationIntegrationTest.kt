package com.elekeza.backend.personalization

import com.elekeza.backend.auth.User
import com.elekeza.backend.auth.UserRole
import com.elekeza.backend.content.Content
import com.elekeza.backend.content.ContentRepository
import com.elekeza.backend.content.ContentStatus
import com.elekeza.backend.institution.GuardianLink
import com.elekeza.backend.institution.GuardianLinkRepository
import com.elekeza.backend.institution.Institution
import com.elekeza.backend.institution.InstitutionRepository
import com.elekeza.backend.learner.LessonProgress
import com.elekeza.backend.learner.LessonProgressRepository
import com.elekeza.backend.notification.NotificationRepository
import com.elekeza.backend.testutil.ApiTestSupport
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired

/**
 * Integration coverage for the per-student personalization stack:
 *
 *  - learner preference persistence + EXPLICIT precedence,
 *  - teacher guidance (never silently overriding an explicit learner choice),
 *  - guardian plain-language summaries,
 *  - cross-institution isolation of profiles, adaptations and summaries,
 *  - adaptation generation + caching + original availability,
 *  - feedback → observed-signal accumulation → teacher support summary,
 *  - attributable audit events.
 */
class PersonalizationIntegrationTest : ApiTestSupport() {

    @Autowired lateinit var institutionRepo: InstitutionRepository
    @Autowired lateinit var contentRepo: ContentRepository
    @Autowired lateinit var lessonProgressRepo: LessonProgressRepository
    @Autowired lateinit var guardianLinkRepo: GuardianLinkRepository
    @Autowired lateinit var learnerProfileRepo: com.elekeza.backend.learner.LearnerProfileRepository
    @Autowired lateinit var adaptRepo: ContentAdaptationRepository
    @Autowired lateinit var eventRepo: AdaptationEventRepository
    @Autowired lateinit var notificationRepo: NotificationRepository
    @Autowired lateinit var refreshTokenRepo: com.elekeza.backend.auth.RefreshTokenRepository

    private lateinit var instA: Institution
    private lateinit var instB: Institution
    private lateinit var teacherA: User
    private lateinit var learnerA: User
    private lateinit var guardianA: User
    private lateinit var teacherB: User
    private lateinit var learnerB: User
    private lateinit var lesson: Content

    private val createdUsers = mutableListOf<User>()
    private val createdLinks = mutableListOf<GuardianLink>()
    private var createdLesson: Content? = null

    private val rawText = "Fractions are parts of a whole. " +
        "The numerator counts the parts you have. " +
        "The denominator shows how many equal parts make the whole."

    @BeforeEach
    fun setUp() {
        instA = institutionRepo.save(Institution(
            name = "Unity High ${random}", type = "SCHOOL", county = "Nairobi",
            plan = "STARTER", maxStudents = 100, maxTeachers = 5,
            contactEmail = "unity-${random}@example.com", isActive = true,
        ))
        instB = institutionRepo.save(Institution(
            name = "Summit Academy ${random}", type = "SCHOOL", county = "Mombasa",
            plan = "STARTER", maxStudents = 100, maxTeachers = 5,
            contactEmail = "summit-${random}@example.com", isActive = true,
        ))
        teacherA = createUser("teachA-${random}@example.com", "TeacherA1", "Mrs Nyambura", UserRole.TEACHER, instA.id)
        learnerA = createUser("learnerA-${random}@example.com", "LearnerA1", "Achieng", UserRole.STUDENT, instA.id)
        guardianA = createUser("guardA-${random}@example.com", "GuardianA1", "Mr Achieng", UserRole.GUARDIAN, instA.id)
        teacherB = createUser("teachB-${random}@example.com", "TeacherB1", "Mr Otieno", UserRole.TEACHER, instB.id)
        learnerB = createUser("learnerB-${random}@example.com", "LearnerB1", "Baraka", UserRole.STUDENT, instB.id)
        createdUsers += listOf(teacherA, learnerA, guardianA, teacherB, learnerB)

        lesson = contentRepo.save(Content(
            userId = teacherA.id, title = "Intro to fractions ${random}",
            status = ContentStatus.READY, rawText = rawText, wordCount = rawText.split(" ").size
        ))
        createdLesson = lesson
        // An assignment row grants learnerA access (mirrors the real flow).
        lessonProgressRepo.save(LessonProgress(user = learnerA, contentId = lesson.id))
        val link = guardianLinkRepo.save(GuardianLink(guardianId = guardianA.id, learnerId = learnerA.id, relationship = "PARENT"))
        createdLinks += link
    }

    @AfterEach
    fun tearDown() {
        createdLinks.forEach { guardianLinkRepo.delete(it) }
        createdUsers.forEach { u ->
            eventRepo.findByLearnerIdAndContentIdOrderByCreatedAtDesc(u.id, null).forEach { eventRepo.delete(it) }
            adaptRepo.findAll().filter { it.learnerId == u.id }.forEach { adaptRepo.delete(it) }
            notificationRepo.findByUserIdOrderByCreatedAtDesc(u.id).forEach { notificationRepo.delete(it) }
            lessonProgressRepo.findByUserIdIn(listOf(u.id)).forEach { lessonProgressRepo.delete(it) }
            learnerProfileRepo.findByUserId(u.id)?.let { learnerProfileRepo.delete(it) }
            refreshTokenRepo.deleteByUser(u)
        }
        createdLesson?.let { contentRepo.delete(it) }
        createdUsers.forEach { userRepo.delete(it) }
        institutionRepo.findById(instA.id).ifPresent { institutionRepo.delete(it) }
        institutionRepo.findById(instB.id).ifPresent { institutionRepo.delete(it) }
    }

    // ── Learner preferences ────────────────────────────────────────────────

    @Test
    fun `learner sees sensible SYSTEM defaults before configuring anything`() {
        val session = login(learnerA.email, "LearnerA1")
        val out = get("/api/learner/preferences", session)
        assertThat(out.status).isEqualTo(200)
        val effective = out.body!!["effective"]
        assertThat(effective!!.size()).isEqualTo(7)
        assertThat(effective["explanationStyle"]!!["source"].asText()).isEqualTo("SYSTEM")
        assertThat(effective["explanationStyle"]!!["value"].asText()).isEqualTo("CONCISE")
    }

    @Test
    fun `learner explicit preference persists as EXPLICIT`() {
        val session = login(learnerA.email, "LearnerA1")
        val put = putJson("/api/learner/preferences", """{"key":"explanationStyle","value":"STEP_BY_STEP"}""", session)
        assertThat(put.status).isEqualTo(200)
        assertThat(put.body!!["source"].asText()).isEqualTo("EXPLICIT")
        val again = get("/api/learner/preferences", session)
        assertThat(again.body!!["effective"]["explanationStyle"]["value"].asText()).isEqualTo("STEP_BY_STEP")
        assertThat(again.body!!["effective"]["explanationStyle"]["source"].asText()).isEqualTo("EXPLICIT")
    }

    @Test
    fun `invalid preference value is rejected with 400`() {
        val session = login(learnerA.email, "LearnerA1")
        val put = putJson("/api/learner/preferences", """{"key":"explanationStyle","value":"MAGIC"}""", session)
        assertThat(put.status).isEqualTo(400)
    }

    // ── Teacher guidance + precedence ──────────────────────────────────────

    @Test
    fun `teacher guidance is recorded with TEACHER source`() {
        val session = login(teacherA.email, "TeacherA1")
        val guide = postJson(
            "/api/teacher/student/${learnerA.id}/learning-preferences",
            """{"key":"exampleFrequency","value":"HIGH"}""", session
        )
        assertThat(guide.status).isEqualTo(200)
        assertThat(guide.body!!["source"].asText()).isEqualTo("TEACHER")
        // Learner sees the guidance as the effective value but never as their own choice.
        val learnerSession = login(learnerA.email, "LearnerA1")
        assertThat(get("/api/learner/preferences", learnerSession).body!!["effective"]["exampleFrequency"]["value"].asText())
            .isEqualTo("HIGH")
    }

    @Test
    fun `teacher guidance cannot silently override an explicit learner choice`() {
        val learnerSession = login(learnerA.email, "LearnerA1")
        putJson("/api/learner/preferences", """{"key":"density","value":"SPACIOUS"}""", learnerSession)

        val teacherSession = login(teacherA.email, "TeacherA1")
        val guide = postJson(
            "/api/teacher/student/${learnerA.id}/learning-preferences",
            """{"key":"density","value":"COMPACT"}""", teacherSession
        )
        // 409 conflict: the learner chose it themselves.
        assertThat(guide.status).isEqualTo(409)
        // And the learner's choice still stands.
        assertThat(get("/api/learner/preferences", learnerSession).body!!["effective"]["density"]["value"].asText())
            .isEqualTo("SPACIOUS")
    }

    @Test
    fun `learner can always change their own mind`() {
        val learnerSession = login(learnerA.email, "LearnerA1")
        putJson("/api/learner/preferences", """{"key":"density","value":"SPACIOUS"}""", learnerSession)
        putJson("/api/learner/preferences", """{"key":"density","value":"COMPACT"}""", learnerSession)
        assertThat(get("/api/learner/preferences", learnerSession).body!!["effective"]["density"]["value"].asText())
            .isEqualTo("COMPACT")
    }

    // ── Teacher support summary ─────────────────────────────────────────────

    @Test
    fun `teacher sees support summary without diagnostic labels`() {
        val session = login(teacherA.email, "TeacherA1")
        val summary = get("/api/teacher/student/${learnerA.id}/learning-support", session)
        assertThat(summary.status).isEqualTo(200)
        assertThat(summary.body!!["studentName"].asText()).isEqualTo("Achieng")
        assertThat(summary.body!!.has("respondsWellTo")).isTrue()
        assertThat(summary.body!!.has("currentlyBenefitsFrom")).isTrue()
        // Never expose psychological labels.
        assertThat(summary.bodyText.lowercase()).doesNotContain("dyslexia", "adhd", "autistic", "disability", "diagnos")
    }

    @Test
    fun `teacher cannot view or guide another institution's learner`() {
        val teacherBSession = login(teacherB.email, "TeacherB1")
        assertThat(get("/api/teacher/student/${learnerA.id}/learning-support", teacherBSession).status).isEqualTo(403)
        assertThat(postJson(
            "/api/teacher/student/${learnerA.id}/learning-preferences",
            """{"key":"density","value":"SPACIOUS"}""", teacherBSession
        ).status).isEqualTo(403)
    }

    @Test
    fun `learner cannot read another learner's profile or act as teacher`() {
        val learnerBSession = login(learnerB.email, "LearnerB1")
        assertThat(get("/api/teacher/student/${learnerA.id}/learning-support", learnerBSession).status).isEqualTo(403)
        assertThat(get("/api/guardian/wards/${learnerA.id}/learning-support", learnerBSession).status).isEqualTo(403)
    }

    // ── Guardian summary ────────────────────────────────────────────────────

    @Test
    fun `guardian sees plain-language summary for own ward only`() {
        val session = login(guardianA.email, "GuardianA1")
        val out = get("/api/guardian/wards/${learnerA.id}/learning-support", session)
        assertThat(out.status).isEqualTo(200)
        assertThat(out.body!!["wardName"].asText()).isEqualTo("Achieng")
        assertThat(out.body!!["summary"].asText()).contains("Elekeza is presenting lessons in a way that suits Achieng")
        // Another ward (different institution) → 403.
        assertThat(get("/api/guardian/wards/${learnerB.id}/learning-support", session).status).isEqualTo(403)
    }

    // ── Adaptation engine ───────────────────────────────────────────────────

    @Test
    fun `learner gets a deterministic step-by-step variant and original stays available`() {
        val session = login(learnerA.email, "LearnerA1")
        val out = get("/api/content/lessons/${lesson.id}/adapted?code=step_by_step", session)
        assertThat(out.status).isEqualTo(200)
        assertThat(out.body!!["code"].asText()).isEqualTo("step_by_step")
        assertThat(out.body!!["source"].asText()).isEqualTo("LOCAL")
        assertThat(out.body!!["text"].asText()).contains("Step 1")
        // All three source sentences are present (no curriculum loss).
        assertThat(out.body!!["text"].asText()).contains("numerator", "denominator", "equal parts")

        val original = get("/api/content/lessons/${lesson.id}/adapted?code=original", session)
        assertThat(original.body!!["text"].asText()).isEqualTo(rawText)
    }

    @Test
    fun `second identical request is served from cache`() {
        val session = login(learnerA.email, "LearnerA1")
        val first = get("/api/content/lessons/${lesson.id}/adapted?code=spaced", session)
        assertThat(first.body!!["cached"].asBoolean()).isFalse()
        val second = get("/api/content/lessons/${lesson.id}/adapted?code=spaced", session)
        assertThat(second.body!!["cached"].asBoolean()).isTrue()
        assertThat(second.body!!["text"].asText()).isEqualTo(first.body!!["text"].asText())
    }

    @Test
    fun `cross-institution lesson cannot be adapted`() {
        val learnerBSession = login(learnerB.email, "LearnerB1")
        val teacherBSession = login(teacherB.email, "TeacherB1")
        assertThat(get("/api/content/lessons/${lesson.id}/adapted?code=clearer", learnerBSession).status).isEqualTo(403)
        assertThat(get("/api/content/lessons/${lesson.id}/adapted?code=clearer", teacherBSession).status).isEqualTo(403)
    }

    @Test
    fun `unknown adaptation code is a client error`() {
        val session = login(learnerA.email, "LearnerA1")
        assertThat(get("/api/content/lessons/${lesson.id}/adapted?code=madlibs", session).status).isEqualTo(400)
    }

    @Test
    fun `lesson stored only as structured JSON is adaptable too`() {
        // Mirrors seeded/demo lessons: no raw_text, readable content lives in
        // the simplified_text JSON the lesson page renders.
        val jsonOnly = contentRepo.save(Content(
            userId = teacherA.id, title = "The Water Cycle ${random}",
            status = ContentStatus.READY,
            simplifiedText = """{"lesson":{"title":"The Water Cycle","sections":[{"heading":"How Water Moves","body":"Water moves around the Earth. The sun heats it and turns it into vapor."},{"heading":"Clouds Form","body":"Vapor rises and makes clouds. When clouds get heavy, rain falls."}],"key_terms":[{"term":"Evaporation","definition":"When heat turns water into invisible vapor."}]}}"""
        ))
        lessonProgressRepo.save(LessonProgress(user = learnerA, contentId = jsonOnly.id))
        try {
            val session = login(learnerA.email, "LearnerA1")
            val adapted = get("/api/content/lessons/${jsonOnly.id}/adapted?code=step_by_step", session)
            assertThat(adapted.status).isEqualTo(200)
            assertThat(adapted.body!!["text"].asText()).contains("Step 1")
            // Curriculum content is preserved, not invented.
            val text = adapted.body!!["text"].asText()
            assertThat(text).contains("sun", "vapor", "clouds", "Evaporation")
            val original = get("/api/content/lessons/${jsonOnly.id}/adapted?code=original", session)
            assertThat(original.status).isEqualTo(200)
            assertThat(original.body!!["text"].asText()).contains("Water moves around the Earth", "When heat turns water into invisible vapor")
        } finally {
            contentRepo.delete(jsonOnly)
        }
    }

    // ── Feedback loop ───────────────────────────────────────────────────────

    @Test
    fun `consistent helpful feedback surfaces in teacher support summary`() {
        val session = login(learnerA.email, "LearnerA1")
        repeat(3) {
            val fb = postJson(
                "/api/content/lessons/${lesson.id}/feedback",
                """{"helpful":true,"code":"step_by_step"}""", session
            )
            assertThat(fb.status).isEqualTo(200)
        }
        val teacherSession = login(teacherA.email, "TeacherA1")
        val summary = get("/api/teacher/student/${learnerA.id}/learning-support", teacherSession)
        assertThat(summary.status).isEqualTo(200)
        assertThat(summary.body!!["respondsWellTo"].toString()).contains("Step-by-step")
        assertThat(summary.body!!["aiConfidence"].asText()).isEqualTo("High")
    }

    @Test
    fun `every adaptation and feedback event is attributable`() {
        val session = login(learnerA.email, "LearnerA1")
        get("/api/content/lessons/${lesson.id}/adapted?code=clearer", session)
        postJson("/api/content/lessons/${lesson.id}/feedback", """{"helpful":true,"code":"clearer"}""", session)
        val events = eventRepo.findByLearnerIdAndContentIdOrderByCreatedAtDesc(learnerA.id, lesson.id)
        assertThat(events.map { it.eventType }).contains("ADAPT_GENERATED", "FEEDBACK")
        assertThat(events.all { it.learnerId == learnerA.id }).isTrue()
    }

    private val random: String get() = java.util.UUID.randomUUID().toString().take(8)
}
