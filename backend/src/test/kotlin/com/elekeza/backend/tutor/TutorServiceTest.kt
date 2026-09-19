package com.elekeza.backend.tutor

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
import org.junit.jupiter.api.Assertions.assertThrows
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.http.HttpStatus
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
class TutorServiceTest {

    @Autowired lateinit var tutorService: TutorService
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

    private val LESSON_BODY =
        "The sun heats water in oceans and rivers. " +
            "Water evaporates for example when the sun shines on the sea. " +
            "Vapor rises into the sky and cools down. " +
            "Clouds form when vapor condenses into tiny drops. " +
            "Rain falls when the clouds grow heavy."

    private fun user(email: String, name: String, role: UserRole, institutionId: Long?): User =
        userRepo.save(User(email = email, name = name, password = passwordEncoder.encode("Secret1!"), role = role, institutionId = institutionId))
            .also { createdEmails += email }

    private fun lesson(owner: User, title: String = "The Water Cycle"): Content =
        contentRepo.save(
            Content(userId = owner.id, title = title, originalFilename = "$title.pdf",
                status = ContentStatus.READY, wordCount = 120, rawText = LESSON_BODY)
        ).also { contentIds += it.id }

    private fun enrolled(learner: User, content: Content) {
        progressRepo.save(LessonProgress(user = learner, contentId = content.id)).let { progressIds += it.id }
    }

    private fun teacherOwner(institutionId: Long, email: String): User =
        user(email, "Owner", UserRole.TEACHER, institutionId)

    @Test
    fun `explain is grounded in the actual lesson text`() {
        val inst = institutionService.registerInstitution(
            InstitutionService.InstitutionRegistrationRequest(
                name = "Tutor School A", adminEmail = "tutor-a-admin@elekeza.app",
                adminFirstName = "Test", adminLastName = "Admin", adminPassword = "TestAdmin1!")
        ).let { userRepo.findByEmail("tutor-a-admin@elekeza.app")!!.institutionId!! }.also { createdEmails += "tutor-a-admin@elekeza.app" }

        val owner = teacherOwner(inst, "tutor-a-owner@elekeza.app")
        val learner = user("tutor-a-learner@elekeza.app", "Learner A", UserRole.STUDENT, inst)
        val lesson = lesson(owner)
        enrolled(learner, lesson)

        val res = tutorService.handle(learner, TutorRequest(action = TutorAction.EXPLAIN, lessonId = lesson.id))

        assertThat(res.content).isNotBlank()
        // Grounding: the explanation must quote the lesson's own material.
        assertThat(res.content).contains("sun")
        assertThat(res.content).contains("The Water Cycle")
    }

    @Test
    fun `explain without lessonId defaults to the learner's most recent lesson`() {
        val inst = institutionService.registerInstitution(
            InstitutionService.InstitutionRegistrationRequest(
                name = "Tutor School B", adminEmail = "tutor-b-admin@elekeza.app",
                adminFirstName = "Test", adminLastName = "Admin", adminPassword = "TestAdmin1!")
        ).let { userRepo.findByEmail("tutor-b-admin@elekeza.app")!!.institutionId!! }.also { createdEmails += "tutor-b-admin@elekeza.app" }

        val owner = teacherOwner(inst, "tutor-b-owner@elekeza.app")
        val learner = user("tutor-b-learner@elekeza.app", "Learner B", UserRole.STUDENT, inst)
        val lesson = lesson(owner)
        enrolled(learner, lesson)

        val res = tutorService.handle(learner, TutorRequest(action = TutorAction.EXPLAIN))
        assertThat(res.content).isNotBlank()
    }

    @Test
    fun `explain with no lesson in context returns a clear 400`() {
        val inst = institutionService.registerInstitution(
            InstitutionService.InstitutionRegistrationRequest(
                name = "Tutor School C", adminEmail = "tutor-c-admin@elekeza.app",
                adminFirstName = "Test", adminLastName = "Admin", adminPassword = "TestAdmin1!")
        ).let { userRepo.findByEmail("tutor-c-admin@elekeza.app")!!.institutionId!! }.also { createdEmails += "tutor-c-admin@elekeza.app" }

        val learner = user("tutor-c-learner@elekeza.app", "Learner C", UserRole.STUDENT, inst)
        val ex = assertThrows(ResponseStatusException::class.java) {
            tutorService.handle(learner, TutorRequest(action = TutorAction.EXPLAIN))
        }
        assertThat(ex.statusCode.value()).isEqualTo(400)
    }

