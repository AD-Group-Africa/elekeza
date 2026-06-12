package com.elekeza.quiz

import com.elekeza.learner.LearnerProfileRepository
import com.elekeza.quiz.dto.AdaptiveRequest
import com.elekeza.quiz.dto.AdaptiveResponse
import org.slf4j.LoggerFactory
import org.springframework.beans.factory.annotation.Value
import org.springframework.stereotype.Service
import org.springframework.web.reactive.function.client.WebClient
import org.springframework.web.reactive.function.client.bodyToMono
import java.time.Duration

@Service
class AdaptiveService(
    @Value("\${ai.service.url}") private val aiServiceUrl: String,
    @Value("\${ai.internal-secret}") private val internalSecret: String,
    private val learnerProfileRepository: LearnerProfileRepository,
    private val quizAttemptRepository: QuizAttemptRepository,
) {
    private val log = LoggerFactory.getLogger(javaClass)
    private val webClient = WebClient.builder()
        .baseUrl(aiServiceUrl)
        .defaultHeader("X-Internal-Key", internalSecret)
        .build()

    fun getAdaptiveDirective(
        userId: Long,
        isCorrect: Boolean,
        latencyMs: Long,
        currentDifficulty: Int,
        lessonId: String?,
    ): AdaptiveResponse {
        val profile = learnerProfileRepository.findByUserId(userId)
        val consecutiveCorrect = quizAttemptRepository.countConsecutiveCorrect(userId)
        val consecutiveWrong = quizAttemptRepository.countConsecutiveWrong(userId)

        val request = AdaptiveRequest(
            profile = profile?.sneType?.name?.lowercase() ?: "none",
            languageLevel = profile?.languageLevel ?: 2,
            isCorrect = isCorrect,
            latencyMs = latencyMs,
            consecutiveCorrect = consecutiveCorrect,
            consecutiveWrong = consecutiveWrong,
            currentDifficulty = currentDifficulty,
            lessonId = lessonId,
        )

        return try {
            webClient.post()
                .uri("/ai/adaptive")
                .bodyValue(request)
                .retrieve()
                .bodyToMono<AdaptiveResponse>()
                .timeout(Duration.ofSeconds(10))
                .block() ?: fallbackResponse(isCorrect, currentDifficulty)
        } catch (e: Exception) {
            log.error("Adaptive service call failed, using fallback", e)
            fallbackResponse(isCorrect, currentDifficulty)
        }
    }

    private fun fallbackResponse(isCorrect: Boolean, currentDifficulty: Int): AdaptiveResponse {
        return if (isCorrect) {
            AdaptiveResponse(
                directive = "same",
                message = "Good effort — keep going.",
                adjustedDifficulty = currentDifficulty,
                reasoning = "Fallback due to AI service unavailability",
                profileApplied = "fallback",
                latencyMs = 0,
            )
        } else {
            AdaptiveResponse(
                directive = "same",
                message = "Almost — try the next question.",
                adjustedDifficulty = currentDifficulty,
                reasoning = "Fallback due to AI service unavailability",
                profileApplied = "fallback",
                latencyMs = 0,
            )
        }
    }
}