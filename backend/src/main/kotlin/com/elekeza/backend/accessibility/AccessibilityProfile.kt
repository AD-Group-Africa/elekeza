package com.elekeza.backend.accessibility

import jakarta.persistence.*
import org.hibernate.annotations.JdbcTypeCode
import org.hibernate.type.SqlTypes
import java.time.Instant

/**
 * Per-learner presentation preferences — display/reading settings only, never
 * diagnostic or medically sensitive classifications. [ALLOWED_KEYS] is the
 * enforced contract; the service layer rejects unknown keys so the profile
 * cannot become an unvalidated data dump. Settings actually drive the
 * learner experience: the frontend applies them to the theme/TTS system.
 */
@Entity
@Table(name = "accessibility_profiles")
data class AccessibilityProfile(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,
    @Column(name = "user_id", nullable = false, unique = true)
    val userId: Long,
    // JSONB column: needs the JDBC type code or PG rejects the varchar bind
    // (same defect class as EngagementEvent.metadata).
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(nullable = false, columnDefinition = "jsonb")
    val settings: String = "{}",
    @Column(name = "updated_by")
    val updatedBy: Long? = null,
    @Column(name = "created_at", nullable = false)
    val createdAt: Instant = Instant.now(),
    @Column(name = "updated_at", nullable = false)
    val updatedAt: Instant = Instant.now()
) {
    companion object {
        /**
         * The complete, enforced settings contract. Keys map onto the existing
         * frontend theme/TTS systems:
         *  - theme: "dark" | "light" | "calm" (token system themes)
         *  - textScale: 0.9–2.0 multiplier
         *  - reducedMotion, highContrastFocus: boolean display aids
         *  - ttsEnabled, ttsRate: reading assistance (speechSynthesis)
         *  - plainLanguage: simpler lesson phrasing when the AI pipeline offers it
         */
        val ALLOWED_KEYS: Map<String, Set<String>> = mapOf(
            "theme" to setOf("dark", "light", "calm"),
            "textScale" to setOf("number:0.9-2.0"),
            "reducedMotion" to setOf("boolean"),
            "highContrastFocus" to setOf("boolean"),
            "ttsEnabled" to setOf("boolean"),
            "ttsRate" to setOf("number:0.5-2.0"),
            "plainLanguage" to setOf("boolean"),
        )
    }
}

interface AccessibilityProfileRepository : org.springframework.data.jpa.repository.JpaRepository<AccessibilityProfile, Long> {
    fun findByUserId(userId: Long): AccessibilityProfile?
}
