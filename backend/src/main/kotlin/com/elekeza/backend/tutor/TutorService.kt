package com.elekeza.backend.tutor

import com.elekeza.backend.auth.User
import com.elekeza.backend.common.ai.AiClient
import com.elekeza.backend.common.ai.LearnerContext
import com.elekeza.backend.common.ai.TutorChatMessage
import com.elekeza.backend.common.ai.TutorChatRequest
import com.elekeza.backend.common.AuditLogService
import com.elekeza.backend.content.Content
import com.elekeza.backend.content.ContentAccessGuard
import com.elekeza.backend.content.ContentRepository
import com.elekeza.backend.content.LessonView
import com.elekeza.backend.learner.LearnerProfileRepository
import com.elekeza.backend.learner.LessonProgressRepository
import com.elekeza.backend.mastery.MasteryEngine
import com.elekeza.backend.quiz.QuizAttemptRepository
import com.elekeza.backend.quiz.QuizRepository
import com.fasterxml.jackson.databind.ObjectMapper
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.http.HttpStatus
import org.springframework.stereotype.Service
import org.springframework.web.server.ResponseStatusException
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.ConcurrentMap
import java.util.concurrent.atomic.AtomicInteger

/**
 * AI Tutor service: resolves the learner's current lesson context, enforces
 * access control, and produces grounded learning support.
 *
 * Provider strategy: the deterministic TutorEngine always works. When a REAL
 * AiClient bean is configured, EXPLAIN/SUMMARY responses call /ai/tutor/chat
 * and are marked source = "provider" on success; any failure, blank reply,
 * or provider-signalled fallback silently returns the engine's output with
 * source = "deterministic" instead. The learner never sees a broken tutor,
 * and the UI never labels engine output as live AI.
 *
 * Practice questions are held in a short-lived in-process session store (no
 * database writes). Sessions carry the owner's id so one learner can never
 * answer another's question. This is correct for the single-instance pilot
 * deployment; a clustered deployment would move this to a shared store.
 */
