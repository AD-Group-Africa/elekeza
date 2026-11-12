package com.elekeza.backend.quiz

import com.elekeza.backend.auth.UserRepository
import com.elekeza.backend.content.Content
import com.elekeza.backend.content.ContentRepository
import com.elekeza.backend.content.ContentStatus
import com.elekeza.backend.learner.LessonProgress
import com.elekeza.backend.learner.LessonProgressRepository
import com.elekeza.backend.mastery.MasteryController
import com.elekeza.backend.quiz.controller.QuizController
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import java.util.concurrent.Callable
import java.util.concurrent.CountDownLatch
import java.util.concurrent.Executors

/**
 * Several first "start quiz" requests for a new lesson arriving at once must
 * share one quiz. Before the fix each created its own, after which the
 * lesson's quiz could not be started again and the learner's mastery map
 * failed on every load.
 */
@SpringBootTest(
    properties = [
        "spring.profiles.active=dev",
        "ai.client.type=mock",
        "ai.internal-secret=test-internal-secret",
        "spring.datasource.url=jdbc:h2:mem:elekeza;DB_CLOSE_DELAY=-1;MODE=PostgreSQL",
        "spring.datasource.username=sa",
        "spring.datasource.password=",
    ]
)
class QuizStartConcurrencyTest {

    @Autowired lateinit var quizController: QuizController
    @Autowired lateinit var masteryController: MasteryController
    @Autowired lateinit var quizRepo: QuizRepository
    @Autowired lateinit var contentRepo: ContentRepository
    @Autowired lateinit var progressRepo: LessonProgressRepository
    @Autowired lateinit var userRepo: UserRepository

    @Test
    fun `concurrent first starts create a single quiz`() {
        val teacher = userRepo.findByEmail("teacher@elekeza.app")!!
        val student = userRepo.findByEmail("student@elekeza.app")!!
        val lesson = contentRepo.save(
            Content(
                userId = teacher.id,
                title = "Concurrency lesson",
                status = ContentStatus.READY,
                simplifiedText = "Plants need sunlight, water and air to grow.",
            )
        )
        progressRepo.save(LessonProgress(user = student, contentId = lesson.id))

        val threads = 8
        val ready = CountDownLatch(threads)
        val go = CountDownLatch(1)
        val pool = Executors.newFixedThreadPool(threads)
        val results = (1..threads).map {
            pool.submit(Callable {
                ready.countDown()
                go.await()
                quizController.startQuiz(lesson.id, student)["quizId"] as Long
            })
        }
        ready.await()
        go.countDown()
        val quizIds = results.map { it.get() }.toSet()
        pool.shutdown()

        assertThat(quizIds).hasSize(1)
        assertThat(quizRepo.findByContentIdIn(listOf(lesson.id))).hasSize(1)
        // Later starts and the learner's mastery map keep working.
        assertThat(quizController.startQuiz(lesson.id, student)["quizId"]).isEqualTo(quizIds.single())
        assertThat(masteryController.myMastery(student).map { it.contentId }).contains(lesson.id)
    }

    @Test
    fun `lessons with duplicate quizzes from before the fix still resolve`() {
        val teacher = userRepo.findByEmail("teacher@elekeza.app")!!
        val student = userRepo.findByEmail("student@elekeza.app")!!
        val lesson = contentRepo.save(
            Content(userId = teacher.id, title = "Duplicated", status = ContentStatus.READY, simplifiedText = "Water cycle.")
        )
        progressRepo.save(LessonProgress(user = student, contentId = lesson.id))
        val first = quizController.startQuiz(lesson.id, student)["quizId"] as Long
        quizRepo.save(Quiz(contentId = lesson.id, userId = student.id)) // simulate an old duplicate

        assertThat(quizController.startQuiz(lesson.id, student)["quizId"]).isEqualTo(first)
        assertThat(masteryController.myMastery(student).map { it.contentId }).contains(lesson.id)
    }
}
