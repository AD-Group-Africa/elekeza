package com.ELEKEZA.backend.service

class AiClientException(val httpStatus: Int, message: String) : RuntimeException(message)