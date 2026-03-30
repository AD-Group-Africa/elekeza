package com.elewa.backend.service

import com.elewa.backend.dto.ai.*

interface AiClient {
    suspend fun simplifyText(request: SimplifyTextRequest): LessonJSON
    suspend fun simplifyImage(request: SimplifyImageRequest): LessonJSON
    suspend fun generateQuiz(request: GenerateQuizRequest): QuizJSON
    suspend fun adaptiveResponse(request: AdaptiveResponseRequest): AdaptiveResponseJSON
    suspend fun wrongAnswerFlow(request: WrongAnswerFlowRequest): WrongAnswerFlowJSON
}