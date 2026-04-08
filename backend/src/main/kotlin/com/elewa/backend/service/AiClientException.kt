package com.elewa.backend.service

class AiClientException(val httpStatus: Int, message: String) : RuntimeException(message)