package com.elewa.backend.service

import com.elewa.backend.dto.ai.*
import com.fasterxml.jackson.databind.ObjectMapper
import org.slf4j.LoggerFactory
import org.springframework.beans.factory.annotation.Value
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty
import org.springframework.http.HttpStatusCode
import org.springframework.stereotype.Service
import org.springframework.web.reactive.function.client.WebClient
import reactor.core.publisher.Mono
import java.time.Duration

@Service
@ConditionalOnProperty(name = ["ai.client.type"], havingValue = "real")
class RealAiClient(
    private val webClient: WebClient,
    private val objectMapper: ObjectMapper,
    @Value("\${fastapi.timeout-seconds:30}") private val timeoutSeconds: Long
) : AiClient {
    private val log = LoggerFactory.getLogger(javaClass)

    override fun simplifyText(request: SimplifyTextRequest): LessonJSON {
        return callAi("/ai/simplify/text", request, LessonJSON::class.java)
    }

    override fun simplifyImage(request: SimplifyImageRequest): LessonJSON {
        return callAi("/ai/simplify/image", request, LessonJSON::class.java)
    }

    override fun generateQuiz(request: GenerateQuizRequest): QuizJSON {
        return callAi("/ai/generate-quiz", request, QuizJSON::class.java)
    }

    override fun adaptiveResponse(request: AdaptiveResponseRequest): AdaptiveResponseJSON {
        return callAi("/ai/adaptive-response", request, AdaptiveResponseJSON::class.java)
    }

    override fun wrongAnswerFlow(request: WrongAnswerFlowRequest): WrongAnswerFlowJSON {
        return callAi("/ai/wrong-answer-flow", request, WrongAnswerFlowJSON::class.java)
    }

    private inline fun <reified T : Any> callAi(path: String, request: Any, responseType: Class<T>): T {
        log.debug("Calling AI: $path")
        val responseString = webClient.post()
            .uri(path)
            .bodyValue(request)
            .retrieve()
            .onStatus(HttpStatusCode::isError) { response ->
                response.bodyToMono(String::class.java)
                    .flatMap { errorBody ->
                        log.error("AI error on $path — $errorBody")
                        Mono.error(AiClientException(response.statusCode().value(), "AI service error"))
                    }
            }
            .bodyToMono(String::class.java)
            .block(Duration.ofSeconds(timeoutSeconds))
            ?: throw AiClientException(500, "AI service returned empty response")

        return try {
            objectMapper.readValue(responseString, responseType)
        } catch (e: Exception) {
            log.error("Failed to parse AI response: $responseString", e)
            throw AiClientException(500, "Invalid response from AI service")
        }
    }
}