package com.elekeza.backend.quiz

import com.elekeza.backend.learner.LearnerProfileRepository
import com.elekeza.backend.learner.QuizAttemptRepository
import com.elekeza.backend.quiz.dto.AdaptiveRequest
import com.elekeza.backend.quiz.dto.AdaptiveResponse
import org.slf4j.LoggerFactory

class AdaptiveService(
    private val profileRepo: LearnerProfileRepository,
    private val attemptRepo: QuizAttemptRepository
) {
    fun evaluate(request: AdaptiveRequest): AdaptiveResponse {
        // Stub for now – returns a simple response
        return AdaptiveResponse(directive = "same", message = "Keep going")
    }
}
