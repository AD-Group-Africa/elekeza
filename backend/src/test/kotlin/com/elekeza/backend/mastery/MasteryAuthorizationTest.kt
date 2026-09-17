package com.elekeza.backend.mastery

import com.elekeza.backend.auth.User
import com.elekeza.backend.auth.UserRepository
import com.elekeza.backend.auth.UserRole
import com.elekeza.backend.institution.InstitutionService
import com.elekeza.backend.learner.LessonProgress
import com.elekeza.backend.learner.LessonProgressRepository
import com.elekeza.backend.content.Content
import com.elekeza.backend.content.ContentRepository
import com.elekeza.backend.content.ContentStatus
import com.elekeza.backend.quiz.Quiz
import com.elekeza.backend.quiz.QuizAttempt
import com.elekeza.backend.quiz.QuizAttemptRepository
import com.elekeza.backend.quiz.QuizRepository
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.Assertions.assertThrows
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.security.crypto.password.PasswordEncoder
import org.springframework.web.server.ResponseStatusException
import java.time.LocalDateTime

@SpringBootTest(
    properties = [
        "spring.profiles.active=dev",
        "ai.client.type=mock",
        "ai.internal-secret=test-internal-secret",
        "spring.datasource.url=jdbc:h2:mem:elekeza;DB_CLOSE_DELAY=-1;MODE=PostgreSQL",
        "spring.datasource.username=sa",
        "spring.datasource.password=",
    ]
)
class MasteryAuthorizationTest {

    @Autowired lateinit var controller: MasteryController
    @Autowired lateinit var userRepo: UserRepository
    @Autowired lateinit var progressRepo: LessonProgressRepository
    @Autowired lateinit var contentRepo: ContentRepository
    @Autowired lateinit var quizRepo: QuizRepository
    @Autowired lateinit var attemptRepo: QuizAttemptRepository
    @Autowired lateinit var institutionService: InstitutionService
    @Autowired lateinit var passwordEncoder: PasswordEncoder

    private val createdEmails = mutableListOf<String>()
    private val contentIds = mutableListOf<Long>()
    private val progressIds = mutableListOf<Long>()
    private val quizIds = mutableListOf<Long>()

    @AfterEach
    fun tearDown() {
        quizIds.forEach { id -> quizRepo.findById(id).ifPresent { quiz ->
            attemptRepo.findByQuizIdAndUserId(quiz.id, -1L) // no-op safety
            quizRepo.delete(quiz)
        } }
        progressIds.forEach { id -> progressRepo.findById(id).ifPresent { progressRepo.delete(it) } }
        contentIds.forEach { id -> contentRepo.findById(id).ifPresent { contentRepo.delete(it) } }
        createdEmails.forEach { email -> userRepo.findByEmail(email)?.let { userRepo.delete(it) } }
    }

    private fun institution(name: String, adminEmail: String): Long =
        institutionService.registerInstitution(
            InstitutionService.InstitutionRegistrationRequest(
                name = name,
                adminEmail = adminEmail,
                adminFirstName = "Test",
                adminLastName = "Admin",
                adminPassword = "TestAdmin1!",
            )
        ).let { userRepo.findByEmail(adminEmail)!!.institutionId!! }
            .also { createdEmails += adminEmail }

    private fun user(email: String, name: String, role: UserRole, institutionId: Long?): User =
        userRepo.save(User(email = email, name = name, password = passwordEncoder.encode("Secret1!"), role = role, institutionId = institutionId))
            .also { createdEmails += email }

    private fun lesson(owner: User, title: String): Content =
        contentRepo.save(Content(userId = owner.id, title = title, originalFilename = "$title.pdf",
            status = ContentStatus.READY, wordCount = 120))
            .also { contentIds += it.id }

    @Test
    fun `teacher cannot view mastery of a learner in another institution`() {
        val instA = institution("Mastery School A", "mastery-a-admin@elekeza.app")
        val instB = institution("Mastery School B", "mastery-b-admin@elekeza.app")
        val teacherA = user("mastery-teacher-a@elekeza.app", "Teacher A", UserRole.TEACHER, instA)
        val learnerB = user("mastery-learner-b@elekeza.app", "Learner B", UserRole.STUDENT, instB)

        val ex = assertThrows(ResponseStatusException::class.java) {
            controller.learnerMastery(teacherA, learnerB.id)
        }
        assertThat(ex.statusCode.value()).isEqualTo(403)
    }

