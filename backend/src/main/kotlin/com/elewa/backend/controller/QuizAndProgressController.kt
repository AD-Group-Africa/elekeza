package com.elewa.backend.controller

import com.elewa.backend.dto.*
import com.elewa.backend.service.DashboardService
import com.elewa.backend.service.QuizService
import org.springframework.http.ResponseEntity
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.security.core.userdetails.UserDetails
import org.springframework.web.bind.annotation.*
import java.util.UUID

@RestController
@RequestMapping("/api/quiz")
class QuizController(
    private val quizService: QuizService
) {

    // GET /api/quiz/{lessonId}/start
    @GetMapping("/{lessonId}/start")
    fun startQuiz(
        @AuthenticationPrincipal principal: UserDetails,
        @PathVariable lessonId: UUID
    ): ResponseEntity<QuizStartResponse> {
        val learnerId = UUID.fromString(principal.username)
        return ResponseEntity.ok(quizService.startQuiz(learnerId, lessonId))
    }

    // POST /api/quiz/{quizId}/answer
    @PostMapping("/{quizId}/answer")
    fun submitAnswer(
        @AuthenticationPrincipal principal: UserDetails,
        @PathVariable quizId: UUID,
        @RequestBody request: AnswerRequest
    ): ResponseEntity<AnswerResponse> {
        val learnerId = UUID.fromString(principal.username)
        return ResponseEntity.ok(quizService.submitAnswer(learnerId, quizId, request))
    }

    // GET /api/quiz/{quizId}/complete
    @GetMapping("/{quizId}/complete")
    fun completeQuiz(
        @AuthenticationPrincipal principal: UserDetails,
        @PathVariable quizId: UUID
    ): ResponseEntity<QuizCompleteResponse> {
        val learnerId = UUID.fromString(principal.username)
        return ResponseEntity.ok(quizService.completeQuiz(learnerId, quizId))
    }

    // GET /api/quiz/{quizId}/review
    @GetMapping("/{quizId}/review")
    fun reviewQuiz(
        @AuthenticationPrincipal principal: UserDetails,
        @PathVariable quizId: UUID
    ): ResponseEntity<QuizCompleteResponse> {
        val learnerId = UUID.fromString(principal.username)
        return ResponseEntity.ok(quizService.reviewQuiz(learnerId, quizId))
    }
}

@RestController
@RequestMapping("/api/progress")
class ProgressController(
    private val dashboardService: DashboardService
) {

    // GET /api/progress/dashboard
    @GetMapping("/dashboard")
    fun getDashboard(
        @AuthenticationPrincipal principal: UserDetails
    ): ResponseEntity<DashboardResponse> {
        val learnerId = UUID.fromString(principal.username)
        return ResponseEntity.ok(dashboardService.getDashboard(learnerId))
    }
}
