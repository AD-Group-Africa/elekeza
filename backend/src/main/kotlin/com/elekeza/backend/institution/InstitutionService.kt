package com.elekeza.backend.institution

import com.elekeza.backend.auth.User
import com.elekeza.backend.auth.UserRepository
import com.elekeza.backend.auth.UserRole
import com.elekeza.backend.learner.LearnerProfile
import com.elekeza.backend.learner.LearnerProfileRepository
import com.elekeza.backend.learner.SneType
import com.opencsv.CSVReader
import org.slf4j.LoggerFactory
import org.springframework.security.crypto.password.PasswordEncoder
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.multipart.MultipartFile
import java.io.InputStreamReader
import java.time.Instant
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
        val sneType: String?,
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
        val password: String? = null,          // NEW: return temp password
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
        val lastActive: Instant?,
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

        val tempPassword = generateTempPassword()
        userRepo.save(User(
            email = request.adminEmail,
            password = passwordEncoder.encode(tempPassword),
            name = "${request.adminFirstName} ${request.adminLastName}",
            role = UserRole.SCHOOL_ADMIN,
            institutionId = institution.id,
        ))

        log.info("Institution registered: name={}, admin={}", institution.name, request.adminEmail)
        return institution
    }

    @Transactional
    fun importStudentsFromCsv(institutionId: Long, file: MultipartFile): ImportResult {
        institutionRepo.findById(institutionId)
            .orElseThrow { IllegalArgumentException("Institution not found") }

        val results = mutableListOf<ImportRowResult>()
        val reader = CSVReader(InputStreamReader(file.inputStream))
        val rows = reader.readAll().drop(1)
        var succeeded = 0
        var failed = 0

        rows.forEachIndexed { index, columns ->
            val rowNum = index + 2
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
                    sneType = columns.getOrNull(4)?.trim()?.takeIf { it.isNotBlank() } ?: "NONE",
                    guardianPhone = columns.getOrNull(5)?.trim()?.takeIf { it.isNotBlank() },
                    guardianEmail = columns.getOrNull(6)?.trim()?.takeIf { it.isNotBlank() },
                )

                if (row.firstName.isBlank() || row.lastName.isBlank()) {
                    results.add(ImportRowResult(rowNum, "FAILED", error = "Name required"))
                    failed++
                    return@forEachIndexed
                }

                val studentEmail = generateStudentEmail(row.firstName, row.lastName, institutionId)
                val tempPassword = generateTempPassword()
                userRepo.save(User(
                    email = studentEmail,
                    password = passwordEncoder.encode(tempPassword),
                    name = "${row.firstName} ${row.lastName}",
                    role = UserRole.STUDENT,
                    institutionId = institutionId,
                ))

                val sneTypeEnum = try { SneType.valueOf(row.sneType) } catch (e: IllegalArgumentException) { SneType.NONE }
                learnerProfileRepo.save(LearnerProfile(
                    user = userRepo.findByEmail(studentEmail)!!,
                    sneType = sneTypeEnum,
                    preferences = emptyMap(),
                    adaptationState = emptyMap()
                ))

                if (row.guardianPhone != null || row.guardianEmail != null) {
                    val guardianEmail = row.guardianEmail ?: "guardian_${row.firstName.lowercase()}@placeholder.elekeza.app"
                    var guardian = userRepo.findByEmail(guardianEmail)
                    if (guardian == null) {
                        val guardianPassword = generateTempPassword()
                        guardian = userRepo.save(User(
                            email = guardianEmail,
                            password = passwordEncoder.encode(guardianPassword),
                            name = "Guardian of ${row.firstName}",
                            role = UserRole.GUARDIAN,
                            institutionId = institutionId,
                        ))
                    }
                    guardianLinkRepo.save(GuardianLink(
                        guardianId = guardian!!.id,
                        learnerId = userRepo.findByEmail(studentEmail)!!.id,
                    ))
                }

                results.add(ImportRowResult(rowNum, "SUCCESS", email = studentEmail, password = tempPassword))
                succeeded++
                log.debug("Imported student: {} {}", row.firstName, row.lastName)
            } catch (e: Exception) {
                log.error("Failed to import row {}", rowNum, e)
                results.add(ImportRowResult(rowNum, "FAILED", error = e.message))
                failed++
            }
        }

        log.info("CSV import complete: {} succeeded, {} failed out of {}", succeeded, failed, rows.size)
        return ImportResult(total = rows.size, succeeded = succeeded, failed = failed, rows = results)
    }

    fun getStudents(institutionId: Long): List<StudentSummary> {
        val students = userRepo.findByInstitutionIdAndRole(institutionId, UserRole.STUDENT)
        return students.map { student ->
            val profile = learnerProfileRepo.findByUserId(student.id)
            StudentSummary(
                userId = student.id,
                firstName = student.name.split(" ").firstOrNull() ?: student.name,
                lastName = student.name.split(" ").getOrElse(1) { "" },
                email = student.email,
                sneType = profile?.sneType?.name,
                gradeLevel = null,
                lessonsCompleted = 0,
                averageScore = null,
                lastActive = null,
            )
        }
    }

    private fun generateStudentEmail(firstName: String, lastName: String, institutionId: Long): String {
        val base = "${firstName.lowercase()}.${lastName.lowercase()}".replace(Regex("[^a-z.]"), "")
        return "$base.s${institutionId}@elekeza.school"
    }

    private fun generateTempPassword(): String = UUID.randomUUID().toString().take(12)
}
