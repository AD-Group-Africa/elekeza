package com.elekeza.backend.institution

import jakarta.persistence.*
import java.time.Instant

@Entity
@Table(name = "guardian_links")
data class GuardianLink(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,
    val guardianId: Long,
    val learnerId: Long,
    val relationship: String = "PARENT",
    val isActive: Boolean = true,
    val createdAt: Instant = Instant.now()
) {
    companion object {
        /** Canonical relationship types. Role stays GUARDIAN; this is the relationship label. */
        val VALID_RELATIONSHIPS = setOf("PARENT", "CAREGIVER", "OLDER_SIBLING", "LEGAL_GUARDIAN", "OTHER")

        /**
         * Map free-text relationship labels (CSV imports, admin forms) onto the
         * canonical set. Unknown values become OTHER rather than failing the
         * import — the school can correct them later.
         */
        fun normalizeRelationship(raw: String?): String {
            val v = raw?.trim()?.uppercase()?.replace('-', '_').orEmpty()
            if (v.isEmpty()) return "PARENT"
            return when {
                v in VALID_RELATIONSHIPS -> v
                v in setOf("MOTHER", "FATHER", "MUM", "DAD", "PARENT") -> "PARENT"
                v in setOf("CAREGIVER", "CARER", "NANNY", "AIDE") -> "CAREGIVER"
                v in setOf("OLDER_SIBLING", "SIBLING", "BROTHER", "SISTER", "OLDER SIBLING") -> "OLDER_SIBLING"
                v in setOf("LEGAL_GUARDIAN", "GUARDIAN", "LEGAL GUARDIAN") -> "LEGAL_GUARDIAN"
                else -> "OTHER"
            }
        }
    }
}
