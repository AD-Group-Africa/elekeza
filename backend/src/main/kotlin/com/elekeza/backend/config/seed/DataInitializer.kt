package com.elekeza.backend.config.seed

import com.elekeza.backend.auth.*
import com.elekeza.backend.content.*
import com.elekeza.backend.learner.*
import com.elekeza.backend.quiz.*
import jakarta.transaction.Transactional
import org.slf4j.LoggerFactory
import org.springframework.boot.CommandLineRunner
import org.springframework.context.annotation.Profile
import org.springframework.security.crypto.password.PasswordEncoder
import org.springframework.stereotype.Component

@Component
@Profile("dev")
class DataInitializer(
    private val userRepository: UserRepository,
    private val passwordEncoder: PasswordEncoder,
    private val learnerProfileRepo: LearnerProfileRepository,
    private val contentRepo: ContentRepository,
    private val quizRepo: QuizRepository,
    private val questionRepo: QuizQuestionRepository,
    private val attemptRepo: QuizAttemptRepository,
    private val learnerRepo: LearnerRepository,
    private val guardianRepo: GuardianRepository
) : CommandLineRunner {

    private val log = LoggerFactory.getLogger(DataInitializer::class.java)

    @Transactional
    override fun run(vararg args: String?) {
        log.info("Seeding demo data (dev profile)...")

        val teacher = createUserIfAbsent("teacher@elekeza.app", "teacher123", "Alice Mwalimu", UserRole.TEACHER)
        val student = createUserIfAbsent("student@elekeza.app", "student123", "Juma Ali", UserRole.STUDENT)
        val parent  = createUserIfAbsent("parent@elekeza.app",  "parent123",  "Fatima Ali", UserRole.GUARDIAN)

        // Learner profile for student
        if (learnerProfileRepo.findByUserId(student.id) == null) {
            learnerProfileRepo.save(LearnerProfile(user = student, sneType = SneType.DYSLEXIA, preferences = emptyMap(), adaptationState = emptyMap()))
        }

        // Learner record required for Guardian FK
        val learner = learnerRepo.findByEmail(student.email).orElseGet {
            learnerRepo.save(Learner(email = student.email, cognitiveProfiles = emptyList()))
        }

        // Link guardian → learner
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

        // Demo lesson
        if (contentRepo.count() == 0L) {
            contentRepo.save(Content(
                userId = teacher.id, title = "The Water Cycle", status = ContentStatus.READY,
                simplifiedText = """{"text":"Water moves around the Earth. The sun heats it and turns it into vapor. Vapor rises and makes clouds. When clouds get heavy, rain falls. The water flows back and the cycle repeats."}"""
            ))
        }

        // Demo quiz for lesson 1
        if (quizRepo.findByContentId(1L) == null) {
            val quiz = quizRepo.save(Quiz(contentId = 1L, userId = student.id))
            questionRepo.save(QuizQuestion(quizId = quiz.id, question = "What is the first step in the water cycle?", optionA = "Evaporation", optionB = "Condensation", optionC = "Precipitation", optionD = "Collection", correctOption = "A", explanation = "The sun heats water."))
            questionRepo.save(QuizQuestion(quizId = quiz.id, question = "What forms when vapor cools?", optionA = "Ice", optionB = "Clouds", optionC = "Rain", optionD = "Snow", correctOption = "B", explanation = "Vapor turns into tiny water drops."))
            attemptRepo.save(QuizAttempt(quizId = quiz.id, userId = student.id, score = 0.8, totalQuestions = 2, completed = true))
            log.info("Created demo quiz for lesson 1")
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

