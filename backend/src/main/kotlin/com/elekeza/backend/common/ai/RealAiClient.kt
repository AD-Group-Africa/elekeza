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
@ConditionalOnProperty(name = ["ai.client.type"], havingValue = "real", matchIfMissing = false)
class RealAiClient(
    private val objectMapper: ObjectMapper,
    @Value("\${ai.base-url:http://localhost:8000}") private val baseUrl: String,
    @Value("\${ai.internal-secret:dev-secret}") private val internalSecret: String,
    @Value("\${ai.timeout-seconds:60}") private val timeoutSeconds: Long
) : AiClient {

    private val log = LoggerFactory.getLogger(javaClass)

    private val webClient: WebClient by lazy {
        WebClient.builder()
            .baseUrl(baseUrl)
            .defaultHeader("X-Internal-Key", internalSecret)
            .build()
    }

    override fun simplifyText(request: SimplifyTextRequest): LessonJSON =
        call("/ai/simplify/text", request, LessonJSON::class.java)

    override fun simplifyImage(request: SimplifyImageRequest): LessonJSON =
        call("/ai/simplify/image", request, LessonJSON::class.java)

    override fun generateQuiz(request: GenerateQuizRequest): QuizJSON =
        call("/ai/quiz/generate", request, QuizJSON::class.java)

    override fun adaptiveResponse(request: AdaptiveResponseRequest): AdaptiveResponseJSON =
        call("/ai/quiz/adaptive-response", request, AdaptiveResponseJSON::class.java)

    override fun wrongAnswerFlow(request: WrongAnswerFlowRequest): WrongAnswerFlowJSON =
        call("/ai/quiz/wrong-answer-flow", request, WrongAnswerFlowJSON::class.java)

    private fun <T : Any> call(path: String, body: Any, type: Class<T>): T {
        log.debug("AI call -> $path")
        val raw = webClient.post()
            .uri(path)
            .bodyValue(body)
            .retrieve()
            .onStatus(HttpStatusCode::isError) { resp ->
                resp.bodyToMono(String::class.java)
                    .flatMap { Mono.error(AiClientException(resp.statusCode().value(), "AI error on $path: $it")) }
            }
            .bodyToMono(String::class.java)
            .timeout(Duration.ofSeconds(timeoutSeconds))
            .block()
            ?: throw AiClientException(500, "AI service returned empty response for $path")

        return runCatching { objectMapper.readValue(raw, type) }
            .getOrElse { throw AiClientException(500, "Cannot parse AI response from $path: ${it.message}") }
    }
}
