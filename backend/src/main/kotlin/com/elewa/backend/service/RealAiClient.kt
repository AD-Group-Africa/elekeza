package com.elewa.backend.service

import com.elewa.backend.dto.ai.*
import kotlinx.coroutines.delay
import org.slf4j.LoggerFactory
import org.springframework.beans.factory.annotation.Value
import org.springframework.http.HttpStatus
import org.springframework.http.MediaType
import org.springframework.stereotype.Component
import org.springframework.web.reactive.function.client.WebClient
import org.springframework.web.reactive.function.client.WebClientResponseException
import org.springframework.web.reactive.function.client.awaitBody

@Component
class RealAiClient(
    private val webClient: WebClient
) : AiClient {

    private val log = LoggerFactory.getLogger(RealAiClient::class.java)

    // ── Public API ────────────────────────────────────────────────────────────

    override suspend fun simplifyText(request: SimplifyTextRequest): LessonJSON =
        post("/ai/simplify/text", request)

    override suspend fun simplifyImage(request: SimplifyImageRequest): LessonJSON =
        post("/ai/simplify/image", request)

    override suspend fun generateQuiz(request: GenerateQuizRequest): QuizJSON =
        post("/ai/quiz/generate", request)

    override suspend fun adaptiveResponse(request: AdaptiveResponseRequest): AdaptiveResponseJSON =
        post("/ai/quiz/adaptive-response", request)

    override suspend fun wrongAnswerFlow(request: WrongAnswerFlowRequest): WrongAnswerFlowJSON =
        post("/ai/quiz/wrong-answer-flow", request)

    // ── Core HTTP ─────────────────────────────────────────────────────────────

    private suspend inline fun <reified T : Any> post(path: String, body: Any): T {
        return withRetry(path) {
            webClient.post()
                .uri(path)
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue(body)
                .retrieve()
                .awaitBody()
        }
    }

    /**
     * Retry logic per Alvin's error contract:
     *   TIMEOUT (504)    → retry once after 2s
     *   RATE_LIMIT (429) → retry once after 5s
     *   All others       → throw immediately
     */
    private suspend fun <T> withRetry(path: String, block: suspend () -> T): T {
        return try {
            block()
        } catch (ex: WebClientResponseException) {
            val retryDelay = when (ex.statusCode) {
                HttpStatus.GATEWAY_TIMEOUT -> {
                    log.warn("AI service TIMEOUT on $path — retrying after 2s")
                    2_000L
                }
                HttpStatus.TOO_MANY_REQUESTS -> {
                    log.warn("AI service RATE_LIMIT on $path — retrying after 5s")
                    5_000L
                }
                else -> throw mapAiException(ex, path)
            }
            delay(retryDelay)
            try {
                block()
            } catch (retryEx: WebClientResponseException) {
                throw mapAiException(retryEx, path)
            }
        }
    }

    private fun mapAiException(ex: WebClientResponseException, path: String): AiClientException {
        val errorCode = runCatching {
            ex.getResponseBodyAs(AiErrorResponse::class.java)?.errorCode
        }.getOrNull() ?: ex.statusCode.toString()

        log.error("AI service error on $path — code=$errorCode status=${ex.statusCode}")

        return when (errorCode) {
            "TIMEOUT"        -> AiClientException(errorCode, "The AI service did not respond in time. Please try again.", ex.statusCode.value())
            "RATE_LIMIT"     -> AiClientException(errorCode, "The AI service is busy. Please try again in a moment.", ex.statusCode.value())
            "SCHEMA_INVALID" -> AiClientException(errorCode, "The AI returned an unexpected response. Please try again.", ex.statusCode.value())
            "EMPTY_CONTENT"  -> AiClientException(errorCode, "Content cannot be empty.", ex.statusCode.value())
            "OVERSIZED"      -> AiClientException(errorCode, "Content exceeds the 5000-word limit. Please shorten and try again.", ex.statusCode.value())
            "NON_ENGLISH"    -> AiClientException(errorCode, "Content must be in English.", ex.statusCode.value())
            "OCR_FAILED"     -> AiClientException(errorCode, "Could not extract text from the image. Please upload a clearer image.", ex.statusCode.value())
            "UNAUTHORISED"   -> AiClientException(errorCode, "AI service authentication failed. Contact support.", 401)
            else             -> AiClientException(errorCode, "An unexpected AI service error occurred.", ex.statusCode.value())
        }
    }
}

data class AiClientException(
    val errorCode: String,
    override val message: String,
    val httpStatus: Int
) : RuntimeException(message)