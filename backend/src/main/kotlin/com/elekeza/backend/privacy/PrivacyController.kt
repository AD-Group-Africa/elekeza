package com.elekeza.backend.privacy

import com.elekeza.backend.auth.User
import com.elekeza.backend.auth.UserRole
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.web.bind.annotation.*
import org.springframework.web.server.ResponseStatusException
import java.time.Instant

/**
 * Consent and erasure endpoints.
 *
 * Everything under `/api/privacy` falls through to `anyRequest().authenticated()`
 * in SecurityConfig, so every route here requires a session. Writes are POSTs
 * and are therefore CSRF-protected like the rest of the authenticated surface.
 */
@RestController
@RequestMapping("/api/privacy")
class PrivacyController(
    private val consentService: ConsentService,
    private val erasureService: AccountErasureService
) {
    data class ConsentRequest(
        val type: String,
        /** Omit (or null) for "this is about me". */
        val subjectUserId: Long? = null,
        val note: String? = null
    )

    data class ErasureRequest(
        /** Only honoured for ADMINs erasing someone else. */
        val userId: Long? = null,
        val reason: String? = null
    )

    data class ConsentView(
        val id: Long,
        val type: String,
        val subjectUserId: Long?,
        val policyVersion: String,
        val granted: Boolean,
        val grantedAt: Instant,
        val withdrawnAt: Instant?,
        val source: String
    )

    private fun ConsentRecord.view() = ConsentView(
        id = id,
        type = consentType.name,
        subjectUserId = subjectUserId,
        policyVersion = policyVersion,
        granted = granted,
        grantedAt = grantedAt,
        withdrawnAt = withdrawnAt,
        source = source
    )

    /** What the guardian is agreeing to, so the UI never paraphrases it. */
    @GetMapping("/policy")
    fun policy(): ResponseEntity<Any> = ResponseEntity.ok(
        mapOf(
            "version" to ConsentService.POLICY_VERSION,
            "consents" to ConsentService.POLICY_TEXT.map { (type, text) ->
                mapOf("type" to type.name, "text" to text)
            }
        )
    )

    @PostMapping("/consent")
    fun grant(
        @AuthenticationPrincipal user: User,
        @RequestBody request: ConsentRequest
    ): ResponseEntity<Any> {
        val type = try {
            ConsentType.parse(request.type)
        } catch (e: IllegalArgumentException) {
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, e.message)
        }
        val record = consentService.grant(user, type, request.subjectUserId, request.note)
        return ResponseEntity.status(HttpStatus.CREATED).body(record.view())
    }

    @GetMapping("/consent")
    fun listMine(@AuthenticationPrincipal user: User): ResponseEntity<Any> =
        ResponseEntity.ok(consentService.listMine(user.id).map { it.view() })

    @GetMapping("/consent/active")
    fun active(
        @AuthenticationPrincipal user: User,
        @RequestParam(required = false) learnerId: Long?
    ): ResponseEntity<Any> =
        ResponseEntity.ok(consentService.activeConsents(user.id, learnerId).map { it.view() })

    @PostMapping("/consent/{id}/withdraw")
    fun withdraw(
        @AuthenticationPrincipal user: User,
        @PathVariable id: Long
    ): ResponseEntity<Any> = ResponseEntity.ok(consentService.withdraw(user, id).view())

    /**
     * Erase an account.
     *
     *  * No `userId`, or your own id → self-service erasure, immediately.
     *  * Another user's id → ADMIN only.
     *
     * The response reports what was destroyed, never what was kept.
     */
    @PostMapping("/erasure")
    fun erase(
        @AuthenticationPrincipal user: User,
        @RequestBody(required = false) request: ErasureRequest?
    ): ResponseEntity<Any> {
        val body = request ?: ErasureRequest()
        val targetId = body.userId

        val result = when {
            targetId == null || targetId == user.id -> erasureService.eraseSelf(user, body.reason)
            user.role == UserRole.ADMIN -> erasureService.eraseByAdmin(user, targetId, body.reason)
            else -> throw ResponseStatusException(
                HttpStatus.FORBIDDEN,
                "Only an administrator can erase another account"
            )
        }

        return ResponseEntity.ok(
            mapOf(
                "userId" to result.userId,
                "alreadyErased" to result.alreadyErased,
                "linksRevoked" to result.linksRevoked,
                "consentsWithdrawn" to result.consentsWithdrawn,
                "sessionsRevoked" to result.tokensDeleted,
                "note" to "Identifying data removed and the account deactivated. School academic records are retained without identifying details."
            )
        )
    }

    /** Erasure history for the calling account (no PII is stored in it). */
    @GetMapping("/erasure/history")
    fun erasureHistory(@AuthenticationPrincipal user: User): ResponseEntity<Any> =
        ResponseEntity.ok(erasureService.historyFor(user.id))
}
