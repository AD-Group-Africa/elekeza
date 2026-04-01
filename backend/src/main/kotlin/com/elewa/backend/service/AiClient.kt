package com.elewa.backend.service

import com.elewa.backend.dto.ai.*

interface AiClient {
    fun simplifyText(request: SimplifyTextRequest): LessonJSON
    fun simplifyImage(request: SimplifyImageRequest): LessonJSON
    fun generateQuiz(request: GenerateQuizRequest): QuizJSON
    fun adaptiveResponse(request: AdaptiveResponseRequest): AdaptiveResponseJSON
    fun wrongAnswerFlow(request: WrongAnswerFlowRequest): WrongAnswerFlowJSON
}