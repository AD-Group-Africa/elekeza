package com.elekeza.backend.learner

import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.util.UUID

data class ProfileRequest(
    val preferredLanguage: String,
    val ageGroup: AgeGroup,
    val learningGoal: String? = null,
    val cognitiveProfiles: List<String>? = null
)

data class PlacementRequest(val score: Int, val totalQuestions: Int)
data class GuardianLinkRequest(val fullName: String, val relationship: String, val phone: String? = null, val email: String? = null)
data class OnboardingResponse(val learnerId: UUID, val message: String, val onboardingComplete: Boolean = false)
data class PlacementResponse(val learnerId: UUID, val literacyLevel: LiteracyLevel, val message: String)
data class GuardianLinkResponse(val guardianId: UUID, val learnerId: UUID, val message: String)

@Service
class OnboardingService(
    private val learnerRepository:  LearnerRepository,
    private val guardianRepository: GuardianRepository
) {
    /** Resolves a Learner record from the authenticated user's email. */
    fun findLearnerByEmail(email: String): Learner? = learnerRepository.findByEmail(email).orElse(null)
    @Transactional
    fun saveProfile(learnerId: UUID, request: ProfileRequest): OnboardingResponse {
        val learner = learnerRepository.findById(learnerId).orElseThrow { IllegalArgumentException("Learner not found") }
        learner.preferredLanguage = request.preferredLanguage
        learner.ageGroup          = request.ageGroup
        learner.learningGoal      = request.learningGoal
        request.cognitiveProfiles?.let { learner.cognitiveProfiles = it.map { p -> p.trim().lowercase() }.filter { p -> p.isNotBlank() }.distinct() }
        learnerRepository.save(learner)
        return OnboardingResponse(learner.id, "Profile saved", learner.onboardingComplete)
    }

    @Transactional
    fun savePlacement(learnerId: UUID, request: PlacementRequest): PlacementResponse {
        require(request.totalQuestions > 0)
        require(request.score in 0..request.totalQuestions)
        val learner = learnerRepository.findById(learnerId).orElseThrow { IllegalArgumentException("Learner not found") }
        val pct   = (request.score.toDouble() / request.totalQuestions) * 100
        val level = when {
            pct >= 70 -> LiteracyLevel.ADVANCED
            pct >= 40 -> LiteracyLevel.INTERMEDIATE
            else      -> LiteracyLevel.BEGINNER
        }
        learner.literacyLevel = level
        learnerRepository.save(learner)
        return PlacementResponse(learner.id, level, "Placement complete â€” level: ${level.name.lowercase()}")
    }

    @Transactional
    fun completeOnboarding(learnerId: UUID): OnboardingResponse {
        val learner = learnerRepository.findById(learnerId).orElseThrow { IllegalArgumentException("Learner not found") }
        check(!learner.onboardingComplete) { "Onboarding already completed" }
        check(learner.ageGroup != null)    { "Profile must be saved first" }
        check(learner.literacyLevel != null) { "Placement must be completed first" }
        learner.onboardingComplete = true
        learnerRepository.save(learner)
        return OnboardingResponse(learner.id, "Onboarding complete", true)
    }

    @Transactional
    fun linkGuardian(learnerId: UUID, request: GuardianLinkRequest): GuardianLinkResponse {
        require(request.phone != null || request.email != null) { "At least one contact method required" }
        val learner = learnerRepository.findById(learnerId).orElseThrow { IllegalArgumentException("Learner not found") }
        val saved = guardianRepository.save(Guardian().apply {
            this.learner      = learner
            this.fullName     = request.fullName
            this.relationship = request.relationship
            this.phone        = request.phone
            this.email        = request.email
        })
        return GuardianLinkResponse(saved.id, learner.id, "Guardian linked")
    }
}