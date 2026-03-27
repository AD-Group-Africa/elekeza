package com.elewa.backend.config

import com.elewa.backend.service.AiClient
import com.elewa.backend.service.RealAiClient
import org.springframework.beans.factory.annotation.Value
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.web.reactive.function.client.WebClient

@Configuration
class AiConfig {

    @Bean
    fun aiClient(webClient: WebClient, @Value("\${fastapi.base-url}") baseUrl: String): AiClient {
        return RealAiClient(webClient, baseUrl)
    }
}