    @Test
    fun `learner cannot use tutor on a lesson they cannot access - tenant isolation`() {
        val instA = institutionService.registerInstitution(
            InstitutionService.InstitutionRegistrationRequest(
                name = "Tutor School D", adminEmail = "tutor-d-admin@elekeza.app",
                adminFirstName = "Test", adminLastName = "Admin", adminPassword = "TestAdmin1!")
        ).let { userRepo.findByEmail("tutor-d-admin@elekeza.app")!!.institutionId!! }.also { createdEmails += "tutor-d-admin@elekeza.app" }
        val instB = institutionService.registerInstitution(
            InstitutionService.InstitutionRegistrationRequest(
                name = "Tutor School E", adminEmail = "tutor-e-admin@elekeza.app",
                adminFirstName = "Test", adminLastName = "Admin", adminPassword = "TestAdmin1!")
        ).let { userRepo.findByEmail("tutor-e-admin@elekeza.app")!!.institutionId!! }.also { createdEmails += "tutor-e-admin@elekeza.app" }

        val ownerB = teacherOwner(instB, "tutor-e-owner@elekeza.app")
        val learnerA = user("tutor-d-learner@elekeza.app", "Learner D", UserRole.STUDENT, instA)
        val lessonB = lesson(ownerB)

        val ex = assertThrows(ResponseStatusException::class.java) {
            tutorService.handle(learnerA, TutorRequest(action = TutorAction.EXPLAIN, lessonId = lessonB.id))
        }
        assertThat(ex.statusCode.value()).isEqualTo(403)
    }

    @Test
    fun `practice - question, answer, feedback, retry`() {
        val inst = institutionService.registerInstitution(
            InstitutionService.InstitutionRegistrationRequest(
                name = "Tutor School F", adminEmail = "tutor-f-admin@elekeza.app",
                adminFirstName = "Test", adminLastName = "Admin", adminPassword = "TestAdmin1!")
        ).let { userRepo.findByEmail("tutor-f-admin@elekeza.app")!!.institutionId!! }.also { createdEmails += "tutor-f-admin@elekeza.app" }

        val owner = teacherOwner(inst, "tutor-f-owner@elekeza.app")
        val learner = user("tutor-f-learner@elekeza.app", "Learner F", UserRole.STUDENT, inst)
        val lesson = lesson(owner)
        enrolled(learner, lesson)

        val res = tutorService.handle(learner, TutorRequest(action = TutorAction.PRACTICE, lessonId = lesson.id))
        val practice = res.practice!!
        assertThat(practice.question).contains("______")
        assertThat(practice.options).hasSize(3)
        // The answer key must NEVER reach the client DTO.
        assertThat(res.toString()).doesNotContain("correctIndex")

        // The stored question (same-package accessor) tells us the real key.
        val stored = tutorService.storedQuestion(practice.practiceId)!!
        val correctIdx = stored.correctIndex
        val wrongIdx = (correctIdx + 1) % practice.options.size

        // Wrong answer → honest feedback, retry allowed.
        val wrong = tutorService.handle(learner, TutorRequest(
            action = TutorAction.PRACTICE, practiceId = practice.practiceId, answerIndex = wrongIdx))
        assertThat(wrong.feedback).isNotNull()
        assertThat(wrong.feedback!!.correct).isFalse()
        assertThat(wrong.feedback!!.canRetry).isTrue()

        // Correct answer → positive feedback.
        val right = tutorService.handle(learner, TutorRequest(
            action = TutorAction.PRACTICE, practiceId = practice.practiceId, answerIndex = correctIdx))
        assertThat(right.feedback!!.correct).isTrue()
        assertThat(right.feedback!!.canRetry).isFalse()

        // Answered session is consumed — replaying it must fail closed.
        // 410 Gone: the one-time question existed but is now consumed.
        val ex = assertThrows(ResponseStatusException::class.java) {
            tutorService.handle(learner, TutorRequest(
                action = TutorAction.PRACTICE, practiceId = practice.practiceId, answerIndex = 0))
        }
        assertThat(ex.statusCode.value()).isEqualTo(410)
    }

