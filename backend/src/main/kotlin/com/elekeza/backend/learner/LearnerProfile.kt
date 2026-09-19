package com.elekeza.backend.learner

import com.elekeza.backend.auth.SneType
import com.elekeza.backend.auth.User
import jakarta.persistence.*
import org.hibernate.annotations.JdbcTypeCode
import org.hibernate.type.SqlTypes
import java.time.LocalDateTime

@Entity
@Table(name = "learner_profiles", indexes = [Index(name = "idx_learner_profile_user", columnList = "user_id")])
data class LearnerProfile(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false, unique = true)
    val user: User,

    @Enumerated(EnumType.STRING)
    @Column(name = "sne_type", length = 50)
    val sneType: SneType? = null,

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    val preferences: Map<String, Any> = emptyMap(),

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "adaptation_state", columnDefinition = "jsonb")
    val adaptationState: Map<String, Any> = emptyMap(),

    @Column(name = "created_at") val createdAt: LocalDateTime = LocalDateTime.now(),
    @Column(name = "updated_at") val updatedAt: LocalDateTime = LocalDateTime.now()
) {
    val userId: Long get() = user.id
}

data class UIPreferences(
    val fontSize:      String?  = null,
    val contrast:      String?  = null,
    val animations:    Boolean? = null,
    val assistiveMode: Boolean? = null
) {
    companion object {
        fun from(raw: Map<String, Any>): UIPreferences = UIPreferences(
            fontSize      = raw["fontSize"]   as? String,
            contrast      = raw["contrast"]   as? String,
            animations    = when (val v = raw["animations"])    { is Boolean -> v; is String -> v.toBooleanStrictOrNull(); else -> null },
            assistiveMode = when (val v = raw["assistiveMode"]) { is Boolean -> v; is String -> v.toBooleanStrictOrNull(); else -> null }
        )
    }
    fun toMap(): Map<String, Any> = buildMap {
        fontSize?.let      { put("fontSize", it) }
        contrast?.let      { put("contrast", it) }
        animations?.let    { put("animations", it) }
        assistiveMode?.let { put("assistiveMode", it) }
    }
}