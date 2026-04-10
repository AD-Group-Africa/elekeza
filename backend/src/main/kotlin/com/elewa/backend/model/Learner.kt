package com.elewa.backend.model

import jakarta.persistence.*
import java.time.Instant
import java.util.UUID

enum class AgeGroup { CHILD, TEEN, ADULT }
enum class LiteracyLevel { BEGINNER, INTERMEDIATE, ADVANCED }

@Entity
@Table(name = "learners")
class Learner {

    @Id
    val id: UUID = UUID.randomUUID()

    @Column(nullable = false, unique = true)
    lateinit var email: String

    @Column(name = "password_hash", nullable = false)
    lateinit var passwordHash: String

    @Column(name = "full_name", nullable = false)
    lateinit var fullName: String

    @Column(name = "onboarding_complete", nullable = false)
    var onboardingComplete: Boolean = false

    @Column(name = "preferred_language", nullable = false)
    var preferredLanguage: String = "en"

    @Enumerated(EnumType.STRING)
    @Column(name = "age_group")
    var ageGroup: AgeGroup? = null

    @Enumerated(EnumType.STRING)
    @Column(name = "literacy_level")
    var literacyLevel: LiteracyLevel? = null

    @Column(name = "learning_goal")
    var learningGoal: String? = null

    // Stored as a joined collection table: learner_cognitive_profiles
    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(
        name = "learner_cognitive_profiles",
        joinColumns = [JoinColumn(name = "learner_id")]
    )
    @Column(name = "profile")
    var cognitiveProfiles: List<String> = emptyList()

    @Column(name = "created_at", nullable = false, updatable = false)
    val createdAt: Instant = Instant.now()

    @Column(name = "updated_at", nullable = false)
    var updatedAt: Instant = Instant.now()
}