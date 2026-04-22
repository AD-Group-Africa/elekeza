package com.elewa.backend.service

import com.elewa.backend.dto.*
import com.elewa.backend.model.Guardian
import com.elewa.backend.model.LiteracyLevel
import com.elewa.backend.repository.GuardianRepository
import com.elewa.backend.repository.LearnerRepository
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.util.UUID

@Service
class OnboardingService(
    private val learnerRepository: LearnerRepository,
    private val guardianRepository: GuardianRepository
) {

    @Transactional
    fun saveProfile(learnerId: UUID, request: ProfileRequest): OnboardingResponse {
        val learner = learnerRepository.findById(learnerId)
            .orElseThrow { IllegalArgumentException("Learner not found") }
        learner.preferredLanguage = request.preferredLanguage
        learner.ageGroup          = request.ageGroup
        learner.learningGoal      = request.learningGoal
        learnerRepository.save(learner)
        return OnboardingResponse(
            learnerId          = learner.id,
            message            = "Profile saved",
            onboardingComplete = learner.onboardingComplete
        )
    }

    @Transactional
    fun savePlacement(learnerId: UUID, request: PlacementRequest): PlacementResponse {
        require(request.totalQuestions > 0) { "totalQuestions must be greater than 0" }
        require(request.score in 0..request.totalQuestions) { "score out of range" }
        val learner = learnerRepository.findById(learnerId)
            .orElseThrow { IllegalArgumentException("Learner not found") }
        val pct   = (request.score.toDouble() / request.totalQuestions) * 100
        val level = when {
            pct >= 70 -> LiteracyLevel.ADVANCED
            pct >= 40 -> LiteracyLevel.INTERMEDIATE
            else      -> LiteracyLevel.BEGINNER
        }
        learner.literacyLevel = level
        learnerRepository.save(learner)
        return PlacementResponse(
            learnerId     = learner.id,
            literacyLevel = level,
            message       = "Placement complete â€” level: ${level.name.lowercase()}"
        )
    }

    @Transactional
    fun completeOnboarding(learnerId: UUID): OnboardingResponse {
        val learner = learnerRepository.findById(learnerId)
            .orElseThrow { IllegalArgumentException("Learner not found") }
        check(!learner.onboardingComplete) { "Onboarding already completed" }
        check(learner.ageGroup != null)      { "Profile must be saved first" }
        check(learner.literacyLevel != null) { "Placement must be completed first" }
        learner.onboardingComplete = true
        learnerRepository.save(learner)
        return OnboardingResponse(
            learnerId          = learner.id,
            message            = "Onboarding complete",
            onboardingComplete = true
        )
    }

    @Transactional
    fun linkGuardian(learnerId: UUID, request: GuardianLinkRequest): GuardianLinkResponse {
        require(request.phone != null || request.email != null) {
            "At least one contact method (phone or email) is required"
        }
        val learner = learnerRepository.findById(learnerId)
            .orElseThrow { IllegalArgumentException("Learner not found") }
        val saved = guardianRepository.save(Guardian().apply {
            this.learner      = learner
            this.fullName     = request.fullName
            this.relationship = request.relationship
            this.phone        = request.phone
            this.email        = request.email
        })
        return GuardianLinkResponse(
            guardianId = saved.id,
            learnerId  = learner.id,
            message    = "Guardian linked"
        )
    }
}
