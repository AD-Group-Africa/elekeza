package com.elekeza.backend.institution

import com.elekeza.backend.auth.User
import com.elekeza.backend.auth.UserRepository
import com.elekeza.backend.auth.UserRole
import com.elekeza.backend.learner.LessonProgress
import com.elekeza.backend.learner.LessonProgressRepository
import com.elekeza.backend.learner.LearnerProfile
import com.elekeza.backend.learner.LearnerProfileRepository
import com.elekeza.backend.auth.SneType
import com.opencsv.CSVReader
import org.slf4j.LoggerFactory
import org.springframework.http.HttpStatus
import org.springframework.security.crypto.password.PasswordEncoder
import org.springframework.web.server.ResponseStatusException
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.multipart.MultipartFile
import java.io.InputStreamReader
import java.time.Instant
import java.time.LocalDateTime
import java.util.UUID

@Service
class InstitutionService(
    private val institutionRepo: InstitutionRepository,
    private val userRepo: UserRepository,
    private val learnerProfileRepo: LearnerProfileRepository,
    private val guardianLinkRepo: GuardianLinkRepository,
    private val lessonProgressRepo: LessonProgressRepository,
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
        val adminPassword: String,
        val contactPhone: String? = null,
    )

    data class ImportRow(
        val firstName: String,
        val lastName: String,
        val grade: String?,
        val sneType: String?,
        val guardianEmail: String?,
        val guardianPhone: String?,
        val guardianName: String?,
        val guardianRelationship: String?,
    )

    data class ImportResult(
        // Field names match the frontend results panel (/school/import):
        // totalRows / succeededRows / failedRows / errors.
        val totalRows: Int,
        val succeededRows: Int,
        val failedRows: Int,
        val errors: List<ImportRowResult>,
        /** Credentials for guardian accounts created by this import. */
        val guardianCredentials: List<GuardianCredential> = emptyList(),
    )

    data class ImportRowResult(
        val row: Int,
        val status: String,
        val email: String? = null,
        val password: String? = null,          // NEW: return temp password
        val error: String? = null,
    )

    /** Temporary login for a guardian account created during CSV import. */
    data class GuardianCredential(
        val email: String,
        val tempPassword: String,
        val relationship: String,
        val studentEmail: String,
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
        val lastActive: LocalDateTime?,
    )

    @Transactional
    fun registerInstitution(request: InstitutionRegistrationRequest): Institution {
        if (request.adminPassword.length < 8) {
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, "adminPassword must be at least 8 characters")
        }
        // Duplicate admin email must be a clean client error, never a duplicate
        // user row (which would break findByEmail and brick the account's login).
        if (userRepo.findByEmail(request.adminEmail.trim().lowercase()) != null) {
            throw ResponseStatusException(
                HttpStatus.CONFLICT,
                "An account with this email already exists. Sign in instead, or use a different email."
            )
        }
        val institution = institutionRepo.save(Institution(
            name = request.name,
            type = request.type,
            subCounty = request.subCounty,
            county = request.county,
            contactEmail = request.adminEmail,
            contactPhone = request.contactPhone,
        ))

        userRepo.save(User(
            email = request.adminEmail.trim().lowercase(),
            password = passwordEncoder.encode(request.adminPassword),
            name = "${request.adminFirstName} ${request.adminLastName}",
            role = UserRole.SCHOOL_ADMIN,
            institutionId = institution.id,
        ))

        log.info("Institution registered: name={}, admin={}", institution.name, request.adminEmail)
        return institution    }

    @Transactional
    fun importStudentsFromCsv(institutionId: Long, file: MultipartFile): ImportResult {
        institutionRepo.findById(institutionId)
            .orElseThrow { IllegalArgumentException("Institution not found") }

        val results = mutableListOf<ImportRowResult>()
        val guardianCredentials = mutableListOf<GuardianCredential>()
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
                    // Column layout matches the downloadable template in
                    // /school/import: firstName,lastName,grade,sneType,
                    // guardianEmail,guardianPhone,guardianName,guardianRelationship
                    firstName = columns.getOrElse(0) { "" }.trim(),
                    lastName = columns.getOrElse(1) { "" }.trim(),
                    grade = columns.getOrNull(2)?.trim()?.takeIf { it.isNotBlank() },
                    sneType = columns.getOrNull(3)?.trim()?.takeIf { it.isNotBlank() } ?: "NONE",
                    guardianEmail = columns.getOrNull(4)?.trim()?.takeIf { it.isNotBlank() },
                    guardianPhone = columns.getOrNull(5)?.trim()?.takeIf { it.isNotBlank() },
                    guardianName = columns.getOrNull(6)?.trim()?.takeIf { it.isNotBlank() },
                    guardianRelationship = GuardianLink.normalizeRelationship(columns.getOrNull(7)?.trim()),
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

                val sneTypeEnum = try { SneType.valueOf(row.sneType ?: "NONE") } catch (e: IllegalArgumentException) { SneType.NONE }
                learnerProfileRepo.save(LearnerProfile(
                    user = userRepo.findByEmail(studentEmail)!!,
                    sneType = sneTypeEnum,
                    preferences = emptyMap(),
                    adaptationState = emptyMap()
                ))

                if (row.guardianPhone != null || row.guardianEmail != null) {
                    val guardianEmail = row.guardianEmail ?: "guardian_${row.firstName.lowercase()}@placeholder.elekeza.app"
                    var tempPassword: String? = null
                    val guardian = userRepo.findByEmail(guardianEmail) ?: run {
                        val generated = generateTempPassword()
                        tempPassword = generated
                        userRepo.save(User(
                            email = guardianEmail,
                            password = passwordEncoder.encode(generated),
                            // Prefer the provided guardian name; fall back to a
                            // respectful generic label when the school didn't supply one.
                            name = row.guardianName ?: "Guardian of ${row.firstName}",
                            role = UserRole.GUARDIAN,
                            institutionId = institutionId,
                        ))
                    }
                    guardianLinkRepo.save(GuardianLink(
                        guardianId = guardian.id,
                        learnerId = userRepo.findByEmail(studentEmail)!!.id,
                        relationship = row.guardianRelationship ?: "PARENT",
                    ))
                    // Return the temp password once so the school can hand the
                    // guardian their login (email delivery is optional/mock).
                    if (tempPassword != null) {
                        guardianCredentials.add(GuardianCredential(
                            email = guardianEmail,
                            tempPassword = tempPassword!!,
                            relationship = row.guardianRelationship ?: "PARENT",
                            studentEmail = studentEmail,
                        ))
                    }
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
        return ImportResult(
            totalRows = rows.size,
            succeededRows = succeeded,
            failedRows = failed,
            errors = results.filter { it.status == "FAILED" },
            guardianCredentials = guardianCredentials,
        )
    }

    fun listInstitutions(): List<Institution> {
        return institutionRepo.findAll().sortedBy { it.name.lowercase() }
    }

    fun getStudents(institutionId: Long): List<StudentSummary> {
        val students = userRepo.findByInstitutionIdAndRole(institutionId, UserRole.STUDENT)
        if (students.isEmpty()) return emptyList()
        val ids = students.map { it.id }
        // Batch lookups instead of per-student N+1 queries.
        val profiles = learnerProfileRepo.findByUserIdIn(ids).associateBy { it.user.id }
        val progressByStudent = lessonProgressRepo.findByUserIdIn(ids).groupBy { it.user.id }
        return students.map { student ->
            val progress = progressByStudent[student.id].orEmpty()
            val completed = progress.filter { it.completed }
            StudentSummary(
                userId = student.id,
                firstName = student.name.split(" ").firstOrNull() ?: student.name,
                lastName = student.name.split(" ").getOrElse(1) { "" },
                email = student.email,
                sneType = profiles[student.id]?.sneType?.name,
                gradeLevel = null,
                lessonsCompleted = completed.size,
                averageScore = if (completed.isNotEmpty()) completed.mapNotNull { it.quizScore }.average() else null,
                lastActive = progress.mapNotNull { it.completedAt }.maxOrNull() ?: progress.firstOrNull()?.createdAt,
            )
        }
    }

    private fun generateStudentEmail(firstName: String, lastName: String, institutionId: Long): String {
        val base = "${firstName.lowercase()}.${lastName.lowercase()}".replace(Regex("[^a-z.]"), "")
        return "$base.s${institutionId}@elekeza.school"
    }

    private fun generateTempPassword(): String = UUID.randomUUID().toString().take(12)
}


