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
            sections = listOf(AiSection(header = "Introduction", content = "Mock simplified text.")),
            terms    = listOf(AiKeyTerm(term = "Mock Term", definition = "A mock definition"))
        )
    }

    override fun simplifyImage(request: SimplifyImageRequest): LessonJSON {
        log.info("Mock: simplifyImage")
        return LessonJSON(
            title    = "Mock Image Lesson",
            sections = listOf(AiSection(header = "Image Description", content = "Mock image description.")),
            terms    = emptyList()
        )
    }

    override fun generateQuiz(request: GenerateQuizRequest): QuizJSON {
        log.info("Mock: generateQuiz")
        return QuizJSON(
            questions = listOf(
                AiQuizQuestion(
                    question = "What is the main idea?",
                    options  = listOf(
                        AiQuizOption(text = "Option A", isCorrect = true),
                        AiQuizOption(text = "Option B", isCorrect = false)
                    )
                )
            )
        )
    }

    override fun adaptiveResponse(request: AdaptiveResponseRequest): AdaptiveResponseJSON {
        log.info("Mock: adaptiveResponse")
        return AdaptiveResponseJSON(response = "Good try! Keep going.")
    }

    override fun wrongAnswerFlow(request: WrongAnswerFlowRequest): WrongAnswerFlowJSON {
        log.info("Mock: wrongAnswerFlow")
        return WrongAnswerFlowJSON(feedback = "Let us review.", hint = "Think carefully.")
    }
}