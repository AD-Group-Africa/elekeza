package com.elekeza.backend.quiz

import com.elekeza.backend.content.Content
import org.springframework.stereotype.Service
import org.springframework.transaction.PlatformTransactionManager
import org.springframework.transaction.TransactionDefinition
import org.springframework.transaction.support.TransactionTemplate
import java.util.concurrent.ConcurrentHashMap

/**
 * Finds or creates the single quiz for a lesson.
 *
 * Several learners (or one browser sending the request twice) can start a new
 * lesson's quiz at the same moment. Without care each request creates its own
 * quiz, and every "quiz for this lesson" lookup then fails because it finds
 * more than one. Creation is therefore serialised per lesson and committed in
 * its own transaction before the lock is released, so the next request sees it.
 *
 * The lock is per JVM. Running several backend instances needs a unique index
 * on quiz.content_id as well (see frontend/docs/BACKEND_REQUESTS.md).
 */
@Service
class QuizProvisioner(
    private val quizRepo: QuizRepository,
    private val questionRepo: QuizQuestionRepository,
    private val aiQuizParser: AiQuizParser,
    transactionManager: PlatformTransactionManager,
) {
    private val newTransaction = TransactionTemplate(transactionManager).apply {
        propagationBehavior = TransactionDefinition.PROPAGATION_REQUIRES_NEW
    }
    private val locks = ConcurrentHashMap<Long, Any>()

    fun quizFor(content: Content, creatorId: Long): Quiz {
        quizRepo.findFirstByContentIdOrderByIdAsc(content.id)?.let { return it }
        val lock = locks.computeIfAbsent(content.id) { Any() }
        synchronized(lock) {
            return newTransaction.execute {
                quizRepo.findFirstByContentIdOrderByIdAsc(content.id) ?: create(content, creatorId)
            }!!
        }
    }

    private fun create(content: Content, creatorId: Long): Quiz {
        val quiz = quizRepo.save(Quiz(contentId = content.id, userId = creatorId))
        val parsed = aiQuizParser.parse(content.simplifiedText)
        if (parsed != null) {
            // Real AI questions — never substitute placeholders when the
            // stored quiz section exists but is broken/empty.
            questionRepo.saveAll(parsed.map { p ->
                QuizQuestion(
                    quizId = quiz.id,
                    question = p.question,
                    optionA = p.optionA,
                    optionB = p.optionB,
                    optionC = p.optionC,
                    optionD = p.optionD,
                    correctOption = p.correctOption,
                    explanation = p.explanation
                )
            })
        } else {
            // No stored AI quiz at all — placeholder fallback.
            questionRepo.save(QuizQuestion(quizId = quiz.id, question = "What is the main idea of this lesson?", optionA = "Option A", optionB = "Option B", optionC = "Option C", optionD = "Option D", correctOption = "A", explanation = "Review the lesson content"))
            questionRepo.save(QuizQuestion(quizId = quiz.id, question = "What is a key concept from this lesson?", optionA = "Option A", optionB = "Option B", optionC = "Option C", optionD = "Option D", correctOption = "B", explanation = "Check the lesson for details"))
        }
        return quiz
    }
}
