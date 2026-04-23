package com.elekeza.backend.config

import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.scheduling.annotation.EnableAsync
import org.springframework.scheduling.annotation.EnableScheduling
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor
import org.springframework.web.client.RestTemplate
import java.util.concurrent.Executor

// ─────────────────────────────────────────────────────────────────────────────
// AppConfig — all Spring configuration beans in one place.
//
// @EnableAsync  → required for @Async on ContentService.processWithAI() to work.
//                Without this, @Async methods run synchronously — the upload
//                endpoint blocks until AI processing finishes. That's 10–30 seconds.
//
// @EnableScheduling → required for @Scheduled on AuditLogService.purgeOldLogs().
//
// THREAD POOL DESIGN (AI processing):
// corePoolSize = 3   → always 3 threads ready for AI processing
// maxPoolSize  = 10  → burst up to 10 if queue fills (pilot: unlikely to hit this)
// queueCapacity = 25 → queue 25 uploads before rejecting (prevents memory exhaustion)
// threadNamePrefix → makes logs readable: "ai-async-1", "ai-async-2" etc.
// ─────────────────────────────────────────────────────────────────────────────

@Configuration
@EnableAsync
@EnableScheduling
class AppConfig {

    // Bean for @Async methods that use the default executor
    @Bean(name = ["taskExecutor"])
    fun asyncExecutor(): Executor {
        val executor = ThreadPoolTaskExecutor()
        executor.corePoolSize    = 3
        executor.maxPoolSize     = 10
        executor.queueCapacity   = 25
        executor.setThreadNamePrefix("ai-async-")
        executor.initialize()
        return executor
    }

    // RestTemplate for calling the Python AI service
    // Set timeouts so a slow AI service doesn't block threads indefinitely
    @Bean
    fun restTemplate(): RestTemplate {
        val factory = org.springframework.http.client.SimpleClientHttpRequestFactory()
        factory.setConnectTimeout(5_000)   // 5s to establish connection
        factory.setReadTimeout(60_000)     // 60s for AI to respond (document processing can be slow)
        return RestTemplate(factory)
    }
}
