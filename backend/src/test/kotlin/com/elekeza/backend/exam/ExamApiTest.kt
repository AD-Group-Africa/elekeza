package com.elekeza.backend.exam

import com.elekeza.backend.auth.UserRole
import com.elekeza.backend.auth.LoginRateLimiter
import com.elekeza.backend.institution.GuardianLink
import com.elekeza.backend.institution.GuardianLinkRepository
import com.elekeza.backend.testutil.ApiTestSupport
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.status
import org.junit.jupiter.api.Assertions.*

/**
 * HTTP-level exam module tests: RBAC, attempt state machine, server-side
 * timing, marking, guardian scoping and IDOR — all through the real
 * Spring Security chain (same path production uses).
 *
 * Each test uses its own unique accounts and clears the login rate limiter
 * in @BeforeEach (test isolation only — production limits are untouched).
 */
class ExamApiTest : ApiTestSupport() {

    @Autowired lateinit var attemptRepo: ExamAttemptRepository
    @Autowired lateinit var guardianLinkRepo: GuardianLinkRepository
    @Autowired lateinit var loginRateLimiter: LoginRateLimiter

    @BeforeEach
    fun resetLimiter() {
        loginRateLimiter.clear()
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private fun examPayload(
        title: String,
        questions: String = """
            [
              {"question":"What is 1/2 + 1/2?","qtype":"MCQ","options":["1/4","1","2","3/4"],"correctOption":"B","marks":2},
              {"question":"Kenya is in Africa.","qtype":"TRUE_FALSE","correctOption":"A","marks":1},
              {"question":"Name the largest planet.","qtype":"SHORT_ANSWER","correctText":"Jupiter","marks":2}
            ]
        """.trimIndent()
    ): String = """
        {"title":"$title","subject":"Mathematics","durationMinutes":30,"maxAttempts":1,"questions":$questions}
    """.trimIndent()

    private fun teacher(email: String) = login(email, "pass123")

    /** Creates a full cast for one test and returns their emails. */
    private data class Cast(val teacher: String, val student: String, val student2: String?, val guardian: String?)

    private fun makeCast(n: Int, withSecondStudent: Boolean = false, withGuardian: Boolean = false): Cast {
        createUser("exam.t$n@test.elekeza", "pass123", "Teacher $n", UserRole.TEACHER, institutionId = 1L)
        createUser("exam.s$n@test.elekeza", "pass123", "Student $n", UserRole.STUDENT, institutionId = 1L)
        var s2: String? = null
        var g: String? = null
        if (withSecondStudent) {
            createUser("exam.s${n}b@test.elekeza", "pass123", "Student ${n}b", UserRole.STUDENT, institutionId = 1L)
            s2 = "exam.s${n}b@test.elekeza"
        }
        if (withGuardian) {
            createUser("exam.g$n@test.elekeza", "pass123", "Guardian $n", UserRole.GUARDIAN, institutionId = 1L)
            g = "exam.g$n@test.elekeza"
        }
        return Cast("exam.t$n@test.elekeza", "exam.s$n@test.elekeza", s2, g)
    }

    private fun publishedExam(teacherEmail: String, title: String): Long {
        val t = teacher(teacherEmail)
        val examId = postJson("/api/exams", examPayload(title), t).body!!["id"].asLong()
        postJson("/api/exams/$examId/publish", "{}", t)
        return examId
    }

    // ── Authoring + RBAC ──────────────────────────────────────────────────────

    @Test
    fun `teacher creates, publishes and student sees exam`() {
        val c = makeCast(1)
        val t = teacher(c.teacher)

        val created = postJson("/api/exams", examPayload("Fractions Test"), t)
        status().isCreated.match(created.result)
        val examId = created.body!!["id"].asLong()
        assertEquals(3, created.body!!["questions"].size())

        val published = postJson("/api/exams/$examId/publish", "{}", t)
        status().isOk.match(published.result)
        assertEquals("PUBLISHED", published.body!!["status"].asText())

        val s = teacher(c.student)
        val avail = get("/api/exams/available", s)
        status().isOk.match(avail.result)
        assertTrue(avail.body!!.any { it["id"].asLong() == examId })
    }

    @Test
    fun `cannot publish exam without questions`() {
        val c = makeCast(2)
        val t = teacher(c.teacher)
        val created = postJson("/api/exams", """{"title":"Empty","subject":"Any","durationMinutes":10,"questions":[]}""", t)
        status().isCreated.match(created.result)
        val examId = created.body!!["id"].asLong()
        val res = postJson("/api/exams/$examId/publish", "{}", t)
        status().isConflict.match(res.result)
    }

    @Test
    fun `only drafts can be edited and deleted`() {
        val c = makeCast(3)
        val t = teacher(c.teacher)
        val examId = postJson("/api/exams", examPayload("Editable"), t).body!!["id"].asLong()
        postJson("/api/exams/$examId/publish", "{}", t)

        val edit = putJson("/api/exams/$examId", """{"title":"Changed"}""", t)
        status().isConflict.match(edit.result)

        val del = delete("/api/exams/$examId", t)
        status().isConflict.match(del.result)
    }

    @Test
    fun `student cannot access authoring endpoints`() {
        val c = makeCast(4)
        val s = teacher(c.student)
        val res = postJson("/api/exams", examPayload("Nope"), s)
        status().isForbidden().match(res.result)
    }

    // ── Attempt lifecycle + server-authoritative timing ───────────────────────

    @Test
    fun `attempt lifecycle start answer submit score`() {
        val c = makeCast(5)
        val examId = publishedExam(c.teacher, "Lifecycle")

        val s = teacher(c.student)
        val start = postJson("/api/exams/$examId/start", "{}", s)
        status().isOk.match(start.result)
        val attemptId = start.body!!["attemptId"].asLong()
        assertTrue(start.body!!["remainingSeconds"].asLong() in 1..1800)
        assertEquals(3, start.body!!["questions"].size())

        val qIds = start.body!!["questions"].map { it["id"].asLong() }
        // MCQ B (correct, 2 marks), TRUE_FALSE B (wrong), short answer blank.
        postJson("/api/exams/attempts/$attemptId/answers", """{"questionId":${qIds[0]},"answer":"B"}""", s)
        postJson("/api/exams/attempts/$attemptId/answers", """{"questionId":${qIds[1]},"answer":"B"}""", s)

        val submit = postJson("/api/exams/attempts/$attemptId/submit", """{"answers":[]}""", s)
        status().isOk.match(submit.result)
        assertEquals("SUBMITTED", submit.body!!["status"].asText())
        assertEquals(2.0, submit.body!!["score"].asDouble())
        assertEquals(5, submit.body!!["totalMarks"].asInt())

        val results = get("/api/exams/results", s)
        assertTrue(results.body!!.any { it["attemptId"].asLong() == attemptId })
    }

    @Test
    fun `duplicate submission is rejected`() {
        val c = makeCast(6)
        val examId = publishedExam(c.teacher, "Dup")
        val s = teacher(c.student)
        val attemptId = postJson("/api/exams/$examId/start", "{}", s).body!!["attemptId"].asLong()
        postJson("/api/exams/attempts/$attemptId/submit", """{"answers":[]}""", s)

        val again = postJson("/api/exams/attempts/$attemptId/submit", """{"answers":[]}""", s)
        status().isConflict.match(again.result)
    }

    @Test
    fun `attempt limit enforced on second start`() {
        val c = makeCast(7)
        val examId = publishedExam(c.teacher, "Limit")
        val s = teacher(c.student)
        val a1 = postJson("/api/exams/$examId/start", "{}", s).body!!["attemptId"].asLong()
        postJson("/api/exams/attempts/$a1/submit", """{"answers":[]}""", s)
        val second = postJson("/api/exams/$examId/start", "{}", s)
        status().isConflict.match(second.result)
    }

    @Test
    fun `resuming in-progress attempt keeps original server expiry`() {
        val c = makeCast(8)
        val examId = publishedExam(c.teacher, "Resume")
        val s = teacher(c.student)
        val first = postJson("/api/exams/$examId/start", "{}", s).body!!
        val resumed = postJson("/api/exams/$examId/start", "{}", s).body!!
        assertEquals(first["attemptId"].asLong(), resumed["attemptId"].asLong())
        // DB timestamp precision may truncate below the JSON instant; compare with tolerance.
        val delta = java.time.Duration.between(
            java.time.Instant.parse(first["expiresAt"].asText()),
            java.time.Instant.parse(resumed["expiresAt"].asText())
        ).abs()
        assertTrue(delta.seconds < 1, "expiresAt drifted by $delta")
    }

    @Test
    fun `expired attempt is timed out by reconcile with auto-marking`() {
        val c = makeCast(9)
        val examId = publishedExam(c.teacher, "Timeout")
        val s = teacher(c.student)
        val attemptId = postJson("/api/exams/$examId/start", "{}", s).body!!["attemptId"].asLong()

        // Simulate expiry at the persistence layer (server clock is authoritative).
        val attempt = attemptRepo.findById(attemptId).get()
        attemptRepo.save(attempt.copy(expiresAt = java.time.Instant.now().minusSeconds(3600)))

        val results = get("/api/exams/results", s) // triggers reconcile
        status().isOk.match(results.result)
        val row = results.body!!.first { it["attemptId"].asLong() == attemptId }
        assertEquals("TIMED_OUT", row["status"].asText())
        assertNotNull(row["score"])
    }

    // ── Security: IDOR, cross-tenant, guardian scoping ────────────────────────

    @Test
    fun `student cannot start exam from another institution`() {
        createUser("exam.t10@test.elekeza", "pass123", "T10", UserRole.TEACHER, institutionId = 1L)
        createUser("exam.s10b@test.elekeza", "pass123", "S10b", UserRole.STUDENT, institutionId = 2L)
        val examId = publishedExam("exam.t10@test.elekeza", "Cross")

        val outsider = login("exam.s10b@test.elekeza", "pass123")
        val res = postJson("/api/exams/$examId/start", "{}", outsider)
        status().isForbidden().match(res.result)
    }

    @Test
    fun `student cannot submit another student's attempt`() {
        val c = makeCast(11, withSecondStudent = true)
        val examId = publishedExam(c.teacher, "IDOR")
        val owner = teacher(c.student)
        val other = teacher(c.student2!!)
        val attemptId = postJson("/api/exams/$examId/start", "{}", owner).body!!["attemptId"].asLong()

        val res = postJson("/api/exams/attempts/$attemptId/submit", """{"answers":[]}""", other)
        status().isForbidden().match(res.result)
    }

    @Test
    fun `guardian sees only own ward results`() {
        val c = makeCast(12, withSecondStudent = true, withGuardian = true)
        val wardA = userRepo.findByEmail(c.student)!!
        val guardianUser = userRepo.findByEmail(c.guardian!!)!!
        guardianLinkRepo.save(GuardianLink(guardianId = guardianUser.id, learnerId = wardA.id, relationship = "PARENT"))

        val examId = publishedExam(c.teacher, "Guardian")
        val wardACookie = teacher(c.student)
        val attemptId = postJson("/api/exams/$examId/start", "{}", wardACookie).body!!["attemptId"].asLong()
        postJson("/api/exams/attempts/$attemptId/submit", """{"answers":[]}""", wardACookie)

        val g = teacher(c.guardian)
        val ok = get("/api/exams/guardian/${wardA.id}/results", g)
        status().isOk.match(ok.result)
        assertTrue(ok.body!!.any { it["attemptId"].asLong() == attemptId })

        val wardB = userRepo.findByEmail(c.student2!!)!!
        val denied = get("/api/exams/guardian/${wardB.id}/results", g)
        status().isForbidden().match(denied.result)
    }

    @Test
    fun `teacher cannot read results of another institution's exam`() {
        createUser("exam.t13a@test.elekeza", "pass123", "T13a", UserRole.TEACHER, institutionId = 1L)
        createUser("exam.t13b@test.elekeza", "pass123", "T13b", UserRole.TEACHER, institutionId = 2L)
        val examId = publishedExam("exam.t13a@test.elekeza", "Secret")
        val t2 = login("exam.t13b@test.elekeza", "pass123")
        val res = get("/api/exams/$examId/results", t2)
        status().isForbidden().match(res.result)
    }

    @Test
    fun `integrity events are recorded and visible to staff only`() {
        val c = makeCast(14)
        val examId = publishedExam(c.teacher, "Integrity")
        val s = teacher(c.student)
        val attemptId = postJson("/api/exams/$examId/start", "{}", s).body!!["attemptId"].asLong()

        val rec = postJson("/api/exams/attempts/$attemptId/integrity", """{"eventType":"TAB_HIDDEN","detail":"switched tabs"}""", s)
        status().isNoContent.match(rec.result)

        val staffView = get("/api/exams/attempts/$attemptId/integrity", teacher(c.teacher))
        status().isOk.match(staffView.result)
        assertEquals("TAB_HIDDEN", staffView.body!![0]["eventType"].asText())

        val studentView = get("/api/exams/attempts/$attemptId/integrity", s)
        status().isForbidden().match(studentView.result)
    }

    // ── Manual marking of short answers ──────────────────────────────────────

    @Test
    fun `teacher marks short answer and total recalculates`() {
        val c = makeCast(15)
        val examId = publishedExam(c.teacher, "Marking")
        val s = teacher(c.student)
        val attemptId = postJson("/api/exams/$examId/start", "{}", s).body!!["attemptId"].asLong()
        val qIds = postJson("/api/exams/$examId/start", "{}", s).body!!["questions"].map { it["id"].asLong() }
        // Answer MCQ correctly (2), TF wrong, short answer text submitted.
        postJson("/api/exams/attempts/$attemptId/answers", """{"questionId":${qIds[0]},"answer":"B"}""", s)
        postJson("/api/exams/attempts/$attemptId/answers", """{"questionId":${qIds[1]},"answer":"B"}""", s)
        postJson("/api/exams/attempts/$attemptId/submit", """{"answers":[{"questionId":${qIds[2]},"answer":"Jupiter is the biggest"}]}""", s)

        // Before marking: score 2 (objective only).
        val before = get("/api/exams/results/$attemptId", s)
        status().isOk.match(before.result)
        assertEquals(2.0, before.body!!["score"].asDouble())

        // Teacher awards 2/2 with feedback.
        val mark = postJson("/api/exams/attempts/$attemptId/mark",
            """{"questionId":${qIds[2]},"marksAwarded":2,"feedback":"Good reasoning"}""", teacher(c.teacher))
        status().isOk.match(mark.result)
        assertEquals(4.0, mark.body!!["score"].asDouble())
        val short = mark.body!!["breakdown"].first { it["qtype"].asText() == "SHORT_ANSWER" }
        assertEquals(2.0, short["marksAwarded"].asDouble())
        assertEquals("Good reasoning", short["feedback"].asText())

        // Student sees the updated result and feedback.
        val after = get("/api/exams/results/$attemptId", s)
        assertEquals(4.0, after.body!!["score"].asDouble())
        assertEquals("Good reasoning", after.body!!["breakdown"].first { it["qtype"].asText() == "SHORT_ANSWER" }["feedback"].asText())
    }

    @Test
    fun `marking enforces bounds scope and state`() {
        val c = makeCast(16, withSecondStudent = true)
        val examId = publishedExam(c.teacher, "Bounds")
        val s = teacher(c.student)
        val attemptId = postJson("/api/exams/$examId/start", "{}", s).body!!["attemptId"].asLong()
        val qIds = postJson("/api/exams/$examId/start", "{}", s).body!!["questions"].map { it["id"].asLong() }
        postJson("/api/exams/attempts/$attemptId/submit", """{"answers":[{"questionId":${qIds[2]},"answer":"something"}]}""", s)

        // Negative marks rejected.
        val neg = postJson("/api/exams/attempts/$attemptId/mark", """{"questionId":${qIds[2]},"marksAwarded":-1}""", teacher(c.teacher))
        status().isBadRequest.match(neg.result)

        // Above max (question has 2 marks) rejected.
        val over = postJson("/api/exams/attempts/$attemptId/mark", """{"questionId":${qIds[2]},"marksAwarded":3}""", teacher(c.teacher))
        status().isBadRequest.match(over.result)

        // Objective question cannot be manually re-marked.
        val obj = postJson("/api/exams/attempts/$attemptId/mark", """{"questionId":${qIds[0]},"marksAwarded":0}""", teacher(c.teacher))
        status().isBadRequest.match(obj.result)

        // Another institution's teacher cannot mark.
        createUser("exam.t16b@test.elekeza", "pass123", "T16b", UserRole.TEACHER, institutionId = 2L)
        val outsider = login("exam.t16b@test.elekeza", "pass123")
        val cross = postJson("/api/exams/attempts/$attemptId/mark", """{"questionId":${qIds[2]},"marksAwarded":1}""", outsider)
        status().isForbidden.match(cross.result)

        // Student cannot mark.
        val byStudent = postJson("/api/exams/attempts/$attemptId/mark", """{"questionId":${qIds[2]},"marksAwarded":2}""", s)
        status().isForbidden().match(byStudent.result)
    }

    @Test
    fun `marking in-progress attempt is rejected`() {
        val c = makeCast(17)
        val examId = publishedExam(c.teacher, "InProgress")
        val s = teacher(c.student)
        val attemptId = postJson("/api/exams/$examId/start", "{}", s).body!!["attemptId"].asLong()
        val qIds = postJson("/api/exams/$examId/start", "{}", s).body!!["questions"].map { it["id"].asLong() }
        val res = postJson("/api/exams/attempts/$attemptId/mark", """{"questionId":${qIds[2]},"marksAwarded":1}""", teacher(c.teacher))
        status().isConflict.match(res.result)
    }

    @Test
    fun `answers are immutable after submission`() {
        val c = makeCast(18)
        val examId = publishedExam(c.teacher, "Immutable")
        val s = teacher(c.student)
        val attemptId = postJson("/api/exams/$examId/start", "{}", s).body!!["attemptId"].asLong()
        val qIds = postJson("/api/exams/$examId/start", "{}", s).body!!["questions"].map { it["id"].asLong() }
        postJson("/api/exams/attempts/$attemptId/submit", """{"answers":[{"questionId":${qIds[0]},"answer":"A"}]}""", s)

        // Late answer save must be rejected, not silently accepted.
        val late = postJson("/api/exams/attempts/$attemptId/answers", """{"questionId":${qIds[0]},"answer":"C"}""", s)
        status().isConflict.match(late.result)

        // And the recorded answer is unchanged in the result breakdown.
        val res = get("/api/exams/results/$attemptId", s)
        status().isOk.match(res.result)
        assertEquals("A", res.body!!["breakdown"].first { it["questionId"].asLong() == qIds[0] }["studentAnswer"].asText())
    }
}