    @Test
    fun `teacher sees real mastery evidence for own institution learner`() {
        val inst = institution("Mastery School C", "mastery-c-admin@elekeza.app")
        val teacher = user("mastery-teacher-c@elekeza.app", "Teacher C", UserRole.TEACHER, inst)
        val learner = user("mastery-learner-c@elekeza.app", "Learner C", UserRole.STUDENT, inst)
        val owner = user("mastery-owner-c@elekeza.app", "Owner C", UserRole.TEACHER, inst)
        val lesson = lesson(owner, "The Water Cycle")

        progressRepo.save(LessonProgress(user = learner, contentId = lesson.id)).let { progressIds += it.id }

        val quiz = quizRepo.save(Quiz(contentId = lesson.id, userId = owner.id)).let { quizIds += it.id; it }
        attemptRepo.save(QuizAttempt(quizId = quiz.id, userId = learner.id, score = 30.0, totalQuestions = 10, completed = true, completedAt = LocalDateTime.now()))
        attemptRepo.save(QuizAttempt(quizId = quiz.id, userId = learner.id, score = 35.0, totalQuestions = 10, completed = true, completedAt = LocalDateTime.now()))

        val view = controller.learnerMastery(teacher, learner.id)
        assertThat(view).hasSize(1)
        val m = view.first()
        assertThat(m.title).isEqualTo("The Water Cycle")
        assertThat(m.attempts).isEqualTo(2)
        assertThat(m.state).isEqualTo("NEEDS_SUPPORT")
        assertThat(m.reason).contains("Needs support")
        assertThat(m.nextAction).isEqualTo("support")
    }

    @Test
    fun `non-student target returns 404 not 403 - no existence leak`() {
        val inst = institution("Mastery School D", "mastery-d-admin@elekeza.app")
        val teacher = user("mastery-teacher-d@elekeza.app", "Teacher D", UserRole.TEACHER, inst)
        val otherTeacher = user("mastery-teacher-d2@elekeza.app", "Teacher D2", UserRole.TEACHER, inst)

        val ex = assertThrows(ResponseStatusException::class.java) {
            controller.learnerMastery(teacher, otherTeacher.id)
        }
        assertThat(ex.statusCode.value()).isEqualTo(404)
    }

    private fun runAs(u: User, vararg authorities: String, block: () -> Unit) {
        val auth = org.springframework.security.authentication.UsernamePasswordAuthenticationToken(
            u, null, authorities.map { org.springframework.security.core.authority.SimpleGrantedAuthority(it) })
        org.springframework.security.core.context.SecurityContextHolder.setContext(
            org.springframework.security.core.context.SecurityContextImpl(auth))
        try { block() } finally { org.springframework.security.core.context.SecurityContextHolder.clearContext() }
    }

    @Test
    fun `class support ranks learners with support needs first`() {
        val inst = institution("Mastery School E", "mastery-e-admin@elekeza.app")
        user("mastery-owner-e@elekeza.app", "Owner E", UserRole.TEACHER, inst)
        val owner = userRepo.findByEmail("mastery-owner-e@elekeza.app")!!
        val strong = user("mastery-strong-e@elekeza.app", "Strong", UserRole.STUDENT, inst)
        val struggling = user("mastery-struggling-e@elekeza.app", "Struggling", UserRole.STUDENT, inst)
        val teacher = user("mastery-teacher-e@elekeza.app", "Teacher E", UserRole.TEACHER, inst)

        val l1 = lesson(owner, "Fractions")
        val l2 = lesson(owner, "Measurement")
        progressRepo.save(LessonProgress(user = strong, contentId = l1.id)).let { progressIds += it.id }
        progressRepo.save(LessonProgress(user = struggling, contentId = l1.id)).let { progressIds += it.id }
        progressRepo.save(LessonProgress(user = struggling, contentId = l2.id)).let { progressIds += it.id }

        val q1 = quizRepo.save(Quiz(contentId = l1.id, userId = owner.id)).let { quizIds += it.id; it }
        val q2 = quizRepo.save(Quiz(contentId = l2.id, userId = owner.id)).let { quizIds += it.id; it }
        // strong: mastered on fractions
        attemptRepo.save(QuizAttempt(quizId = q1.id, userId = strong.id, score = 90.0, totalQuestions = 10, completed = true, completedAt = LocalDateTime.now()))
        attemptRepo.save(QuizAttempt(quizId = q1.id, userId = strong.id, score = 95.0, totalQuestions = 10, completed = true, completedAt = LocalDateTime.now()))
        // struggling: weak on both lessons
        attemptRepo.save(QuizAttempt(quizId = q1.id, userId = struggling.id, score = 25.0, totalQuestions = 10, completed = true, completedAt = LocalDateTime.now()))
        attemptRepo.save(QuizAttempt(quizId = q2.id, userId = struggling.id, score = 30.0, totalQuestions = 10, completed = true, completedAt = LocalDateTime.now()))

        runAs(teacher, "ROLE_TEACHER") {
            val overview = controller.classSupport(teacher)
            val byName = overview.associate { it["learnerName"] as String to it }
            assertThat(byName["Struggling"]!!["needsSupportCount"]).isEqualTo(2)
            assertThat(byName["Strong"]!!["masteredCount"]).isEqualTo(1)
            // Struggling sorts first in the teacher's queue
            assertThat(overview.first()["learnerName"]).isEqualTo("Struggling")
        }
    }

    @Test
    fun `students are denied the class support overview`() {
        val inst = institution("Mastery School F", "mastery-f-admin@elekeza.app")
        val learner = user("mastery-learner-f@elekeza.app", "Learner F", UserRole.STUDENT, inst)
        assertThrows(org.springframework.security.access.AccessDeniedException::class.java) {
            runAs(learner, "ROLE_STUDENT") { controller.classSupport(learner) }
        }
    }
}
