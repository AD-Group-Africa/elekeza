package com.elekeza.backend.config
import org.springframework.beans.factory.annotation.Value
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.web.reactive.function.client.WebClient

@Configuration
class WebClientConfig(
    @Value("\${fastapi.base-url}")       private val fastapiBaseUrl: String,
    @Value("\${fastapi.internal-secret}") private val internalSecret: String
) {
    @Bean
    fun fastapiWebClient(): WebClient = WebClient.builder()
        .baseUrl(fastapiBaseUrl)
        .defaultHeader("X-Internal-Key", internalSecret)
        .codecs { it.defaultCodecs().maxInMemorySize(10 * 1024 * 1024) }
        .build()
}
