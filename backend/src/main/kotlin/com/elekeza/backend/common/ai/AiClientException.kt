package com.elekeza.backend.common.ai

class AiClientException(val statusCode: Int, message: String) : RuntimeException(message) {
    constructor(message: String) : this(500, message)
}