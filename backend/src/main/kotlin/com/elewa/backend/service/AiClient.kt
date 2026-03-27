package com.elewa.backend.service

import com.elewa.backend.dto.ai.LessonJSON
import com.elewa.backend.dto.ai.SimplifyRequest

interface AiClient {
    suspend fun simplify(request: SimplifyRequest): LessonJSON
}