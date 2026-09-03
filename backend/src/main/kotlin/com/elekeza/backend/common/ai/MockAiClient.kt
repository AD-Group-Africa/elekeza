package com.elekeza.backend.common.ai

import org.slf4j.LoggerFactory
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty
import org.springframework.stereotype.Service

@Service
@ConditionalOnProperty(name = ["ai.client.type"], havingValue = "mock")
class MockAiClient : AiClient {
    private val log = LoggerFactory.getLogger(javaClass)

    override fun simplifyText(request: SimplifyTextRequest): LessonJSON {
        log.info("Mock: simplifyText")
        return LessonJSON(
            title    = "Mock Lesson",
            sections = listOf(AiSection(heading = "Introduction", body = "Mock simplified text.")),
            keyTerms = listOf(AiKeyTerm(term = "Mock Term", definition = "A mock definition")),
            profile  = request.learnerContext.cognitiveProfiles.firstOrNull() ?: "dyslexia"
        )
    }

    override fun simplifyImage(request: SimplifyImageRequest): LessonJSON {
        log.info("Mock: simplifyImage")
        return LessonJSON(
            title    = "Mock Image Lesson",
            sections = listOf(AiSection(heading = "Image Description", body = "Mock image description.")),
            profile  = request.learnerContext.cognitiveProfiles.firstOrNull() ?: "dyslexia"
        )
    }

    override fun generateQuiz(request: GenerateQuizRequest): QuizJSON {
        log.info("Mock: generateQuiz")
        return QuizJSON(
            questions = listOf(
                AiQuizQuestion(
                    id          = "q1",
                    text        = "What is the main idea?",
                    options     = listOf(
                        AiQuizOption(id = "a", text = "Option A"),
                        AiQuizOption(id = "b", text = "Option B"),
                        AiQuizOption(id = "c", text = "Option C"),
                        AiQuizOption(id = "d", text = "Option D")
                    ),
                    correctId   = "a",
                    explanation = "The main idea is the central point of the lesson."
                )
            )
        )
    }

    override fun adaptiveResponse(request: AdaptiveResponseRequest): AdaptiveResponseJSON {
        log.info("Mock: adaptiveResponse")
        return AdaptiveResponseJSON(learnerMessage = "Good try! Keep going.", directive = "same")
    }

    override fun wrongAnswerFlow(request: WrongAnswerFlowRequest): WrongAnswerFlowJSON {
        log.info("Mock: wrongAnswerFlow")
        return WrongAnswerFlowJSON(
            reExplanation    = "Let us review the concept together.",
            reattemptQuestion = ""
        )
    }
}