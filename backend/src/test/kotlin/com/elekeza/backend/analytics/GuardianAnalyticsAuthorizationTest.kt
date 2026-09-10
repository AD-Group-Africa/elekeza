package com.elekeza.backend.analytics

import com.elekeza.backend.auth.User
import com.elekeza.backend.auth.UserRepository
import com.elekeza.backend.auth.UserRole
import com.elekeza.backend.institution.GuardianLink
import com.elekeza.backend.institution.GuardianLinkRepository
import com.elekeza.backend.learner.LessonProgress
import com.elekeza.backend.learner.LessonProgressRepository
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken
import org.springframework.security.core.authority.SimpleGrantedAuthority
import org.springframework.security.core.context.SecurityContextHolder

/**
 * Regression test for a critical data leak: the guardian analytics endpoint
 * previously returned progress for EVERY learner on the platform regardless
 * of guardian-child relationships. It must only ever expose explicitly
 * linked wards.
 */
@SpringBootTest(
    properties = [
        "spring.profiles.active=dev",
        "ai.client.type=mock",
        "ai.internal-secret=test-internal-secret",
        // Tests are authored against the dev profile's in-memory H2 demo seed.
        // Pin the datasource explicitly so ambient SPRING_DATASOURCE_* env vars
        // (e.g. GitLab CI's Postgres service) cannot redirect the context.
        "spring.datasource.url=jdbc:h2:mem:elekeza;DB_CLOSE_DELAY=-1;MODE=PostgreSQL",
        "spring.datasource.username=sa",
        "spring.datasource.password=",
    ]
)
@Suppress("UNCHECKED_CAST")
class GuardianAnalyticsAuthorizationTest {

    @Autowired lateinit var userRepo: UserRepository
    @Autowired lateinit var guardianLinkRepo: GuardianLinkRepository
    @Autowired lateinit var progressRepo: LessonProgressRepository
    @Autowired lateinit var controller: AnalyticsController

    private lateinit var guardian: User
    private lateinit var linkedWard: User
    private lateinit var unrelatedStudent: User

    @BeforeEach
    fun setUp() {
        guardian = userRepo.save(User(
            email = "guardianAuthTest@example.com", password = "x", name = "Test Guardian",
            role = UserRole.GUARDIAN, institutionId = null,
        ))
        linkedWard = userRepo.save(User(
            email = "linkedWardTest@example.com", password = "x", name = "Linked Ward",
            role = UserRole.STUDENT, institutionId = 1L,
        ))
        unrelatedStudent = userRepo.save(User(
            email = "unrelatedStudentTest@example.com", password = "x", name = "Unrelated Student",
            role = UserRole.STUDENT, institutionId = 1L,
        ))

        guardianLinkRepo.save(GuardianLink(
            guardianId = guardian.id, learnerId = linkedWard.id, relationship = "MOTHER",
        ))

        // Give both learners completed progress so the leak would be visible.
        progressRepo.save(LessonProgress(user = linkedWard, contentId = 1L, quizScore = 90.0, completed = true))
        progressRepo.save(LessonProgress(user = unrelatedStudent, contentId = 1L, quizScore = 40.0, completed = true))

        // @PreAuthorize needs an authenticated principal in the SecurityContext.
        val auth = UsernamePasswordAuthenticationToken(
            guardian, null,
            listOf(SimpleGrantedAuthority("ROLE_GUARDIAN"))
        )
        SecurityContextHolder.getContext().authentication = auth
    }

    @AfterEach
    fun tearDown() {
        SecurityContextHolder.clearContext()
        listOf(linkedWard, unrelatedStudent).forEach { student ->
            progressRepo.findByUserIdOrderByCreatedAtDesc(student.id).forEach { progressRepo.delete(it) }
        }
        guardianLinkRepo.findAll().filter { it.guardianId == guardian.id }.forEach { guardianLinkRepo.delete(it) }
        userRepo.findByEmail("linkedWardTest@example.com")?.let { userRepo.delete(it) }
        userRepo.findByEmail("unrelatedStudentTest@example.com")?.let { userRepo.delete(it) }
        userRepo.findByEmail("guardianAuthTest@example.com")?.let { userRepo.delete(it) }
    }

    @Test
    fun `guardian analytics only returns explicitly linked wards`() {
        val response = controller.guardianAnalytics(guardian)
        val wards = (response.body!!["wards"] as List<Map<String, Any>>)

        assertThat(wards).hasSize(1)
        assertThat(wards[0]["childId"] as Long).isEqualTo(linkedWard.id)
        assertThat(wards[0]["childName"]).isEqualTo("Linked Ward")

        // The unrelated student's record must never appear, even though they
        // have completed progress in the same institution.
        assertThat(wards.any { it["childId"] as Long == unrelatedStudent.id }).isFalse()
    }
}
