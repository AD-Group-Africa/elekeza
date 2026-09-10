package com.elekeza.backend.guardian

import com.elekeza.backend.auth.UserRepository
import com.elekeza.backend.auth.UserRole
import com.elekeza.backend.institution.GuardianLink
import com.elekeza.backend.institution.GuardianLinkRepository
import com.elekeza.backend.institution.InstitutionService
import com.elekeza.backend.learner.LearnerProfileRepository
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.mock.web.MockMultipartFile

/**
 * Final guardian relationship model:
 *   Role = GUARDIAN for every authorized adult; GuardianLink.relationship
 *   carries the bond (PARENT / CAREGIVER / OLDER_SIBLING / LEGAL_GUARDIAN / OTHER).
 * One learner may have several guardians; one guardian may serve several learners.
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
class GuardianRelationshipTest {

    @Autowired lateinit var service: InstitutionService
    @Autowired lateinit var guardianLinkRepo: GuardianLinkRepository
    @Autowired lateinit var userRepo: UserRepository
    @Autowired lateinit var learnerProfileRepo: LearnerProfileRepository

    private val createdEmails = mutableListOf<String>()

    @AfterEach
    fun tearDown() {
        createdEmails.forEach { email ->
            userRepo.findByEmail(email)?.let { user ->
                guardianLinkRepo.findByGuardianId(user.id).forEach { guardianLinkRepo.delete(it) }
                guardianLinkRepo.findByLearnerId(user.id).forEach { guardianLinkRepo.delete(it) }
                learnerProfileRepo.findByUserId(user.id)?.let { learnerProfileRepo.delete(it) }
                userRepo.delete(user)
            }
        }
    }

    @Test
    fun `normalizeRelationship maps labels onto the canonical set`() {
        assertThat(GuardianLink.normalizeRelationship("Mother")).isEqualTo("PARENT")
        assertThat(GuardianLink.normalizeRelationship("father")).isEqualTo("PARENT")
        assertThat(GuardianLink.normalizeRelationship("older-sibling")).isEqualTo("OLDER_SIBLING")
        assertThat(GuardianLink.normalizeRelationship("Sibling")).isEqualTo("OLDER_SIBLING")
        assertThat(GuardianLink.normalizeRelationship("Nanny")).isEqualTo("CAREGIVER")
        assertThat(GuardianLink.normalizeRelationship("legal guardian")).isEqualTo("LEGAL_GUARDIAN")
        assertThat(GuardianLink.normalizeRelationship("Guardian")).isEqualTo("LEGAL_GUARDIAN")
        assertThat(GuardianLink.normalizeRelationship("Auntie")).isEqualTo("OTHER")
        assertThat(GuardianLink.normalizeRelationship(null)).isEqualTo("PARENT")
        assertThat(GuardianLink.normalizeRelationship("  ")).isEqualTo("PARENT")
        assertThat(GuardianLink.normalizeRelationship("")).isEqualTo("PARENT")
    }

    @Test
    fun `csv import matches the shipped template layout and wires guardian relationships`() {
        // Layout of the template downloadable from /school/import:
        // firstName,lastName,grade,sneType,guardianEmail,guardianPhone,guardianName,guardianRelationship
        val csv = """
            firstName,lastName,grade,sneType,guardianEmail,guardianPhone,guardianName,guardianRelationship
            Amina,Mbio,Grade 4,DYSLEXIA,amina.guardian@example.com,+254700111222,Fatuma Mbio,Mother
            Juma,Otieno,Grade 3,NONE,sibling.otieno@example.com,,Zawadi Otieno,Older Sibling
            Baraka,Kamau,Grade 5,ADHD,caregiver.kamau@example.com,,Grace Achieng,Caregiver
        """.trimIndent()

        val institution = service.registerInstitution(
            InstitutionService.InstitutionRegistrationRequest(
                name = "Relationship Import School",
                adminEmail = "rel-admin@elekeza.app",
                adminFirstName = "Rel",
                adminLastName = "Admin",
                adminPassword = "RelAdmin1!",
            )
        )
        createdEmails += "rel-admin@elekeza.app"

        val file = MockMultipartFile(
            "file", "learners.csv", "text/csv",
            csv.toByteArray()
        )
        val result = service.importStudentsFromCsv(institution.id, file)

        assertThat(result.failedRows).isEqualTo(0)
        assertThat(result.succeededRows).isEqualTo(3)

        // Guardian credentials are returned once per newly created guardian.
        val creds = result.guardianCredentials
        assertThat(creds).hasSize(3)
        assertThat(creds.map { it.relationship }).containsExactlyInAnyOrder("PARENT", "OLDER_SIBLING", "CAREGIVER")

        val parent = userRepo.findByEmail("amina.guardian@example.com")!!
        val sibling = userRepo.findByEmail("sibling.otieno@example.com")!!
        val caregiver = userRepo.findByEmail("caregiver.kamau@example.com")!!

        assertThat(parent.role).isEqualTo(UserRole.GUARDIAN)
        assertThat(parent.name).isEqualTo("Fatuma Mbio")
        assertThat(sibling.name).isEqualTo("Zawadi Otieno")
        // Importer generates learner emails as first.last.s{institutionId}@elekeza.school
        val learners = listOf("amina.mbio", "juma.otieno", "baraka.kamau")
            .map { base -> "$base.s${institution.id}@elekeza.school" }
        createdEmails += learners
        createdEmails += listOf(
            "amina.guardian@example.com", "sibling.otieno@example.com",
            "caregiver.kamau@example.com",
        )

        val amina = userRepo.findByEmail(learners[0])!!
        val links = guardianLinkRepo.findByLearnerId(amina.id).map { it.relationship }
        assertThat(links).containsExactly("PARENT")

        // The guardianLink uses the normalized relationship from the CSV.
        val siblingLink = guardianLinkRepo.findByGuardianId(sibling.id).first()
        assertThat(siblingLink.relationship).isEqualTo("OLDER_SIBLING")
        val caregiverLink = guardianLinkRepo.findByGuardianId(caregiver.id).first()
        assertThat(caregiverLink.relationship).isEqualTo("CAREGIVER")
    }

    @Test
    fun `one learner can have multiple guardians with distinct relationship types`() {
        val institution = service.registerInstitution(
            InstitutionService.InstitutionRegistrationRequest(
                name = "Multi Guardian School",
                adminEmail = "multi-admin@elekeza.app",
                adminFirstName = "Multi",
                adminLastName = "Admin",
                adminPassword = "MultiAdmin1!",
            )
        )
        createdEmails += "multi-admin@elekeza.app"

        val csv = """
            firstName,lastName,grade,sneType,guardianEmail,guardianPhone,guardianName,guardianRelationship
            Neema,Joseph,Grade 2,NONE,neema.parent@example.com,,Wanjiku Joseph,Parent
        """.trimIndent()
        val file = MockMultipartFile("file", "learners.csv", "text/csv", csv.toByteArray())
        val result = service.importStudentsFromCsv(institution.id, file)
        assertThat(result.failedRows).isEqualTo(0)
        createdEmails += "neema.parent@example.com"
        createdEmails += "neema.joseph.s${institution.id}@elekeza.school"

        val learner = userRepo.findByEmail("neema.joseph.s${institution.id}@elekeza.school")!!
        val parent = userRepo.findByEmail("neema.parent@example.com")!!
        val sibling = userRepo.save(
            com.elekeza.backend.auth.User(
                email = "neema.sibling@elekeza.app",
                password = "x",
                name = "Nzuri Joseph",
                role = UserRole.GUARDIAN,
                institutionId = institution.id,
            )
        )
        createdEmails += "neema.sibling@elekeza.app"
        val caregiver = userRepo.save(
            com.elekeza.backend.auth.User(
                email = "neema.caregiver@elekeza.app",
                password = "x",
                name = "Achieng Otis",
                role = UserRole.GUARDIAN,
                institutionId = institution.id,
            )
        )
        createdEmails += "neema.caregiver@elekeza.app"

        guardianLinkRepo.save(GuardianLink(guardianId = sibling.id, learnerId = learner.id, relationship = "OLDER_SIBLING"))
        guardianLinkRepo.save(GuardianLink(guardianId = caregiver.id, learnerId = learner.id, relationship = "CAREGIVER"))

        val relationships = guardianLinkRepo.findByLearnerId(learner.id).map { it.relationship }
        assertThat(relationships).containsExactlyInAnyOrder("PARENT", "OLDER_SIBLING", "CAREGIVER")
        assertThat(parent.role).isEqualTo(UserRole.GUARDIAN)
        assertThat(sibling.role).isEqualTo(UserRole.GUARDIAN)
        assertThat(caregiver.role).isEqualTo(UserRole.GUARDIAN)
    }
}
