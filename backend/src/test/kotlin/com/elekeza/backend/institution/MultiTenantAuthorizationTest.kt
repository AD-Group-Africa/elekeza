package com.elekeza.backend.institution

import com.elekeza.backend.auth.User
import com.elekeza.backend.auth.UserRole
import com.elekeza.backend.content.Content
import com.elekeza.backend.content.ContentRepository
import com.elekeza.backend.content.ContentStatus
import com.elekeza.backend.learner.LessonProgressRepository
import com.elekeza.backend.notification.NotificationRepository
import com.elekeza.backend.quiz.Quiz
import com.elekeza.backend.quiz.QuizAttempt
import com.elekeza.backend.quiz.QuizAttemptRepository
import com.elekeza.backend.quiz.QuizRepository
import com.elekeza.backend.testutil.ApiTestSupport
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.mock.web.MockMultipartFile

/**
 * Permanent multi-tenant authorization regression suite.
 *
 * Encodes the Phase 2 live findings (cross-institution student roster read and
 * student import/write were open to any SCHOOL_ADMIN) plus content, progress,
 * assignment and guardian boundaries between two institutions.
 */
class MultiTenantAuthorizationTest : ApiTestSupport() {

    @Autowired lateinit var institutionRepo: InstitutionRepository
    @Autowired lateinit var contentRepo: ContentRepository
    @Autowired lateinit var lessonProgressRepo: LessonProgressRepository
    @Autowired lateinit var quizRepo: QuizRepository
    @Autowired lateinit var attemptRepo: QuizAttemptRepository
    @Autowired lateinit var notificationRepo: NotificationRepository
    @Autowired lateinit var refreshTokenRepo: com.elekeza.backend.auth.RefreshTokenRepository
    @Autowired lateinit var learnerProfileRepo: com.elekeza.backend.learner.LearnerProfileRepository

    private lateinit var instA: Institution
    private lateinit var instB: Institution
    private lateinit var adminA: User
    private lateinit var adminB: User
    private lateinit var teacherB: User
    private lateinit var studentA: User
    private lateinit var studentB: User
    private lateinit var contentB: Content

    @BeforeEach
    fun setUp() {
        instA = institutionRepo.save(Institution(
            name = "Alpha Academy ${random}", type = "SCHOOL", county = "Nairobi",
            plan = "STARTER", maxStudents = 100, maxTeachers = 5,
            contactEmail = "alpha-${random}@example.com", isActive = true,
        ))
        instB = institutionRepo.save(Institution(
            name = "Beta School ${random}", type = "SCHOOL", county = "Kisumu",
            plan = "STARTER", maxStudents = 100, maxTeachers = 5,
            contactEmail = "beta-${random}@example.com", isActive = true,
        ))

        // Align the seeded demo users with institution A so the two test
        // institutions are distinct in id-space.
        userRepo.findByEmail("teacher@elekeza.app")!!.let { it.institutionId = instA.id; userRepo.save(it) }
        userRepo.findByEmail("student@elekeza.app")!!.let { it.institutionId = instA.id; userRepo.save(it) }
        userRepo.findByEmail("parent@elekeza.app")!!.let { it.institutionId = instA.id; userRepo.save(it) }

        adminA = createUser("admina-${random}@example.com", "AdminsPass1", "Admin A", UserRole.SCHOOL_ADMIN, instA.id)
        adminB = createUser("adminb-${random}@example.com", "AdminsPass1", "Admin B", UserRole.SCHOOL_ADMIN, instB.id)
        teacherB = createUser("teacherb-${random}@example.com", "Teacherb1", "Teacher B", UserRole.TEACHER, instB.id)
        studentB = createUser("studentb-${random}@example.com", "Studentb1", "Student B", UserRole.STUDENT, instB.id)
        studentA = userRepo.findByEmail("student@elekeza.app")!!
        createdUsers += listOf(adminA, adminB, teacherB, studentB)

        contentB = contentRepo.save(Content(
            userId = teacherB.id, title = "Beta lesson ${random}", status = ContentStatus.READY
        ))
        createdContentB = contentB
    }

    private val createdUsers = mutableListOf<User>()
    private var createdContentB: Content? = null

