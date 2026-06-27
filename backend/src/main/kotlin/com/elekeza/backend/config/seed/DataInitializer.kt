package com.elekeza.backend.config.seed

import com.elekeza.backend.auth.*
import com.elekeza.backend.content.*
import com.elekeza.backend.learner.*
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
    private val contentRepo: ContentRepository
) : CommandLineRunner {

    private val log = LoggerFactory.getLogger(DataInitializer::class.java)

    @Transactional
    override fun run(vararg args: String?) {
        log.info("Seeding demo data (dev profile)...")

        // 1. Create demo users if not present
        val teacher = createUserIfAbsent("teacher@elekeza.app", "teacher123", "Alice Mwalimu", UserRole.TEACHER)
        val student = createUserIfAbsent("student@elekeza.app", "student123", "Juma Ali", UserRole.STUDENT)
        createUserIfAbsent("parent@elekeza.app", "parent123", "Fatima Ali", UserRole.GUARDIAN)

        // 2. Create learner profile for student (dyslexia)
        if (learnerProfileRepo.findByUserId(student.id) == null) {
            learnerProfileRepo.save(LearnerProfile(
                user = student,
                sneType = SneType.DYSLEXIA,
                preferences = emptyMap(),
                adaptationState = emptyMap()
            ))
            log.info("Created learner profile for ${student.email}")
        }

        // 3. Create a demo lesson if none exist
        if (contentRepo.count() == 0L) {
            contentRepo.save(Content(
                userId = teacher.id,
                title = "The Water Cycle",
                status = ContentStatus.READY,
                simplifiedText = """{"text":"Water moves around the Earth. The sun heats it and turns it into vapor. Vapor rises and makes clouds. When clouds get heavy, rain falls. The water flows back and the cycle repeats."}"""
            ))
            log.info("Created demo lesson 'The Water Cycle'")
        }

        log.info("Demo data seeded successfully.")
    }

    private fun createUserIfAbsent(email: String, rawPassword: String, fullName: String, role: UserRole): User {
        val existing = userRepository.findByEmail(email)
        if (existing != null) {
            log.info("User $email already exists, skipping.")
            return existing
        }
        val user = User(
            email = email,
            name = fullName,
            password = passwordEncoder.encode(rawPassword),
            role = role,
            onboardingComplete = true
        )
        val saved = userRepository.save(user)
        log.info("Created user $email with role $role")
        return saved
    }
}
