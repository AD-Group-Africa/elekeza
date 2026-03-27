package com.elewa.backend.service

import com.elewa.backend.dto.ai.LessonJSON
import com.elewa.backend.dto.ai.SimplifyRequest
import org.springframework.beans.factory.annotation.Value
import org.springframework.stereotype.Component
import org.springframework.web.reactive.function.client.WebClient
import org.springframework.web.reactive.function.client.awaitBody

@Component
class RealAiClient(
    private val webClient: WebClient,
    @Value("\${fastapi.base-url}") private val baseUrl: String
) : AiClient {

    override suspend fun simplify(request: SimplifyRequest): LessonJSON {
        return webClient.post()
            .uri("$baseUrl/ai/simplify")
            .contentType(org.springframework.http.MediaType.APPLICATION_JSON)
            .bodyValue(request)
            .retrieve()
            .awaitBody()
    }
}