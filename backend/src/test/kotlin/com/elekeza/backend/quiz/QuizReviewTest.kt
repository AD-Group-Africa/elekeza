package com.elekeza.backend.quiz

import com.elekeza.backend.auth.User
import com.elekeza.backend.auth.UserRepository
import com.elekeza.backend.learner.LessonProgress
import com.elekeza.backend.learner.LessonProgressRepository
import com.elekeza.backend.quiz.controller.QuizController
import org.assertj.core.api.Assertions.assertThat
import org.assertj.core.api.Assertions.assertThatThrownBy
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.web.server.ResponseStatusException

/**
 * End-to-end controller tests for the quiz review flow (dev profile, H2).
 * Exercises real persistence: /start -> /answer -> /complete -> /review.
 */
@SpringBootTest(
    properties = [
        "spring.profiles.active=dev",
        "ai.client.type=mock",
        "ai.internal-secret=test-internal-secret",
    ]
)
class QuizReviewTest {

    @Autowired lateinit var controller: QuizController
    @Autowired lateinit var userRepo: UserRepository
    @Autowired lateinit var progressRepo: LessonProgressRepository
    @Autowired lateinit var attemptRepo: QuizAttemptRepository
    @Autowired lateinit var answerRepo: QuizAnswerRepository
    @Autowired lateinit var questionRepo: QuizQuestionRepository

    @BeforeEach
    fun setUp() {
        // Remove the dev seed's completed attempt so the "no completed attempt"
        // rule is testable, and grant the student access to lesson 1 (the demo
        // content is owned by the seeded teacher).
        answerRepo.deleteAll()
        attemptRepo.deleteAll()
        val student = student()
        if (progressRepo.findByUserIdAndContentId(student.id, 1L) == null) {
            progressRepo.save(LessonProgress(user = student, contentId = 1L))
        }
    }

    private fun student(): User = userRepo.findByEmail("student@elekeza.app")!!

    private fun teacher(): User = userRepo.findByEmail("teacher@elekeza.app")!!

    private fun startQuiz(): Long = controller.startQuiz(1L, student())["quizId"] as Long

    // ── Security ─────────────────────────────────────────────────────────────

    @Test
    fun `review before completing the quiz is forbidden`() {
        val quizId = startQuiz()
        val question = questionRepo.findByQuizId(quizId).first()
        controller.submitAnswer(quizId, mapOf("questionId" to question.id, "selectedOptionId" to "A"), student())

        assertThatThrownBy { controller.reviewQuiz(quizId, student()) }
            .isInstanceOf(ResponseStatusException::class.java)
            .hasMessageContaining("Complete the quiz before reviewing answers")
    }

    @Test
    fun `another user cannot review a quiz they did not complete`() {
        val quizId = startQuiz()
        val questions = questionRepo.findByQuizId(quizId)
        controller.completeQuiz(
            quizId,
            listOf(AnswerSubmission(questions[0].id, "A"), AnswerSubmission(questions[1].id, "B")),
            student()
        )

        assertThatThrownBy { controller.reviewQuiz(quizId, teacher()) }
            .isInstanceOf(ResponseStatusException::class.java)
            .hasMessageContaining("Complete the quiz before reviewing answers")
    }

    @Test
    fun `reviewing an unknown quiz returns not found`() {
        assertThatThrownBy { controller.reviewQuiz(999L, student()) }
            .isInstanceOf(ResponseStatusException::class.java)
            .hasMessageContaining("Quiz not found")
    }

    // ── Persistence ──────────────────────────────────────────────────────────

    @Test
    fun `answers submitted via the answer endpoint are persisted per attempt`() {
        val quizId = startQuiz()
        val questions = questionRepo.findByQuizId(quizId)

        // q1 correct answer is A -> answering B is wrong; q2 correct is B -> B is right.
        controller.submitAnswer(quizId, mapOf("questionId" to questions[0].id, "selectedOptionId" to "B"), student())
        controller.submitAnswer(quizId, mapOf("questionId" to questions[1].id, "selectedOptionId" to "B"), student())

        val pending = attemptRepo.findByQuizIdAndUserId(quizId, student().id).first { !it.completed }
        val saved = answerRepo.findByAttemptId(pending.id)
        assertThat(saved).hasSize(2)
        assertThat(saved.first { it.questionId == questions[0].id }.isCorrect).isFalse()
        assertThat(saved.first { it.questionId == questions[1].id }.isCorrect).isTrue()
    }

    @Test
    fun `completing without calling answer first also persists the submitted answers`() {
        val quizId = startQuiz()
        val questions = questionRepo.findByQuizId(quizId)

        controller.completeQuiz(
            quizId,
            listOf(AnswerSubmission(questions[0].id, "A"), AnswerSubmission(questions[1].id, "B")),
            student()
        )

        val completed = attemptRepo.findByQuizIdAndUserId(quizId, student().id).first { it.completed }
        assertThat(answerRepo.findByAttemptId(completed.id)).hasSize(2)
    }

    // ── Review content ───────────────────────────────────────────────────────

    @Test
    @Suppress("UNCHECKED_CAST")
    fun `review after completion returns per-question results without leaking during answering`() {
        val quizId = startQuiz()
        val questions = questionRepo.findByQuizId(quizId)
        val first = questions[0]
        val second = questions[1]

        // q1 (correct A) answered correctly; q2 (correct B) answered wrongly.
        val answerResponse = controller.submitAnswer(
            quizId,
            mapOf("questionId" to first.id, "selectedOptionId" to "A"),
            student()
        )
        // The live answer response must never include the answer key.
        assertThat(answerResponse).doesNotContainKey("correctOption")
        assertThat(answerResponse).doesNotContainKey("explanation")

        controller.submitAnswer(quizId, mapOf("questionId" to second.id, "selectedOptionId" to "A"), student())
        controller.completeQuiz(
            quizId,
            listOf(AnswerSubmission(first.id, "A"), AnswerSubmission(second.id, "A")),
            student()
        )

        val review = controller.reviewQuiz(quizId, student())
        assertThat(review["score"] as Double).isEqualTo(50.0)
        assertThat(review["totalQuestions"] as Int).isEqualTo(2)
        val items = review["questions"] as List<Map<String, Any>>
        assertThat(items).hasSize(2)

        val firstItem = items.first { it["questionId"] as Long == first.id }
        assertThat(firstItem["userAnswer"]).isEqualTo("A")
        assertThat(firstItem["correctAnswer"]).isEqualTo("A")
        assertThat(firstItem["correct"]).isEqualTo(true)
        assertThat(firstItem["explanation"] as String).isNotBlank()

        val secondItem = items.first { it["questionId"] as Long == second.id }
        assertThat(secondItem["correct"]).isEqualTo(false)
        assertThat(secondItem["correctAnswer"]).isEqualTo("B")
    }
}
