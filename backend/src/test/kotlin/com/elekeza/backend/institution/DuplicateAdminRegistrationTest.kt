package com.elekeza.backend.institution

import com.elekeza.backend.auth.UserRepository
import com.elekeza.backend.learner.LearnerProfileRepository
import org.assertj.core.api.Assertions.assertThat
import org.assertj.core.api.Assertions.assertThatThrownBy
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.web.server.ResponseStatusException

/**
 * Duplicate admin emails must be rejected as a client conflict (409) at
 * registration time. Before this test existed, a duplicate registration
 * created a second user row with the same email, which then made
 * userRepository.findByEmail throw NonUniqueResultException on EVERY login —
 * permanently bricking the account (HTTP 500).
 */
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
class DuplicateAdminRegistrationTest {

    @Autowired lateinit var service: InstitutionService
    @Autowired lateinit var userRepo: UserRepository
    @Autowired lateinit var learnerProfileRepo: LearnerProfileRepository
    @Autowired lateinit var institutionRepo: InstitutionRepository

    private val createdEmails = mutableListOf<String>()
    private val createdInstitutionIds = mutableListOf<Long>()

    @AfterEach
    fun tearDown() {
        createdEmails.forEach { email ->
            userRepo.findByEmail(email)?.let { user ->
                learnerProfileRepo.findByUserId(user.id)?.let { learnerProfileRepo.delete(it) }
                userRepo.delete(user)
            }
        }
        createdInstitutionIds.forEach { institutionRepo.deleteById(it) }
    }

    private fun request(email: String) = InstitutionService.InstitutionRegistrationRequest(
        name = "Dup Admin School ${System.nanoTime()}",
        adminEmail = email,
        adminFirstName = "Grace",
        adminLastName = "Mwangi",
        adminPassword = "AdminPass1!",
    )

    @Test
    fun `duplicate admin email is rejected with 409 and no duplicate user row is created`() {
        val email = "dup-admin-test@elekeza.app"
        val first = service.registerInstitution(request(email))
        createdInstitutionIds += first.id
        createdEmails += email

        assertThatThrownBy { service.registerInstitution(request(email)) }
            .isInstanceOf(ResponseStatusException::class.java)
            .extracting("statusCode")
            .isEqualTo(org.springframework.http.HttpStatus.CONFLICT)

        // exactly one user row for this email — the bricking defect is dead
        val duplicates = userRepo.findAll().count { it.email.equals(email, ignoreCase = true) }
        assertThat(duplicates).isEqualTo(1)
    }

    @Test
    fun `admin email is normalized to lowercase so login normalization matches`() {
        val mixed = "MixedCase.Admin@Elekeza.App"
        val institution = service.registerInstitution(request(mixed))
        createdInstitutionIds += institution.id
        createdEmails += mixed.lowercase()

        val saved = userRepo.findByEmail(mixed.lowercase())
        assertThat(saved).isNotNull
        assertThat(saved!!.email).isEqualTo(mixed.lowercase())
    }
}
