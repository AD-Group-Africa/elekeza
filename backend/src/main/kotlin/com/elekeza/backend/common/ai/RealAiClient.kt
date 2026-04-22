package com.elekeza.backend.common.ai

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
    @Value("\${fastapi.timeout-seconds:30}") private val timeoutSeconds: Long = 30
) : AiClient {
    private val log = LoggerFactory.getLogger(javaClass)

    override fun simplifyText(request: SimplifyTextRequest): LessonJSON   = callAi("/ai/simplify/text", request, LessonJSON::class.java)
    override fun simplifyImage(request: SimplifyImageRequest): LessonJSON = callAi("/ai/simplify/image", request, LessonJSON::class.java)
    override fun generateQuiz(request: GenerateQuizRequest): QuizJSON     = callAi("/ai/quiz/generate", request, QuizJSON::class.java)
    override fun adaptiveResponse(request: AdaptiveResponseRequest): AdaptiveResponseJSON = callAi("/ai/quiz/adaptive-response", request, AdaptiveResponseJSON::class.java)
    override fun wrongAnswerFlow(request: WrongAnswerFlowRequest): WrongAnswerFlowJSON    = callAi("/ai/quiz/wrong-answer-flow", request, WrongAnswerFlowJSON::class.java)

    private fun <T : Any> callAi(path: String, request: Any, responseType: Class<T>): T {
        log.debug("Calling AI: $path")
        val body = webClient.post()
            .uri(path)
            .bodyValue(request)
            .retrieve()
            .onStatus(HttpStatusCode::isError) { response ->
                response.bodyToMono(String::class.java)
                    .flatMap { Mono.error(AiClientException(response.statusCode().value(), "AI error: $it")) }
            }
            .bodyToMono(String::class.java)
            .block(Duration.ofSeconds(timeoutSeconds))
            ?: throw AiClientException(500, "AI service returned empty response")

        return runCatching { objectMapper.readValue(body, responseType) }
            .getOrElse { throw AiClientException(500, "Invalid AI response: ${it.message}") }
    }
}