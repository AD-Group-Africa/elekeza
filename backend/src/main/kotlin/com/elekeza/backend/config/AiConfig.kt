package com.elekeza.backend.config

import org.springframework.boot.context.properties.ConfigurationProperties
import org.springframework.stereotype.Component

@Component
@ConfigurationProperties(prefix = "ai")
class AiConfig {
    var baseUrl: String = ""
    var timeoutSeconds: Long = 120
    var internalSecret: String = ""
    var clientType: String = "mock"
}
