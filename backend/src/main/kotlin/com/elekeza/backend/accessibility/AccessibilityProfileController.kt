package com.elekeza.backend.accessibility

import com.elekeza.backend.auth.User
import com.elekeza.backend.auth.UserRepository
import com.elekeza.backend.auth.UserRole
import com.fasterxml.jackson.databind.JsonNode
import com.fasterxml.jackson.databind.ObjectMapper
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.bind.annotation.*
import org.springframework.web.server.ResponseStatusException

/**
 * Accessibility profile service. A learner always controls their own profile;
 * staff/admins of the learner's institution may set it on their behalf (e.g.
 * during device setup); guardians may READ the profile of their linked ward
 * so they can support the same settings at home. Settings are validated
 * against [AccessibilityProfile.ALLOWED_KEYS] — unknown keys are rejected.
 */
@Service
@Transactional
class AccessibilityProfileService(
    private val profileRepository: AccessibilityProfileRepository,
    private val userRepository: UserRepository,
    private val guardianLinkRepository: com.elekeza.backend.institution.GuardianLinkRepository,
    private val objectMapper: ObjectMapper,
) {
    data class SettingsRequest(val settings: Map<String, Any>)

    fun getProfile(actor: User, userId: Long): Map<String, Any> {
        requireReadAccess(actor, userId)
        val profile = profileRepository.findByUserId(userId)
        val settings: JsonNode = profile?.let { objectMapper.readTree(it.settings) } ?: objectMapper.createObjectNode()
        return mapOf("userId" to userId, "settings" to settings)
    }

    fun updateProfile(actor: User, userId: Long, req: SettingsRequest): Map<String, Any> {
        requireWriteAccess(actor, userId)
        // Validate the whole map before persisting anything.
        req.settings.forEach { (key, value) ->
            val spec = AccessibilityProfile.ALLOWED_KEYS[key]
                ?: throw ResponseStatusException(HttpStatus.BAD_REQUEST, "Unknown accessibility setting: $key")
            val valid = when {
                spec == setOf("boolean") -> value is Boolean
                spec == setOf("number:0.9-2.0") -> value is Number && value.toDouble() in 0.9..2.0
                spec == setOf("number:0.5-2.0") -> value is Number && value.toDouble() in 0.5..2.0
                else -> value is String && value in spec
            }
            if (!valid) {
                throw ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid value for accessibility setting: $key")
            }
        }
        val existing = profileRepository.findByUserId(userId)
        val merged: String = if (existing == null) {
            objectMapper.writeValueAsString(req.settings)
        } else {
            val node = objectMapper.readTree(existing.settings)
            val mergedNode = objectMapper.createObjectNode()
            node.fieldNames().forEachRemaining { name -> mergedNode.set<JsonNode>(name, node.get(name)) }
            req.settings.forEach { (k, v) ->
                mergedNode.set<JsonNode>(k, objectMapper.valueToTree(v))
            }
            objectMapper.writeValueAsString(mergedNode)
        }
        val saved = profileRepository.save(
            AccessibilityProfile(
                id = existing?.id ?: 0,
                userId = userId,
                settings = merged,
                updatedBy = actor.id,
            )
        )
        return mapOf("userId" to userId, "settings" to objectMapper.readTree(saved.settings))
    }

    private fun targetExists(userId: Long): User? = userRepository.findById(userId).orElse(null)

    private fun requireReadAccess(actor: User, userId: Long) {
        if (actor.id == userId) return
        if (targetExists(userId) == null) throw ResponseStatusException(HttpStatus.NOT_FOUND, "User not found")
        when (actor.role) {
            UserRole.ADMIN -> return
            UserRole.TEACHER, UserRole.SCHOOL_ADMIN -> {
                val target = targetExists(userId)!!
                if (actor.institutionId != null && actor.institutionId == target.institutionId) return
            }
            UserRole.GUARDIAN -> {
                if (guardianLinkRepository.findByGuardianId(actor.id)
                        .any { it.learnerId == userId && it.currentlyActive() }
                ) return
            }
            else -> {}
        }
        throw ResponseStatusException(HttpStatus.FORBIDDEN, "Not authorized to view this accessibility profile")
    }

    private fun requireWriteAccess(actor: User, userId: Long) {
        if (actor.id == userId) return
        if (targetExists(userId) == null) throw ResponseStatusException(HttpStatus.NOT_FOUND, "User not found")
        when (actor.role) {
            UserRole.ADMIN -> return
            UserRole.TEACHER, UserRole.SCHOOL_ADMIN -> {
                val target = targetExists(userId)!!
                if (actor.institutionId != null && actor.institutionId == target.institutionId) return
            }
            else -> {}
        }
        throw ResponseStatusException(HttpStatus.FORBIDDEN, "Not authorized to change this accessibility profile")
    }
}

@RestController
@RequestMapping("/api/accessibility-profiles")
class AccessibilityProfileController(
    private val service: AccessibilityProfileService,
) {
    @GetMapping("/{userId}")
    fun get(@AuthenticationPrincipal actor: User, @PathVariable userId: Long) =
        ResponseEntity.ok(service.getProfile(actor, userId))

    @PutMapping("/{userId}")
    fun update(
        @AuthenticationPrincipal actor: User,
        @PathVariable userId: Long,
        @RequestBody req: AccessibilityProfileService.SettingsRequest,
    ) = ResponseEntity.ok(service.updateProfile(actor, userId, req))
}
