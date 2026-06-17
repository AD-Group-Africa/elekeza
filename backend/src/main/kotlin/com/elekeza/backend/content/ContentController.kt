package com.elekeza.backend.content

import org.springframework.web.bind.annotation.*

@RestController
@RequestMapping("/api/content")
class ContentController {

    @PostMapping("/upload/text")
    fun uploadText(): Map<String, Any> {
        return mapOf("lessonId" to 1, "status" to "READY")
    }

    @GetMapping("/lessons/{lessonId}")
    fun getLesson(@PathVariable lessonId: Long): Map<String, Any> {
        return mapOf(
            "title" to "The Water Cycle",
            "simplifiedLesson" to mapOf(
                "sections" to listOf(
                    mapOf("heading" to "What is the Water Cycle?", "body" to "Water moves around the Earth..."),
                    mapOf("heading" to "Evaporation", "body" to "The sun heats water...")
                )
            )
        )
    }
}
