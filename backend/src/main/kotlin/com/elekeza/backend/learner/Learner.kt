package com.elekeza.backend.learner

import jakarta.persistence.*
import org.hibernate.annotations.JdbcTypeCode
import org.hibernate.type.SqlTypes
import java.util.UUID

@Entity
@Table(name = "learners")
class Learner(
    @Id
    val id: UUID = UUID.randomUUID(),

    @Column(nullable = false, unique = true)
    val email: String = "",

    @Column(name = "preferred_language", length = 10)
    var preferredLanguage: String? = null,

    @Enumerated(EnumType.STRING)
    @Column(name = "age_group", length = 20)
    var ageGroup: AgeGroup? = null,

    @Column(name = "learning_goal")
    var learningGoal: String? = null,

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "cognitive_profiles", columnDefinition = "jsonb")
    var cognitiveProfiles: List<String> = emptyList(),

    @Enumerated(EnumType.STRING)
    @Column(name = "literacy_level", length = 20)
    var literacyLevel: LiteracyLevel? = null,

    @Column(name = "onboarding_complete")
    var onboardingComplete: Boolean = false
)