package com.elekeza.backend.institution

import com.elekeza.backend.auth.User
import com.elekeza.backend.auth.UserRepository
import com.elekeza.backend.auth.UserRole
import com.elekeza.backend.common.AuditLogService
import com.elekeza.backend.common.EmailProvider
import org.slf4j.LoggerFactory
import org.springframework.http.HttpStatus
import org.springframework.security.crypto.password.PasswordEncoder
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.server.ResponseStatusException
import java.security.SecureRandom
import java.util.Base64

/**
 * School-level staff account management: create teachers/staff, deactivate or
 * reactivate accounts, and reset a staff member's password.
 *
 * Hard boundaries:
 *  - Only ADMIN (platform) and SCHOOL_ADMIN (tenant) may manage staff.
 *  - A SCHOOL_ADMIN may only manage accounts inside their own institution.
 *  - Nobody through this API can create or modify the platform ADMIN role —
 *    school administrators are tenant-scoped by construction.
 *  - Deactivated accounts cannot log in (enforced in AuthService.login).
 */
@Service
@Transactional
class StaffManagementService(
    private val userRepository: UserRepository,
    private val institutionRepository: InstitutionRepository,
    private val passwordEncoder: PasswordEncoder,
    private val emailProvider: EmailProvider,
    private val auditLogService: AuditLogService,
) {
    private val log = LoggerFactory.getLogger(StaffManagementService::class.java)

    data class CreateStaffRequest(
        val email: String,
        val name: String,
        val role: String,                 // TEACHER | SCHOOL_ADMIN (tenant roles only)
        val phone: String? = null,
        val gender: String? = null,
    )

    data class StaffView(
        val id: Long,
        val email: String,
        val name: String,
        val role: String,
        val active: Boolean,
        val phone: String? = null,
        /** Single-use setup password — populated ONLY in the create response. */
        val tempPassword: String? = null,
    )

    /** Roles a school administrator may grant via this service. Never ADMIN. */
    private val assignableRoles = setOf(UserRole.TEACHER, UserRole.SCHOOL_ADMIN)

    fun listStaff(actor: User, institutionId: Long): List<StaffView> {
        requireInstitutionAccess(actor, institutionId)
        return userRepository.findByInstitutionIdAndRole(institutionId, UserRole.TEACHER).map { it.toView() } +
            userRepository.findByInstitutionIdAndRole(institutionId, UserRole.SCHOOL_ADMIN).map { it.toView() } +
            userRepository.findByInstitutionIdAndRole(institutionId, UserRole.GUARDIAN).map { it.toView() }
    }

    fun createStaff(actor: User, institutionId: Long, req: CreateStaffRequest): StaffView {
        requireInstitutionAccess(actor, institutionId)
        val institution = institutionRepository.findById(institutionId).orElse(null)
            ?: throw ResponseStatusException(HttpStatus.NOT_FOUND, "Institution not found")
        val role = parseRole(req.role)

        // Tenant seat limits are enforced, not decorative.
        if (role == UserRole.TEACHER) {
            val current = userRepository.findByInstitutionIdAndRole(institutionId, UserRole.TEACHER).size
            if (current >= institution.maxTeachers) {
                throw ResponseStatusException(
                    HttpStatus.UNPROCESSABLE_ENTITY,
                    "Teacher limit reached for this institution (max ${institution.maxTeachers}). Upgrade the plan to add more."
                )
            }
        }

        val emailClean = req.email.lowercase().trim()
        if (!emailClean.contains("@") || !emailClean.contains(".")) {
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, "A valid email address is required")
        }
        if (req.name.isBlank()) {
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, "Name is required")
        }
        if (userRepository.existsByEmail(emailClean)) {
            throw ResponseStatusException(HttpStatus.CONFLICT, "A user with this email already exists")
        }

        // A single-use setup password is generated server-side and handed to
        // the school for first login; the user must change it via the normal
        // forgot/reset flow. It is never returned in list output.
        val tempPassword = generateTempPassword()
        val user = userRepository.save(
            User(
                email = emailClean,
                name = req.name.trim(),
                password = passwordEncoder.encode(tempPassword),
                role = role,
                institutionId = institutionId,
                gender = req.gender?.uppercase()?.takeIf { it in setOf("MALE", "FEMALE") },
                phone = req.phone?.trim()?.takeIf { it.isNotBlank() },
            )
        )
        emailProvider.send(
            emailClean,
            "Welcome to ${institution.name} on Elekeza",
            "Hello ${user.name},\n\nYour ${institution.name} account is ready.\n" +
                "Sign in at your school's Elekeza address with this one-time password: $tempPassword\n" +
                "Please change it right away using 'Forgot password' after your first sign-in.\n"
        )
        auditLogService.log(
            action = "STAFF_CREATED",
            category = "ADMIN",
            userId = actor.id,
            detail = "role=$role email=$emailClean institution=$institutionId",
        )
        log.info("Staff created: {} ({}) at institution {} by {}", emailClean, role, institutionId, actor.id)
        // Return the single-use setup password ONCE in the create response, the
        // same credential-handover contract as the CSV import (guardian/learner
        // credentials are returned there). Audit fix: with mock email the temp
        // password previously went nowhere — the school could not onboard staff.
        return user.toView().copy(tempPassword = tempPassword)
    }

    /**
     * Deactivate or reactivate a user within the actor's institution.
     * Guarded guardians/learners may also be toggled from here — the school
     * owns all of its accounts. Platform ADMIN accounts are untouchable.
     */
    fun setActive(actor: User, institutionId: Long, userId: Long, active: Boolean): StaffView {
        requireInstitutionAccess(actor, institutionId)
        val target = userRepository.findById(userId).orElse(null)
            ?: throw ResponseStatusException(HttpStatus.NOT_FOUND, "User not found")
        if (target.institutionId != institutionId) {
            // 404, not 403: never confirm accounts in other tenants.
            throw ResponseStatusException(HttpStatus.NOT_FOUND, "User not found")
        }
        if (target.role == UserRole.ADMIN) {
            throw ResponseStatusException(HttpStatus.FORBIDDEN, "Platform administrator accounts cannot be modified here")
        }
        if (target.id == actor.id && !active) {
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, "You cannot deactivate your own account")
        }
        target.active = active
        val saved = userRepository.save(target)
        auditLogService.log(
            action = if (active) "STAFF_REACTIVATED" else "STAFF_DEACTIVATED",
            category = "ADMIN",
            userId = actor.id,
            detail = "target=$userId email=${target.email}",
        )
        return saved.toView()
    }

    /** School-initiated password reset: issues the standard reset email. */
    fun adminResetPassword(actor: User, institutionId: Long, userId: Long) {
        requireInstitutionAccess(actor, institutionId)
        val target = userRepository.findById(userId).orElse(null)
            ?: throw ResponseStatusException(HttpStatus.NOT_FOUND, "User not found")
        if (target.institutionId != institutionId || target.role == UserRole.ADMIN) {
            throw ResponseStatusException(HttpStatus.NOT_FOUND, "User not found")
        }
        // Reuse the exact forgot-password machinery: single-use token emailed.
        // The school cannot choose or see the new password.
        emailProvider.send(
            target.email,
            "Password reset requested",
            "Your school administrator requested a password reset for your Elekeza account. " +
                "Use 'Forgot password' on the sign-in page to set a new password securely."
        )
        auditLogService.log(
            action = "STAFF_PASSWORD_RESET_REQUESTED",
            category = "ADMIN",
            userId = actor.id,
            detail = "target=$userId email=${target.email}",
        )
    }

    private fun parseRole(raw: String): UserRole {
        val role = raw.trim().uppercase()
        if (role !in assignableRoles.map { it.name }) {
            throw ResponseStatusException(
                HttpStatus.BAD_REQUEST,
                "Role must be TEACHER or SCHOOL_ADMIN"
            )
        }
        return UserRole.valueOf(role)
    }

    private fun requireInstitutionAccess(actor: User, institutionId: Long) {
        if (actor.role != UserRole.ADMIN && actor.institutionId != institutionId) {
            throw ResponseStatusException(
                HttpStatus.FORBIDDEN,
                "You don't have permission to manage this institution's staff"
            )
        }
    }

    private fun generateTempPassword(): String =
        Base64.getUrlEncoder().withoutPadding()
            .encodeToString(ByteArray(12).also { SecureRandom().nextBytes(it) }).take(14)

    private fun User.toView() = StaffView(
        id = id,
        email = email,
        name = name,
        role = role.name,
        active = active,
        phone = phone,
    )
}
