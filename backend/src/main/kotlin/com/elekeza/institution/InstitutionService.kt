package com.elekeza.institution

import com.elekeza.user.User
import com.elekeza.user.UserRepository
import com.elekeza.user.UserRole
import com.elekeza.learner.LearnerProfile
import com.elekeza.learner.LearnerProfileRepository
import com.opencsv.CSVReader
import org.slf4j.LoggerFactory
import org.springframework.security.crypto.password.PasswordEncoder
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.multipart.MultipartFile
import java.io.InputStreamReader
import java.util.UUID

@Service
class InstitutionService(
    private val institutionRepo: InstitutionRepository,
    private val userRepo: UserRepository,
    private val learnerProfileRepo: LearnerProfileRepository,
    private val guardianLinkRepo: GuardianLinkRepository,
    private val passwordEncoder: PasswordEncoder,
) {
    private val log = LoggerFactory.getLogger(javaClass)

    data class InstitutionRegistrationRequest(
        val name: String,
        val type: String = "SCHOOL",
        val subCounty: String? = null,
        val county: String? = null,
        val adminEmail: String,
        val adminFirstName: String,
        val adminLastName: String,
        val contactPhone: String? = null,
    )

    data class ImportRow(
        val firstName: String,
        val lastName: String,
        val classYear: String?,
        val age: Int?,
        val sneType: String?,  // DYSLEXIA, ADHD, AUTISM, INTELLECTUAL_DISABILITY, DYSCALCULIA, NONE
        val guardianPhone: String?,
        val guardianEmail: String?,
    )

    data class ImportResult(
        val total: Int,
        val succeeded: Int,
        val failed: Int,
        val rows: List<ImportRowResult>,
    )

    data class ImportRowResult(
        val row: Int,
        val status: String,
        val email: String? = null,
        val error: String? = null,
    )

    data class StudentSummary(
        val userId: Long,
        val firstName: String,
        val lastName: String,
        val email: String,
        val sneType: String?,
        val gradeLevel: String?,
        val lessonsCompleted: Int,
        val averageScore: Double?,
        val lastActive: java.time.Instant?,
    )

    @Transactional
    fun registerInstitution(request: InstitutionRegistrationRequest): Institution {
        val institution = institutionRepo.save(Institution(
            name = request.name,
            type = request.type,
            subCounty = request.subCounty,
            county = request.county,
            contactEmail = request.adminEmail,
            contactPhone = request.contactPhone,
        ))

        // Create admin user
        val tempPassword = generateTempPassword()
        val admin = userRepo.save(User(
            email = request.adminEmail,
            passwordHash = passwordEncoder.encode(tempPassword),
            firstName = request.adminFirstName,
            lastName = request.adminLastName,
            role = UserRole.SCHOOL_ADMIN,
            institutionId = institution.id,
        ))

        log.info("Institution registered: name={}, admin={}", institution.name, admin.email)
        // TODO: Send welcome email with temp password
        return institution
    }

    @Transactional
    fun importStudentsFromCsv(institutionId: Long, file: MultipartFile): ImportResult {
        val institution = institutionRepo.findById(institutionId)
            .orElseThrow { IllegalArgumentException("Institution not found") }

        val results = mutableListOf<ImportRowResult>()
        val reader = CSVReader(InputStreamReader(file.inputStream))

        // Skip header row
        val rows = reader.readAll().drop(1)
        var succeeded = 0
        var failed = 0

        rows.forEachIndexed { index, columns ->
            val rowNum = index + 2 // 1-indexed + header
            try {
                if (columns.size < 2) {
                    results.add(ImportRowResult(rowNum, "FAILED", error = "Missing required columns"))
                    failed++
                    return@forEachIndexed
                }

                val row = ImportRow(
                    firstName = columns.getOrElse(0) { "" }.trim(),
                    lastName = columns.getOrElse(1) { "" }.trim(),
                    classYear = columns.getOrNull(2)?.trim()?.takeIf { it.isNotBlank() },
                    age = columns.getOrNull(3)?.trim()?.toIntOrNull(),
                    sneType = columns.getOrNull(4)?.trim()?.takeIf { it.isNotBlank() },
                    guardianPhone = columns.getOrNull(5)?.trim()?.takeIf { it.isNotBlank() },
                    guardianEmail = columns.getOrNull(6)?.trim()?.takeIf { it.isNotBlank() },
                )

                if (row.firstName.isBlank() || row.lastName.isBlank()) {
                    results.add(ImportRowResult(rowNum, "FAILED", error = "Name required"))
                    failed++
                    return@forEachIndexed
                }

                // Create student user
                val studentEmail = generateStudentEmail(row.firstName, row.lastName, institutionId)
                val tempPassword = generateTempPassword()
                val student = userRepo.save(User(
                    email = studentEmail,
                    passwordHash = passwordEncoder.encode(tempPassword),
                    firstName = row.firstName,
                    lastName = row.lastName,
                    role = UserRole.LEARNER,
                    institutionId = institutionId,
                ))

                // Create learner profile with SNE type
                learnerProfileRepo.save(LearnerProfile(
                    userId = student.id,
                    gradeLevel = row.classYear,
                    dateOfBirth = row.age?.let { java.time.LocalDate.now().minusYears(it.toLong()) },
                    diagnosedConditions = row.sneType?.let { listOf(it) } ?: emptyList(),
                    institutionId = institutionId,
                ))

                // Create guardian link if guardian info provided
                if (row.guardianPhone != null || row.guardianEmail != null) {
                    val guardianEmail = row.guardianEmail ?: "guardian_${student.id}@placeholder.elekeza.app"
                    var guardian = userRepo.findByEmail(guardianEmail)
                    if (guardian == null) {
                        guardian = userRepo.save(User(
                            email = guardianEmail,
                            passwordHash = passwordEncoder.encode(tempPassword),
                            firstName = "Guardian of",
                            lastName = row.firstName,
                            role = UserRole.GUARDIAN,
                            institutionId = institutionId,
                        ))
                    }
                    guardianLinkRepo.save(GuardianLink(
                        guardianId = guardian.id,
                        learnerId = student.id,
                    ))
                }

                results.add(ImportRowResult(rowNum, "SUCCESS", email = studentEmail))
                succeeded++
                log.debug("Imported student: {} {}", row.firstName, row.lastName)
            } catch (e: Exception) {
                log.error("Failed to import row {}", rowNum, e)
                results.add(ImportRowResult(rowNum, "FAILED", error = e.message))
                failed++
            }
        }

        log.info("CSV import complete: {} succeeded, {} failed out of {}", succeeded, failed, rows.size)
        return ImportResult(
            total = rows.size,
            succeeded = succeeded,
            failed = failed,
            rows = results,
        )
    }

    fun getStudents(institutionId: Long): List<StudentSummary> {
        val students = userRepo.findByInstitutionIdAndRole(institutionId, UserRole.LEARNER)
        return students.map { student ->
            val profile = learnerProfileRepo.findByUserId(student.id)
            StudentSummary(
                userId = student.id,
                firstName = student.firstName,
                lastName = student.lastName,
                email = student.email,
                sneType = profile?.diagnosedConditions?.firstOrNull(),
                gradeLevel = profile?.gradeLevel,
                lessonsCompleted = 0, // TODO: query from progress
                averageScore = null,  // TODO: query from quiz results
                lastActive = null,    // TODO: query from analytics
            )
        }
    }

    private fun generateStudentEmail(firstName: String, lastName: String, institutionId: Long): String {
        val base = "${firstName.lowercase()}.${lastName.lowercase()}"
            .replace(Regex("[^a-z.]"), "")
        return "$base.s${institutionId}@elekeza.school"
    }

    private fun generateTempPassword(): String {
        return UUID.randomUUID().toString().take(12)
    }
}