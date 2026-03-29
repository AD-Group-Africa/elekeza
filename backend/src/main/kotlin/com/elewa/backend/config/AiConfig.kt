package com.elewa.backend.config

import org.springframework.beans.factory.annotation.Value
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.web.reactive.function.client.WebClient

@Configuration
class AiConfig(
    @Value("\${fastapi.base-url}")       private val baseUrl: String,
    @Value("\${fastapi.internal-secret}") private val internalSecret: String
) {

    @Bean
    fun webClient(): WebClient =
        WebClient.builder()
            .baseUrl(baseUrl)
            // Required by Alvin's FastAPI — missing or wrong = 401 immediately
            .defaultHeader("X-Internal-Key", internalSecret)
            .build()
}