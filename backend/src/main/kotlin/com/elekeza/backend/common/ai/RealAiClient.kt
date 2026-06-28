package com.elekeza.backend.common.ai

import com.fasterxml.jackson.databind.ObjectMapper
import org.slf4j.LoggerFactory
import org.springframework.beans.factory.annotation.Value
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.http.HttpStatusCode
import org.springframework.http.MediaType
import org.springframework.http.client.reactive.ReactorClientHttpConnector
import org.springframework.stereotype.Service
import org.springframework.web.reactive.function.client.WebClient
import reactor.core.publisher.Mono
import reactor.netty.http.client.HttpClient
import java.time.Duration

// Ã¢â€â‚¬Ã¢â€â‚¬ WebClient configuration Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬

@Configuration
class AiWebClientConfig(
    @Value("\${ai.base-url:http://localhost:8000}") private val baseUrl: String,
    @Value("\${ai.internal-secret:dev-secret}") private val internalSecret: String
) {
    @Bean("aiWebClient")
    fun aiWebClient(): WebClient {
        val httpClient = HttpClient.create()
            .responseTimeout(Duration.ofSeconds(60))
        return WebClient.builder()
            .baseUrl(baseUrl)
            .clientConnector(ReactorClientHttpConnector(httpClient))
            .defaultHeader("Content-Type", MediaType.APPLICATION_JSON_VALUE)
            .defaultHeader("X-Internal-Key", internalSecret)
            .build()
    }
}

// Ã¢â€â‚¬Ã¢â€â‚¬ Real AI client Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬

@Service
@ConditionalOnProperty(name = ["ai.client.type"], havingValue = "real", matchIfMissing = false)
class RealAiClient(
    private val objectMapper: ObjectMapper,
    @Value("\${ai.timeout-seconds:60}") private val timeoutSeconds: Long
) : AiClient {

    private val log = LoggerFactory.getLogger(javaClass)
    private lateinit var webClient: WebClient

    // Constructor injection via qualifier
    constructor(
        webClient: WebClient,
        objectMapper: ObjectMapper,
        @Value("\${ai.timeout-seconds:60}") timeoutSeconds: Long
    ) : this(objectMapper, timeoutSeconds) {
        this.webClient = webClient
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
        log.debug("AI call Ã¢â€ â€™ $path")
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

// Keep for dev/test Ã¢â‚¬â€ activated when ai.client.type is absent or explicitly "mock"
