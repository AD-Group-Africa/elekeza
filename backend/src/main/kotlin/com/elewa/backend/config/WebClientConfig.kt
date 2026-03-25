package com.elewa.backend.config

import org.springframework.beans.factory.annotation.Value
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.web.reactive.function.client.WebClient

@Configuration
class WebClientConfig(@Value("\${fastapi.base-url}") private val fastapiBaseUrl: String) {

    /** ALL FastAPI calls use this bean — never RestTemplate, never OkHttp directly */
    @Bean
    fun fastapiWebClient(): WebClient = WebClient.builder()
        .baseUrl(fastapiBaseUrl)
        .codecs { it.defaultCodecs().maxInMemorySize(10 * 1024 * 1024) }
        .build()
}