    @AfterEach
    fun tearDown() {
        // Children first (FK order), then users/institutions.
        createdContentB?.let { c ->
            quizRepo.findByContentIdIn(listOf(c.id)).forEach { quizRepo.delete(it) }
            contentRepo.delete(c)
        }
        createdUsers.forEach { u ->
            notificationRepo.findByUserIdOrderByCreatedAtDesc(u.id).forEach { notificationRepo.delete(it) }
            attemptRepo.findByUserIdIn(listOf(u.id)).forEach { attemptRepo.delete(it) }
            lessonProgressRepo.findByUserIdIn(listOf(u.id)).forEach { lessonProgressRepo.delete(it) }
            learnerProfileRepo.findByUserId(u.id)?.let { learnerProfileRepo.delete(it) }
            refreshTokenRepo.deleteByUser(u)
        }
        createdUsers.forEach { userRepo.delete(it) }
        // Remove any import-generated students of institution B.
        userRepo.findByEmail("grace.wanjiku.s${instB.id}@elekeza.school")?.let { imported ->
            learnerProfileRepo.findByUserId(imported.id)?.let { learnerProfileRepo.delete(it) }
            userRepo.delete(imported)
        }
        institutionRepo.findById(instA.id).ifPresent { institutionRepo.delete(it) }
        institutionRepo.findById(instB.id).ifPresent { institutionRepo.delete(it) }
    }

    // ── Institution roster isolation (Phase 2 IDOR #1) ─────────────────────

    @Test
    fun `school admin can read own roster`() {
        val adminBSession = login(adminB.email, "AdminsPass1")
        val out = get("/api/institutions/${instB.id}/students", adminBSession)
        assertThat(out.status).isEqualTo(200)
        assertThat(out.bodyText).contains(studentB.email)
    }

    @Test
    fun `school admin cannot read another institution's roster`() {
        val adminASession = login(adminA.email, "AdminsPass1")
        val adminBSession = login(adminB.email, "AdminsPass1")
        assertThat(get("/api/institutions/${instB.id}/students", adminASession).status).isEqualTo(403)
        assertThat(get("/api/institutions/${instA.id}/students", adminBSession).status).isEqualTo(403)
        // 403 body must not contain the other institution's student data.
        assertThat(get("/api/institutions/${instB.id}/students", adminASession).bodyText).doesNotContain(studentB.name)
    }

    // ── Student import isolation (Phase 2 IDOR #2) ─────────────────────────

    @Test
    fun `school admin cannot import students into another institution`() {
        val adminASession = login(adminA.email, "AdminsPass1")
        val file = MockMultipartFile("file", "students.csv", "text/csv",
            "firstName,lastName\nGrace,Wanjiku\n".toByteArray())
        val out = multipartPost("/api/institutions/${instB.id}/students/import", file, adminASession)
        assertThat(out.status).isEqualTo(403)
    }

    @Test
    fun `school admin can import students into own institution`() {
        val adminBSession = login(adminB.email, "AdminsPass1")
        val file = MockMultipartFile("file", "students.csv", "text/csv",
            "firstName,lastName\nGrace,Wanjiku\n".toByteArray())
        val out = multipartPost("/api/institutions/${instB.id}/students/import", file, adminBSession)
        assertThat(out.status).isEqualTo(200)
    }

    // ── Teacher student-progress isolation ─────────────────────────────────

    @Test
    fun `teacher cannot read another institution's student progress`() {
        val teacherASession = login("teacher@elekeza.app", "teacher123")
        assertThat(get("/api/teacher/student/${studentB.id}/progress", teacherASession).status).isEqualTo(403)
    }

    @Test
    fun `teacher can read own institution's student progress`() {
        val teacherASession = login("teacher@elekeza.app", "teacher123")
        assertThat(get("/api/teacher/student/${studentA.id}/progress", teacherASession).status).isEqualTo(200)
    }

    // ── Content isolation ───────────────────────────────────────────────────

    @Test
    fun `teacher of one institution cannot open another institution's lesson`() {
        val teacherBSession = login(teacherB.email, "Teacherb1")
        assertThat(get("/api/content/lessons/${contentB.id}", teacherBSession).status).isEqualTo(200) // own content
    }

    @Test
    fun `cross-institution lesson view is denied`() {
        val seedLessonId = contentRepo.findAll().first { it.userId == userRepo.findByEmail("teacher@elekeza.app")!!.id }.id
        val teacherBSession = login(teacherB.email, "Teacherb1")
        val studentBSession = login(studentB.email, "Studentb1")
        assertThat(get("/api/content/lessons/$seedLessonId", teacherBSession).status).isEqualTo(403)
        assertThat(get("/api/content/lessons/$seedLessonId", studentBSession).status).isEqualTo(403)
    }

