package com.elewa.backend.service

import com.elewa.backend.dto.ai.*
import com.fasterxml.jackson.databind.ObjectMapper
import org.slf4j.LoggerFactory
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty
import org.springframework.stereotype.Service

@Service
@ConditionalOnProperty(name = ["ai.client.type"], havingValue = "mock")
class MockAiClient(
    private val objectMapper: ObjectMapper
) : AiClient {
    private val log = LoggerFactory.getLogger(javaClass)

    override fun simplifyText(request: SimplifyTextRequest): LessonJSON {
        log.info("Mock: simplifyText called with ${request.rawText.length} chars")
        // Return a minimal LessonJSON structure
        return LessonJSON(
            title = "Mock Lesson",
            sections = listOf(
                AiSection(
                    heading = "Introduction",
                    body = "Mock simplified: ${request.rawText.take(100)}...",
                    visualHint = null,
                    readingLevel = 3
                )
            ),
            keyTerms = listOf(
                AiKeyTerm(term = "Mock Term", definition = "A mock definition")
            ),
            estimatedMinutes = 5,
            profile = "general",
            stageFlags = StageFlags(verificationTriggered = false, correctionApplied = false, profileMerged = false)
        )
    }

    override fun simplifyImage(request: SimplifyImageRequest): LessonJSON {
        log.info("Mock: simplifyImage called with mediaType=${request.mediaType}")
        return LessonJSON(
            title = "Mock Image Lesson",
            sections = listOf(
                AiSection(
                    heading = "Image Description",
                    body = "Mock image description: a diagram showing the solar system",
                    visualHint = null,
                    readingLevel = 2
                )
            ),
            keyTerms = emptyList(),
            estimatedMinutes = 3,
            profile = "general",
            stageFlags = StageFlags(verificationTriggered = false, correctionApplied = false, profileMerged = false)
        )
    }

    override fun generateQuiz(request: GenerateQuizRequest): QuizJSON {
        log.info("Mock: generateQuiz called for lesson ${request.lessonJson.title}")
        return QuizJSON(
            questions = listOf(
                AiQuizQuestion(
                    id = "q1",
                    text = "What is the main idea?",
                    options = listOf(
                        AiQuizOption(id = "a1", text = "Option A"),
                        AiQuizOption(id = "a2", text = "Option B")
                    ),
                    correctId = "a1",
                    explanation = "This is correct."
                )
            )
        )
    }

    override fun adaptiveResponse(request: AdaptiveResponseRequest): AdaptiveResponseJSON {
        log.info("Mock: adaptiveResponse called")
        return AdaptiveResponseJSON(
            learnerMessage = "Good try! Remember the key points.",
            directive = "REINFORCE"
        )
    }

    override fun wrongAnswerFlow(request: WrongAnswerFlowRequest): WrongAnswerFlowJSON {
        log.info("Mock: wrongAnswerFlow called")
        return WrongAnswerFlowJSON(
            reExplanation = "Let's review: ${request.sectionContent.take(100)}...",
            reattemptQuestion = "Try this similar question: ..."
        )
    }
}