@Service
class TutorService(
    private val contentRepo: ContentRepository,
    private val accessGuard: ContentAccessGuard,
    private val progressRepo: LessonProgressRepository,
    private val quizRepo: QuizRepository,
    private val attemptRepo: QuizAttemptRepository,
    private val objectMapper: ObjectMapper,
    private val auditLog: AuditLogService,
    private val learnerProfileRepo: LearnerProfileRepository,
    /** Optional: absent when no AI provider is configured (ai.client.type unset). */
    @Autowired(required = false) private val aiClient: AiClient? = null
) {

    private data class PracticeSession(
        val ownerId: Long,
        val lessonId: Long,
        val question: PracticeQuestion,
        val attempts: AtomicInteger = AtomicInteger(0),
        val createdAt: Long = System.currentTimeMillis()
    )

    private val practiceSessions: ConcurrentMap<String, PracticeSession> = ConcurrentHashMap()

    /** Honest capability flag for the UI: is a live AI provider configured? */
    val providerConfigured: Boolean
        get() = aiClient != null

    companion object {
        private const val MAX_SESSIONS = 5_000
        private const val SESSION_TTL_MS = 30 * 60 * 1000L
        private const val MAX_LESSON_CHARS = 20_000
    }

    fun handle(user: User, req: TutorRequest): TutorResponse {
        if (req.action == TutorAction.PRACTICE && req.practiceId != null) {
            return gradeAnswer(user, req)
        }

        val (lessonId, title, body, keyTerms) = resolveLesson(user, req.lessonId)

        val response: TutorResponse = when (req.action) {
            TutorAction.EXPLAIN -> {
                val engineContent = if (req.variant == "simpler") TutorEngine.explainSimpler(title, body)
                                    else TutorEngine.explain(title, body, keyTerms)
                val (content, source) = tryProviderReply(user, "explain", title, body, engineContent)
                TutorResponse(action = req.action, intro = masteryIntro(user, lessonId), content = content, source = source)
            }
            TutorAction.SUMMARY -> {
                val engineContent = TutorEngine.summarize(title, body, keyTerms)
                val (content, source) = tryProviderReply(user, "summarise", title, body, engineContent)
                TutorResponse(action = req.action, intro = masteryIntro(user, lessonId), content = content, source = source)
            }
            TutorAction.TRANSLATE -> {
                val text = req.text?.take(600)?.trim().orEmpty().ifBlank {
                    body.split(Regex("(?<=[.!?])\\s+")).take(2).joinToString(" ")
                }
                // Deterministic dictionary today; a provider-backed translator
                // plugs in here without changing the response contract.
                val (translated, by) = TutorEngine.translateToKiswahili(text)
                TutorResponse(action = req.action, content = translated, originalText = text, translatedBy = by)
            }
            TutorAction.DIAGRAM -> TutorResponse(
                action = req.action,
                diagram = TutorEngine.makeDiagram(title, body)
            )
            TutorAction.PRACTICE -> startPractice(user, lessonId, title, body)
        }

        recordUsage(user, req, title)
        return response
    }

    /** Calls /ai/tutor/chat for EXPLAIN/SUMMARY when a provider is configured.
     *  Returns (content, source) — falls back to the deterministic content
     *  and source = "deterministic" on any failure, blank reply, or
     *  provider-signalled fallback. Never throws. */
    private fun tryProviderReply(
        user: User,
        pythonAction: String,
        title: String,
        body: String,
        deterministicContent: String
    ): Pair<String, String> {
        val client = aiClient ?: return deterministicContent to "deterministic"
        return runCatching {
            val request = TutorChatRequest(
                learnerContext = buildLearnerContext(user),
                messages = listOf(
                    TutorChatMessage(role = "user", content = "Please $pythonAction this lesson: $title")
                ),
                lessonContext = "$title\n\n$body".take(MAX_LESSON_CHARS),
                currentAction = pythonAction
            )
            val result = client.tutorChat(request)
            if (result.fallback || result.reply.isBlank()) {
                deterministicContent to "deterministic"
            } else {
                result.reply to "provider"
            }
        }.getOrElse { deterministicContent to "deterministic" }
    }

    private fun buildLearnerContext(user: User): LearnerContext {
        val sneType = learnerProfileRepo.findByUserId(user.id)?.sneType?.name
        return LearnerContext.fromSneType(user.id, sneType)
    }

    /** Returns (lessonId, title, body, keyTerms) with access control enforced. */
    private fun resolveLesson(user: User, lessonId: Long?): Quad<Long, String, String, Map<String, String>> {
        val id = lessonId
            ?: progressRepo.findByUserIdOrderByCreatedAtDesc(user.id).firstOrNull()?.contentId
            ?: throw ResponseStatusException(HttpStatus.BAD_REQUEST, "No lesson in context — open a lesson first")
        val content = contentRepo.findById(id)
            .orElseThrow { ResponseStatusException(HttpStatus.NOT_FOUND, "Lesson not found") }
        accessGuard.requireAccess(user, content)

        val parsed = LessonView.parseSimplified(content.simplifiedText, objectMapper)
        val title = parsed.title.ifBlank { content.title ?: "This lesson" }
        var body = parsed.sections.joinToString("\n\n") { s ->
            if (s.heading.isNotBlank()) s.heading + ". " + s.body else s.body
        }
        if (body.isBlank()) body = content.rawText?.take(MAX_LESSON_CHARS) ?: ""
        return Quad(id, title, body, parsed.keyTerms)
    }

    private data class Quad<A, B, C, D>(val first: A, val second: B, val third: C, val fourth: D)

    private fun masteryIntro(user: User, lessonId: Long?): String? {
        val quiz = quizRepo.findByContentId(lessonId ?: return null) ?: return null
        val scores = attemptRepo.findByQuizIdAndUserId(quiz.id, user.id)
            .filter { it.completed && it.score != null }
            .sortedBy { it.createdAt }
            .map { it.score!! }
        if (scores.isEmpty()) return null
        return TutorEngine.masteryIntro(MasteryEngine.evaluate(scores).state.name)
    }

    private fun startPractice(user: User, lessonId: Long, title: String, body: String): TutorResponse {
        if (body.isBlank()) {
            throw ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "This lesson has no text to practice from yet")
        }
        sweep()
        val pid = TutorEngine.newPracticeId()
        val q = TutorEngine.makePractice(title, body)
        practiceSessions[pid] = PracticeSession(ownerId = user.id, lessonId = lessonId, question = q)
        return TutorResponse(
            action = TutorAction.PRACTICE,
            intro = masteryIntro(user, lessonId),
            practice = PracticeQuestionDto(practiceId = pid, question = q.question, options = q.options, lessonTitle = title)
        )
    }

    fun gradeAnswer(user: User, req: TutorRequest): TutorResponse {
        val pid = req.practiceId ?: throw ResponseStatusException(HttpStatus.BAD_REQUEST, "Missing practice id")
        val session = practiceSessions[pid]
            ?: throw ResponseStatusException(HttpStatus.GONE, "This practice question has expired — ask for a new one")
        // Cross-learner safety: only the learner who received the question may answer it.
        if (session.ownerId != user.id) {
            throw ResponseStatusException(HttpStatus.FORBIDDEN, "Not your practice question")
        }
        val fb = TutorEngine.gradePractice(session.question, req.answerIndex)
        session.attempts.incrementAndGet()
        if (fb.correct) practiceSessions.remove(pid)
        recordUsage(user, req, title = null)
        return TutorResponse(action = TutorAction.PRACTICE, feedback = fb)
    }

    private fun recordUsage(user: User, req: TutorRequest, title: String?) {
        // Teacher-visible learning signal: action + lesson + timestamp only.
        // NO conversational content is ever stored — the tutor must not
        // become surveillance.
        runCatching {
            auditLog.log(
                action = "TUTOR_${req.action.name}",
                category = "TUTOR",
                userId = user.id,
                detail = title?.let { """{"lesson":"${it.take(80)}"}""" }
            )
        }
    }

    /** Test-only (same package): inspect the stored question for a session. */
    internal fun storedQuestion(practiceId: String): PracticeQuestion? = practiceSessions[practiceId]?.question

    private fun sweep() {
        if (practiceSessions.size <= MAX_SESSIONS) return
        val now = System.currentTimeMillis()
        practiceSessions.entries.removeIf { now - it.value.createdAt > SESSION_TTL_MS }
    }
}