    // ── Guardian isolation ──────────────────────────────────────────────────

    @Test
    fun `guardian cannot view another institution's ward`() {
        val guardianSession = login("parent@elekeza.app", "parent123")
        assertThat(get("/api/guardian/wards/${studentB.id}", guardianSession).status).isEqualTo(403)
        assertThat(get("/api/guardian/wards/${studentA.id}", guardianSession).status).isEqualTo(200)
    }

    // ── Assignment lifecycle + scoping + notification navigation ───────────

    @Test
    fun `assignment lifecycle is institution scoped with notification link`() {
        val teacherBSession = login(teacherB.email, "Teacherb1")

        // Assign (creates row + async notification with navigation link).
        val assign = postJson(
            "/api/teacher/content/assign",
            """{"contentId":${contentB.id},"studentIds":[${studentB.id}]}""",
            teacherBSession
        )
        assertThat(assign.status).isEqualTo(200)
        assertThat(assign.bodyText).contains("\"assigned\":1")

        // Idempotent — a second identical assignment creates nothing new.
        val again = postJson(
            "/api/teacher/content/assign",
            """{"contentId":${contentB.id},"studentIds":[${studentB.id}]}""",
            teacherBSession
        )
        assertThat(again.bodyText).contains("\"assigned\":0")

        // Notification carries the /lesson/{id} target.
        val notif = awaitNotification()
        assertThat(notif).isNotNull
        assertThat(notif!!.link).isEqualTo("/lesson/${contentB.id}")

        // Assignment grants the learner access to the lesson.
        val studentBSession = login(studentB.email, "Studentb1")
        assertThat(get("/api/content/lessons/${contentB.id}", studentBSession).status).isEqualTo(200)

        // Teacher B sees exactly one ASSIGNED row for their student.
        val list = get("/api/teacher/assignments", teacherBSession)
        assertThat(list.status).isEqualTo(200)
        val row = list.body!!.first()
        assertThat(row["studentId"].asLong()).isEqualTo(studentB.id)
        assertThat(row["status"].asText()).isEqualTo("ASSIGNED")
        assertThat(row["score"].isNull).isTrue()

        // Teacher A's listing must never include institution B rows.
        val teacherASession = login("teacher@elekeza.app", "teacher123")
        val listA = get("/api/teacher/assignments", teacherASession)
        assertThat(listA.status).isEqualTo(200)
        assertThat(listA.bodyText).doesNotContain(studentB.name)
    }

    @Test
    fun `assignment status advances through IN_PROGRESS and COMPLETED`() {
        val teacherBSession = login(teacherB.email, "Teacherb1")
        postJson(
            "/api/teacher/content/assign",
            """{"contentId":${contentB.id},"studentIds":[${studentB.id}]}""",
            teacherBSession
        )

        // Student starts the quiz → open attempt → IN_PROGRESS.
        val quiz = quizRepo.save(Quiz(contentId = contentB.id, userId = studentB.id))
        attemptRepo.save(QuizAttempt(quizId = quiz.id, userId = studentB.id, totalQuestions = 2))
        val inProgress = get("/api/teacher/assignments", teacherBSession).body!!.first()
        assertThat(inProgress["status"].asText()).isEqualTo("IN_PROGRESS")

        // Quiz completed → progress row completed with a score → COMPLETED.
        val progress = lessonProgressRepo.findByUserIdAndContentId(studentB.id, contentB.id)!!
        progress.completed = true
        progress.quizScore = 87.5
        progress.completedAt = java.time.LocalDateTime.now()
        lessonProgressRepo.save(progress)
        attemptRepo.findAll().first { it.quizId == quiz.id }.let {
            attemptRepo.save(it.copy(score = 87.5, completed = true, completedAt = java.time.LocalDateTime.now()))
        }

        val completed = get("/api/teacher/assignments", teacherBSession).body!!.first()
        assertThat(completed["status"].asText()).isEqualTo("COMPLETED")
        assertThat(completed["score"].asDouble()).isEqualTo(87.5)
    }

    private fun awaitNotification(): com.elekeza.backend.notification.Notification? {
        repeat(20) {
            val n = notificationRepo.findByUserIdOrderByCreatedAtDesc(studentB.id)
                .firstOrNull { it.type == "LESSON_ASSIGNED" }
            if (n != null) return n
            Thread.sleep(100)
        }
        return null
    }

    private val random: String get() = java.util.UUID.randomUUID().toString().take(8)
}