    @Test
    fun `another learner cannot answer someone else's practice question`() {
        val inst = institutionService.registerInstitution(
            InstitutionService.InstitutionRegistrationRequest(
                name = "Tutor School G", adminEmail = "tutor-g-admin@elekeza.app",
                adminFirstName = "Test", adminLastName = "Admin", adminPassword = "TestAdmin1!")
        ).let { userRepo.findByEmail("tutor-g-admin@elekeza.app")!!.institutionId!! }.also { createdEmails += "tutor-g-admin@elekeza.app" }

        val owner = teacherOwner(inst, "tutor-g-owner@elekeza.app")
        val learnerA = user("tutor-g-a@elekeza.app", "Learner A", UserRole.STUDENT, inst)
        val learnerB = user("tutor-g-b@elekeza.app", "Learner B", UserRole.STUDENT, inst)
        val lesson = lesson(owner)
        enrolled(learnerA, lesson)

        val res = tutorService.handle(learnerA, TutorRequest(action = TutorAction.PRACTICE, lessonId = lesson.id))
        val ex = assertThrows(ResponseStatusException::class.java) {
            tutorService.handle(learnerB, TutorRequest(
                action = TutorAction.PRACTICE, practiceId = res.practice!!.practiceId, answerIndex = 0))
        }
        assertThat(ex.statusCode.value()).isEqualTo(403)
    }

    @Test
    fun `expired or unknown practice id fails closed`() {
        val inst = institutionService.registerInstitution(
            InstitutionService.InstitutionRegistrationRequest(
                name = "Tutor School H", adminEmail = "tutor-h-admin@elekeza.app",
                adminFirstName = "Test", adminLastName = "Admin", adminPassword = "TestAdmin1!")
        ).let { userRepo.findByEmail("tutor-h-admin@elekeza.app")!!.institutionId!! }.also { createdEmails += "tutor-h-admin@elekeza.app" }

        val learner = user("tutor-h-learner@elekeza.app", "Learner H", UserRole.STUDENT, inst)
        val ex = assertThrows(ResponseStatusException::class.java) {
            tutorService.handle(learner, TutorRequest(
                action = TutorAction.PRACTICE, practiceId = "never-existed", answerIndex = 0))
        }
        assertThat(ex.statusCode.value()).isEqualTo(410)
    }

    @Test
    fun `translate keeps unknown words and labels the source honestly`() {
        val inst = institutionService.registerInstitution(
            InstitutionService.InstitutionRegistrationRequest(
                name = "Tutor School I", adminEmail = "tutor-i-admin@elekeza.app",
                adminFirstName = "Test", adminLastName = "Admin", adminPassword = "TestAdmin1!")
        ).let { userRepo.findByEmail("tutor-i-admin@elekeza.app")!!.institutionId!! }.also { createdEmails += "tutor-i-admin@elekeza.app" }

        val owner = teacherOwner(inst, "tutor-i-owner@elekeza.app")
        val learner = user("tutor-i-learner@elekeza.app", "Learner I", UserRole.STUDENT, inst)
        val lesson = lesson(owner)
        enrolled(learner, lesson)

        val res = tutorService.handle(learner, TutorRequest(
            action = TutorAction.TRANSLATE, lessonId = lesson.id, text = "The sun heats water and clouds form"))

        assertThat(res.content).contains("jua")
        assertThat(res.content).contains("maji")
        // Unknown words stay in English (honest partial translation).
        assertThat(res.translatedBy).isEqualTo("offline dictionary")
        assertThat(res.originalText).isEqualTo("The sun heats water and clouds form")
    }

