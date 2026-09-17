package com.elekeza.backend.config.seed

import com.elekeza.backend.auth.*
import com.elekeza.backend.institution.GuardianLink
import com.elekeza.backend.institution.GuardianLinkRepository
import com.elekeza.backend.content.*
import com.elekeza.backend.exam.*
import com.elekeza.backend.learner.*
import com.elekeza.backend.quiz.*
import jakarta.transaction.Transactional
import org.slf4j.LoggerFactory
import org.springframework.boot.CommandLineRunner
import java.time.Instant
import java.time.temporal.ChronoUnit
import org.springframework.context.annotation.Profile
import org.springframework.core.annotation.Order
import org.springframework.security.crypto.password.PasswordEncoder
import org.springframework.stereotype.Component

@Component
@Profile("dev")
@Order(1) // Always before ShowcaseDataInitializer so base accounts (and their documented passwords) are created first
class DataInitializer(
    private val userRepository: UserRepository,
    private val passwordEncoder: PasswordEncoder,
    private val learnerProfileRepo: LearnerProfileRepository,
    private val contentRepo: ContentRepository,
    private val quizRepo: QuizRepository,
    private val questionRepo: QuizQuestionRepository,
    private val attemptRepo: QuizAttemptRepository,
    private val lessonProgressRepo: LessonProgressRepository,
    private val learnerRepo: LearnerRepository,
    private val guardianRepo: GuardianRepository,
    private val guardianLinkRepository: GuardianLinkRepository,
    private val examRepo: ExamRepository,
    private val examQuestionRepo: ExamQuestionRepository
) : CommandLineRunner {

    private val log = LoggerFactory.getLogger(DataInitializer::class.java)

    @Transactional
    override fun run(vararg args: String?) {
        log.info("Seeding demo data (dev profile)...")

        val teacher = createUserIfAbsent("teacher@elekeza.app", "teacher123", "Alice Mwalimu", UserRole.TEACHER)
        teacher.institutionId = 1L
        userRepository.save(teacher)

        val student = createUserIfAbsent("student@elekeza.app", "student123", "Juma Ali", UserRole.STUDENT)
        // The student must belong to the same institution as the teacher, or
        // every teacher-scoped query (support signals, analytics, interventions)
        // would silently return nothing for the demo learner.
        if (student.institutionId != teacher.institutionId) {
            student.institutionId = teacher.institutionId
            userRepository.save(student)
        }
        val parent  = createUserIfAbsent("parent@elekeza.app",  "parent123",  "Fatima Ali", UserRole.GUARDIAN)
        val sibling = createUserIfAbsent("sibling@elekeza.app", "sibling123", "Zawadi Ali", UserRole.GUARDIAN)
        val caregiver = createUserIfAbsent("caregiver@elekeza.app", "caregiver123", "Mary Achieng", UserRole.GUARDIAN)

        // Guardian relationships: role GUARDIAN + relationship label. One learner,
        // multiple authorized adults (parent / older sibling / caregiver).
        val guardianLink = GuardianLink(guardianId = parent.id, learnerId = student.id, relationship = "PARENT")
        guardianLinkRepository.save(guardianLink)
        guardianLinkRepository.save(GuardianLink(guardianId = sibling.id, learnerId = student.id, relationship = "OLDER_SIBLING"))
        guardianLinkRepository.save(GuardianLink(guardianId = caregiver.id, learnerId = student.id, relationship = "CAREGIVER"))

        // Learner profile for student
        if (learnerProfileRepo.findByUserId(student.id) == null) {
            learnerProfileRepo.save(LearnerProfile(user = student, sneType = SneType.DYSLEXIA, preferences = emptyMap(), adaptationState = emptyMap()))
        }

        // Learner record required for Guardian FK
        val learner = learnerRepo.findByEmail(student.email).orElseGet {
            learnerRepo.save(Learner(email = student.email, cognitiveProfiles = emptyList()))
        }

        // Guardian record
        if (guardianRepo.findAllByEmail(parent.email).isEmpty()) {
            guardianRepo.save(Guardian(
                learner = learner,
                fullName = parent.name,
                relationship = "Mother",
                phone = "+254712345678",
                email = parent.email
            ))
            log.info("Linked guardian {} to learner {}", parent.email, student.email)
        }

        // Demo lesson. Guard by title, not by table count: other seeders may
        // have created content already, and re-running must stay idempotent.
        val waterCycle = contentRepo.findAll().firstOrNull { it.title == "The Water Cycle" }
        val demoContentId = waterCycle?.id ?: contentRepo.save(Content(
            userId = teacher.id, title = "The Water Cycle", status = ContentStatus.READY,
            simplifiedText = """{"text":"Water moves around the Earth. The sun heats it and turns it into vapor. Vapor rises and makes clouds. When clouds get heavy, rain falls. The water flows back and the cycle repeats."}"""
        )).id

        // The learner must have COMPLETED the demo lesson (LessonProgress row):
        // learner home's primary "Continue learning" action is driven by the
        // dashboard's completed lessons, and a fresh seeded learner otherwise
        // starts with an empty home and nothing to demonstrate.
        if (lessonProgressRepo.findByUserIdAndContentId(student.id, demoContentId) == null) {
            lessonProgressRepo.save(LessonProgress(
                user = student,
                contentId = demoContentId,
                quizScore = 80.0,
                completed = true,
                completedAt = java.time.LocalDateTime.now()
            ))
            log.info("Assigned demo lesson to learner {}", student.email)
        }

        // Demo quiz for the water-cycle lesson (keyed to its actual id).
        if (quizRepo.findByContentId(demoContentId) == null) {
            val quiz = quizRepo.save(Quiz(contentId = demoContentId, userId = teacher.id))
            questionRepo.save(QuizQuestion(quizId = quiz.id, question = "What is the first step in the water cycle?", optionA = "Evaporation", optionB = "Condensation", optionC = "Precipitation", optionD = "Collection", correctOption = "A", explanation = "The sun heats water."))
            questionRepo.save(QuizQuestion(quizId = quiz.id, question = "What forms when vapor cools?", optionA = "Ice", optionB = "Clouds", optionC = "Rain", optionD = "Snow", correctOption = "B", explanation = "Vapor turns into tiny water drops."))
            // One real completed attempt on the 0-100 scale the controller uses.
            attemptRepo.save(QuizAttempt(quizId = quiz.id, userId = student.id, score = 80.0, totalQuestions = 2, completed = true))
            log.info("Created demo quiz for lesson 1")
        }

        // Published demo exam so the /student-exams flow is demonstrable from a
        // clean database. Guarded by title for idempotence; window opens now and
        // stays open long enough for demos and E2E runs.
        if (examRepo.findAll().none { it.title == "Science Check: The Water Cycle" }
        ) {
            val exam = examRepo.save(Exam(
                institutionId = teacher.institutionId ?: 1L,
                creatorId = teacher.id,
                title = "Science Check: The Water Cycle",
                description = "A short check on what you learned about water.",
                subject = "Science",
                durationMinutes = 20,
                // Two attempts: one for a first try, one for a retake — and
                // enough for the E2E suite to prove immutability after submit.
                maxAttempts = 2,
                status = ExamStatus.PUBLISHED,
                availableFrom = Instant.now().minus(5, ChronoUnit.MINUTES),
                availableUntil = Instant.now().plus(365, ChronoUnit.DAYS)
            ))
            examQuestionRepo.save(ExamQuestion(examId = exam.id, question = "Which step comes first in the water cycle?", qtype = QuestionType.MCQ, optionA = "Evaporation", optionB = "Condensation", optionC = "Precipitation", optionD = "Collection", correctOption = "A", marks = 1, orderIndex = 0))
            examQuestionRepo.save(ExamQuestion(examId = exam.id, question = "Clouds are made when vapor cools.", qtype = QuestionType.TRUE_FALSE, optionA = "True", optionB = "False", correctOption = "A", marks = 1, orderIndex = 1))
            examQuestionRepo.save(ExamQuestion(examId = exam.id, question = "Name the stage where rain falls to the ground.", qtype = QuestionType.SHORT_ANSWER, correctText = "precipitation", marks = 1, orderIndex = 2))
            log.info("Created published demo exam for institution {}", teacher.institutionId)
        }

        log.info("Demo data seeded successfully.")
    }

    private fun createUserIfAbsent(email: String, rawPassword: String, fullName: String, role: UserRole): User {
        val existing = userRepository.findByEmail(email)
        if (existing != null) return existing
        val user = User(email = email, name = fullName, password = passwordEncoder.encode(rawPassword), role = role)
        return userRepository.save(user)
    }
}
