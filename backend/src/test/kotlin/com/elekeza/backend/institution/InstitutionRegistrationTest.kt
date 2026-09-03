package com.elekeza.backend.institution

import com.elekeza.backend.auth.UserRepository
import com.elekeza.backend.auth.UserRole
import org.assertj.core.api.Assertions.assertThat
import org.assertj.core.api.Assertions.assertThatThrownBy
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.security.crypto.password.PasswordEncoder

/**
 * Regression test: school-admin onboarding must use the password the school
 * admin chose on the onboarding form.
 *
 * Original defect: the frontend sent `adminPassword`, but
 * [InstitutionService.InstitutionRegistrationRequest] had no password field,
 * so a random temp password was generated, logged, and never returned — the
 * newly created SCHOOL_ADMIN could never log in.
 */
@SpringBootTest(
    properties = [
        "spring.profiles.active=dev",
        "ai.client.type=mock",
        "ai.internal-secret=test-internal-secret",
    ]
)
class InstitutionRegistrationTest {

    @Autowired lateinit var institutionRepo: InstitutionRepository
    @Autowired lateinit var userRepo: UserRepository
    @Autowired lateinit var passwordEncoder: PasswordEncoder
    @Autowired lateinit var service: InstitutionService

    private val createdEmails = mutableListOf<String>()
    private val createdInstitutionIds = mutableListOf<Long>()

    @AfterEach
    fun tearDown() {
        createdEmails.forEach { userRepo.findByEmail(it)?.let { u -> userRepo.delete(u) } }
        createdInstitutionIds.forEach { institutionRepo.deleteById(it) }
    }

    @Test
    fun `registerInstitution creates SCHOOL_ADMIN able to log in with the chosen password`() {
        val chosen = "Spring-2026-Rocks!"
        val institution = service.registerInstitution(
            InstitutionService.InstitutionRegistrationRequest(
                name = "Onboarding Test School",
                adminEmail = "onboard-admin-test@elekeza.app",
                adminFirstName = "Test",
                adminLastName = "Principal",
                adminPassword = chosen,
                contactPhone = "+254700000000",
            )
        )
        createdInstitutionIds += institution.id
        createdEmails += "onboard-admin-test@elekeza.app"

        val admin = userRepo.findByEmail("onboard-admin-test@elekeza.app")
        assertThat(admin).isNotNull
        assertThat(admin!!.role).isEqualTo(UserRole.SCHOOL_ADMIN)
        assertThat(admin.institutionId).isEqualTo(institution.id)
        // The chosen password must be what authenticates the admin.
        assertThat(passwordEncoder.matches(chosen, admin.password)).isTrue()
    }

    @Test
    fun `registerInstitution rejects a short admin password`() {
        assertThatThrownBy {
            service.registerInstitution(
                InstitutionService.InstitutionRegistrationRequest(
                    name = "Short Password School",
                    adminEmail = "short-password-test@elekeza.app",
                    adminFirstName = "Test",
                    adminLastName = "Principal",
                    adminPassword = "short",
                )
            )
        }.isInstanceOf(IllegalArgumentException::class.java)
            .hasMessageContaining("at least 8 characters")
    }
}