    @Test
    fun `summary is lesson-grounded with a try-this check`() {
        val inst = institutionService.registerInstitution(
            InstitutionService.InstitutionRegistrationRequest(
                name = "Tutor School J", adminEmail = "tutor-j-admin@elekeza.app",
                adminFirstName = "Test", adminLastName = "Admin", adminPassword = "TestAdmin1!")
        ).let { userRepo.findByEmail("tutor-j-admin@elekeza.app")!!.institutionId!! }.also { createdEmails += "tutor-j-admin@elekeza.app" }

        val owner = teacherOwner(inst, "tutor-j-owner@elekeza.app")
        val learner = user("tutor-j-learner@elekeza.app", "Learner J", UserRole.STUDENT, inst)
        val lesson = lesson(owner)
        enrolled(learner, lesson)

        val res = tutorService.handle(learner, TutorRequest(action = TutorAction.SUMMARY, lessonId = lesson.id))
        assertThat(res.content).contains("What you learned")
        assertThat(res.content).contains("Try this")
        assertThat(res.content).contains("sun")
    }

    @Test
    fun `diagram provides accessible alt text and lesson-derived nodes`() {
        val inst = institutionService.registerInstitution(
            InstitutionService.InstitutionRegistrationRequest(
                name = "Tutor School K", adminEmail = "tutor-k-admin@elekeza.app",
                adminFirstName = "Test", adminLastName = "Admin", adminPassword = "TestAdmin1!")
        ).let { userRepo.findByEmail("tutor-k-admin@elekeza.app")!!.institutionId!! }.also { createdEmails += "tutor-k-admin@elekeza.app" }

        val owner = teacherOwner(inst, "tutor-k-owner@elekeza.app")
        val learner = user("tutor-k-learner@elekeza.app", "Learner K", UserRole.STUDENT, inst)
        val lesson = lesson(owner)
        enrolled(learner, lesson)

        val res = tutorService.handle(learner, TutorRequest(action = TutorAction.DIAGRAM, lessonId = lesson.id))
        val diagram = res.diagram!!
        assertThat(diagram.altText).isNotBlank()
        assertThat(diagram.nodes).isNotEmpty
        // Nodes must come from the lesson, not be invented.
        assertThat(diagram.altText).contains("sun")
    }

    @Test
    fun `mastery tone - needs support learner gets gentle opener, mastered gets challenge`() {
        val inst = institutionService.registerInstitution(
            InstitutionService.InstitutionRegistrationRequest(
                name = "Tutor School L", adminEmail = "tutor-l-admin@elekeza.app",
                adminFirstName = "Test", adminLastName = "Admin", adminPassword = "TestAdmin1!")
        ).let { userRepo.findByEmail("tutor-l-admin@elekeza.app")!!.institutionId!! }.also { createdEmails += "tutor-l-admin@elekeza.app" }

        val owner = teacherOwner(inst, "tutor-l-owner@elekeza.app")
        val learner = user("tutor-l-learner@elekeza.app", "Learner L", UserRole.STUDENT, inst)
        val lesson = lesson(owner)
        enrolled(learner, lesson)

        val quiz = quizRepo.save(Quiz(contentId = lesson.id, userId = owner.id)).let { quizIds += it.id; it }
        attemptRepo.save(QuizAttempt(quizId = quiz.id, userId = learner.id, score = 25.0, totalQuestions = 10, completed = true, completedAt = LocalDateTime.now()))

        val res = tutorService.handle(learner, TutorRequest(action = TutorAction.EXPLAIN, lessonId = lesson.id))
        assertThat(res.intro).isEqualTo("Let's go back to the key idea and work through it together.")

        // Same learner improves → tone shifts.
        attemptRepo.save(QuizAttempt(quizId = quiz.id, userId = learner.id, score = 95.0, totalQuestions = 10, completed = true, completedAt = LocalDateTime.now()))
        val res2 = tutorService.handle(learner, TutorRequest(action = TutorAction.EXPLAIN, lessonId = lesson.id))
        assertThat(res2.intro).isEqualTo("Great work on this lesson — want a challenge?")
    }

    @Test
    fun `status endpoint exposes honest provider state`() {
        // With ai.client.type=mock, AiClient bean EXISTS but provider honesty
        // is per-response; the status flag reflects that a client is wired.
        assertThat(tutorService.providerConfigured).isTrue()
    }
}
