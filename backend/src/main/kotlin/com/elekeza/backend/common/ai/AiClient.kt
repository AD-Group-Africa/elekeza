package com.elekeza.backend.common.ai

interface AiClient {
    fun simplifyText(request: SimplifyTextRequest): LessonJSON
    fun simplifyImage(request: SimplifyImageRequest): LessonJSON
    fun generateQuiz(request: GenerateQuizRequest): QuizJSON
    fun adaptiveResponse(request: AdaptiveResponseRequest): AdaptiveResponseJSON
    fun wrongAnswerFlow(request: WrongAnswerFlowRequest): WrongAnswerFlowJSON
}