package com.elekeza.backend.exam

import com.elekeza.backend.auth.User
import com.elekeza.backend.auth.UserRepository
import com.elekeza.backend.auth.UserRole
import com.elekeza.backend.common.AuditLogService
import com.elekeza.backend.institution.GuardianLinkRepository
import org.springframework.http.HttpStatus
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.server.ResponseStatusException
import java.time.Instant
import java.time.temporal.ChronoUnit

/**
 * Server-authoritative exam engine.
 *
 * The backend owns: availability windows, attempt limits, start/expiry timing,
 * submission state, marking and scores. The browser timer is display-only and
 * the browser is NEVER trusted for authorization or timing.
 *
 * Integrity events are advisory — they inform human review (see
 * listIntegrityEvents) but never automatically fail a student. Browser
 * lockdown cannot be absolute; controls are layered.
 */
@Service
class ExamService(
    private val examRepo: ExamRepository,
    private val questionRepo: ExamQuestionRepository,
    private val attemptRepo: ExamAttemptRepository,
    private val answerRepo: ExamAnswerRepository,
    private val integrityRepo: ExamIntegrityEventRepository,
    private val userRepo: UserRepository,
    private val guardianLinkRepo: GuardianLinkRepository,
    private val auditLog: AuditLogService,
) {

    companion object {
        /** Grace window after expiry during which a late submit is still accepted. */
        private const val LATE_GRACE_SECONDS = 20L
        val INTEGRITY_EVENT_TYPES = setOf(
            "TAB_HIDDEN", "WINDOW_BLURRED", "FULLSCREEN_EXITED",
            "NAVIGATION_ATTEMPT", "REFRESH", "NETWORK_LOST", "ANSWER_SAVED", "SUBMITTED"
        )
    }

    // ── Teacher/Admin authoring ───────────────────────────────────────────────

    @Transactional
    fun createExam(teacher: User, req: CreateExamRequest): ExamDetailDto {
        val institutionId = requireInstitution(teacher)
        validateExamPayload(req.title, req.subject, req.durationMinutes, req.maxAttempts, req.questions)
        val now = Instant.now()
        val exam = examRepo.save(
            Exam(
                institutionId = institutionId,
                creatorId = teacher.id,
                title = req.title.trim(),
                description = req.description?.trim(),
                subject = req.subject.trim(),
                durationMinutes = req.durationMinutes,
                maxAttempts = req.maxAttempts,
                availableFrom = req.availableFrom?.let { parseInstant(it) },
                availableUntil = req.availableUntil?.let { parseInstant(it) }
            )
        )
        replaceQuestions(exam.id, req.questions)
        auditLog.log(action = "EXAM_CREATED", category = "EXAM", userId = teacher.id, detail = """{"examId":${exam.id}}""")
        return getExamForStaff(teacher, exam.id)
    }

    fun updateExam(staff: User, examId: Long, req: UpdateExamRequest): ExamDetailDto {
        val exam = requireStaffExam(staff, examId)
        if (exam.status != ExamStatus.DRAFT) {
            throw ResponseStatusException(HttpStatus.CONFLICT, "Only DRAFT exams can be edited")
        }
        val title = req.title?.trim() ?: exam.title
        val subject = req.subject?.trim() ?: exam.subject
        val duration = req.durationMinutes ?: exam.durationMinutes
        val attempts = req.maxAttempts ?: exam.maxAttempts
        validateExamPayload(title, subject, duration, attempts, req.questions ?: emptyList())
        val updated = examRepo.save(
            exam.copy(
                title = title,
                description = req.description?.trim() ?: exam.description,
                subject = subject,
                durationMinutes = duration,
                maxAttempts = attempts,
                availableFrom = req.availableFrom?.let { parseInstant(it) } ?: exam.availableFrom,
                availableUntil = req.availableUntil?.let { parseInstant(it) } ?: exam.availableUntil,
                updatedAt = Instant.now()
            )
        )
        if (req.questions != null) replaceQuestions(examId, req.questions)
        return getExamForStaff(staff, updated.id)
    }

    fun publishExam(staff: User, examId: Long): ExamDetailDto {
        val exam = requireStaffExam(staff, examId)
        if (exam.status != ExamStatus.DRAFT) {
            throw ResponseStatusException(HttpStatus.CONFLICT, "Only DRAFT exams can be published")
        }
        val questions = questionRepo.findByExamIdOrderByOrderIndexAscIdAsc(examId)
        if (questions.isEmpty()) {
            throw ResponseStatusException(HttpStatus.CONFLICT, "Cannot publish an exam with no questions")
        }
        examRepo.save(exam.copy(status = ExamStatus.PUBLISHED, updatedAt = Instant.now()))
        auditLog.log(action = "EXAM_PUBLISHED", category = "EXAM", userId = staff.id, detail = """{"examId":$examId}""")
        return getExamForStaff(staff, examId)
    }

    fun closeExam(staff: User, examId: Long): ExamDetailDto {
        val exam = requireStaffExam(staff, examId)
        if (exam.status == ExamStatus.CLOSED) {
            throw ResponseStatusException(HttpStatus.CONFLICT, "Exam is already closed")
        }
        examRepo.save(exam.copy(status = ExamStatus.CLOSED, updatedAt = Instant.now()))
        auditLog.log(action = "EXAM_CLOSED", category = "EXAM", userId = staff.id, detail = """{"examId":$examId}""")
        return getExamForStaff(staff, examId).copy(status = "CLOSED")
    }

    fun listExamsForStaff(staff: User): List<ExamSummaryDto> {
        val institutionId = requireInstitution(staff)
        return examRepo.findByInstitutionIdOrderByCreatedAtDesc(institutionId).map { toSummary(it) }
    }

    fun getExamForStaff(staff: User, examId: Long): ExamDetailDto {
        val exam = requireStaffExam(staff, examId)
        return toDetail(exam, includeAnswers = true)
    }

    fun deleteDraftExam(staff: User, examId: Long) {
        val exam = requireStaffExam(staff, examId)
        if (exam.status != ExamStatus.DRAFT) {
            throw ResponseStatusException(HttpStatus.CONFLICT, "Only DRAFT exams can be deleted")
        }
        examRepo.delete(exam)
        auditLog.log(action = "EXAM_DELETED", category = "EXAM", userId = staff.id, detail = """{"examId":$examId}""")
    }

    // ── Student experience ────────────────────────────────────────────────────

    fun listAvailableExams(student: User): List<ExamSummaryDto> {
        // Self-registered students without a school legitimately have no exams;
        // return an empty list so the UI shows its empty state, not an error.
        val institutionId = student.institutionId ?: return emptyList()
        val now = Instant.now()
        return examRepo.findByInstitutionIdAndStatus(institutionId, ExamStatus.PUBLISHED)
            .filter { it.isOpenAt(now) }
            .map { toSummary(it) }
    }

    @Transactional
    fun startAttempt(student: User, examId: Long): StartAttemptResponse {
        val exam = examRepo.findById(examId)
            .orElseThrow { ResponseStatusException(HttpStatus.NOT_FOUND, "Exam not found") }
        if (exam.institutionId != student.institutionId) {
            throw ResponseStatusException(HttpStatus.FORBIDDEN, "Exam not in your institution")
        }
        if (!exam.isOpenAt(Instant.now())) {
            throw ResponseStatusException(HttpStatus.CONFLICT, "Exam is not available")
        }
        val previous = attemptRepo.findByExamIdAndStudentId(examId, student.id)
        if (previous.any { it.status == AttemptStatus.IN_PROGRESS }) {
            // Resume: the existing attempt keeps its original server-side expiry.
            return resumeAttempt(previous.first { it.status == AttemptStatus.IN_PROGRESS }, exam)
        }
        if (previous.size >= exam.maxAttempts) {
            throw ResponseStatusException(HttpStatus.CONFLICT, "Attempt limit reached")
        }
        val now = Instant.now()
        val attempt = attemptRepo.save(
            ExamAttempt(
                examId = examId,
                studentId = student.id,
                startedAt = now,
                expiresAt = now.plus(exam.durationMinutes.toLong(), ChronoUnit.MINUTES)
            )
        )
        auditLog.log(action = "EXAM_STARTED", category = "EXAM", userId = student.id, detail = """{"examId":$examId,"attemptId":${attempt.id}}""")
        return StartAttemptResponse(
            attemptId = attempt.id,
            examId = examId,
            expiresAt = attempt.expiresAt,
            remainingSeconds = remainingSeconds(attempt),
            questions = questionRepo.findByExamIdOrderByOrderIndexAscIdAsc(examId).map { it.toOut() },
            savedAnswers = emptyMap()
        )
    }

    @Transactional
    fun saveAnswer(student: User, attemptId: Long, req: SaveAnswerRequest) {
        val attempt = requireOwnActiveAttempt(student, attemptId)
        val question = questionRepo.findById(req.questionId)
            .orElseThrow { ResponseStatusException(HttpStatus.NOT_FOUND, "Question not found") }
        if (question.examId != attempt.examId) {
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, "Question not part of this exam")
        }
        val normalized = req.answer?.trim()?.takeIf { it.isNotEmpty() }
        val existing = answerRepo.findByAttemptIdAndQuestionId(attemptId, req.questionId)
        if (existing != null) {
            answerRepo.save(existing.copy(answer = normalized, savedAt = Instant.now()))
        } else {
            answerRepo.save(ExamAnswer(attemptId = attemptId, questionId = req.questionId, answer = normalized))
        }
    }

    @Transactional
    fun recordIntegrityEvent(student: User, attemptId: Long, req: IntegrityEventRequest) {
        val attempt = requireOwnActiveAttempt(student, attemptId, allowGrace = true)
        if (req.eventType !in INTEGRITY_EVENT_TYPES) {
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, "Unknown integrity event type")
        }
        integrityRepo.save(
            ExamIntegrityEvent(
                attemptId = attemptId,
                eventType = req.eventType,
                detail = req.detail?.take(255)
            )
        )
    }

    @Transactional
    fun submitAttempt(student: User, attemptId: Long, req: SubmitExamRequest): AttemptDto {
        val attempt = attemptRepo.findById(attemptId)
            .orElseThrow { ResponseStatusException(HttpStatus.NOT_FOUND, "Attempt not found") }
        if (attempt.studentId != student.id) {
            throw ResponseStatusException(HttpStatus.FORBIDDEN, "Not your attempt")
        }
        if (attempt.status != AttemptStatus.IN_PROGRESS) {
            throw ResponseStatusException(HttpStatus.CONFLICT, "Attempt already finished")
        }
        val now = Instant.now()
        // Server-authoritative timing: submissions more than the grace window
        // past expiry are rejected; the attempt will be timed out by reconcile.
        if (now.isAfter(attempt.expiresAt.plusSeconds(LATE_GRACE_SECONDS))) {
            finalizeAttempt(attempt, AttemptStatus.TIMED_OUT, autoMark = true)
            throw ResponseStatusException(HttpStatus.CONFLICT, "Exam time expired")
        }
        // Persist any final answers the client sends with the submission.
        req.answers.forEach { saveAnswer(student, attemptId, it) }
        val score = markAttempt(attemptId)
        val finished = attemptRepo.save(
            attempt.copy(status = AttemptStatus.SUBMITTED, submittedAt = now, score = score)
        )
        integrityRepo.save(ExamIntegrityEvent(attemptId = attemptId, eventType = "SUBMITTED"))
        auditLog.log(action = "EXAM_SUBMITTED", category = "EXAM", userId = student.id, detail = """{"examId":${attempt.examId},"attemptId":$attemptId,"score":$score}""")
        return AttemptDto(
            id = finished.id,
            examId = finished.examId,
            examTitle = examRepo.findById(finished.examId).orElse(null)?.title ?: "",
            status = finished.status.name,
            startedAt = finished.startedAt,
            expiresAt = finished.expiresAt,
            submittedAt = finished.submittedAt,
            score = finished.score,
            totalMarks = finished.totalMarks,
            remainingSeconds = 0
        )
    }

    /**
     * Reconciles stale IN_PROGRESS attempts whose expiry has passed: they are
     * finalized as TIMED_OUT with auto-marking of whatever was saved. Safe to
     * call repeatedly; called lazily on results reads and by the scheduler.
     */
    @Transactional
    fun reconcileExpiredAttempts() {
        val now = Instant.now()
        attemptRepo.findAll().forEach { attempt ->
            if (attempt.status == AttemptStatus.IN_PROGRESS && now.isAfter(attempt.expiresAt.plusSeconds(LATE_GRACE_SECONDS))) {
                finalizeAttempt(attempt, AttemptStatus.TIMED_OUT, autoMark = true)
            }
        }
    }

    // ── Results ───────────────────────────────────────────────────────────────

    fun listMyResults(student: User): List<ExamResultDto> {
        reconcileExpiredAttempts()
        val attempts = attemptRepo.findByStudentIdOrderByStartedAtDesc(student.id)
        return attempts.mapNotNull { toResult(it, includeBreakdown = false) }
    }

    fun getMyResult(student: User, attemptId: Long): ExamResultDto {
        reconcileExpiredAttempts()
        val attempt = attemptRepo.findById(attemptId)
            .orElseThrow { ResponseStatusException(HttpStatus.NOT_FOUND, "Attempt not found") }
        if (attempt.studentId != student.id) {
            throw ResponseStatusException(HttpStatus.FORBIDDEN, "Not your attempt")
        }
        return toResult(attempt, includeBreakdown = true)
            ?: throw ResponseStatusException(HttpStatus.CONFLICT, "Attempt still in progress")
    }

    fun listWardResults(guardian: User, wardId: Long): List<ExamResultDto> {
        requireGuardianOf(guardian, wardId)
        reconcileExpiredAttempts()
        return attemptRepo.findByStudentIdOrderByStartedAtDesc(wardId).mapNotNull { toResult(it, includeBreakdown = false) }
    }

    fun getWardResult(guardian: User, wardId: Long, attemptId: Long): ExamResultDto {
        requireGuardianOf(guardian, wardId)
        reconcileExpiredAttempts()
        val attempt = attemptRepo.findById(attemptId)
            .orElseThrow { ResponseStatusException(HttpStatus.NOT_FOUND, "Attempt not found") }
        if (attempt.studentId != wardId) {
            throw ResponseStatusException(HttpStatus.FORBIDDEN, "Attempt does not belong to this learner")
        }
        return toResult(attempt, includeBreakdown = true)
            ?: throw ResponseStatusException(HttpStatus.CONFLICT, "Attempt still in progress")
    }

    fun listExamResultsForStaff(staff: User, examId: Long): List<ExamResultDto> {
        requireStaffExam(staff, examId)
        reconcileExpiredAttempts()
        return attemptRepo.findByExamIdInOrderByStartedAtDesc(listOf(examId)).mapNotNull { toResult(it, includeBreakdown = false) }
    }

    fun listIntegrityEvents(staff: User, attemptId: Long): List<ExamIntegrityEvent> {
        val attempt = attemptRepo.findById(attemptId)
            .orElseThrow { ResponseStatusException(HttpStatus.NOT_FOUND, "Attempt not found") }
        requireStaffExam(staff, attempt.examId)
        return integrityRepo.findByAttemptIdOrderByOccurredAtAsc(attemptId)
    }

    // ── Manual marking (short answers) ────────────────────────────────────────

    /**
     * Marks a short-answer question on a finished attempt. Submitted answers are
     * immutable — only marks/feedback change. The attempt total is recalculated
     * server-side from all marked answers; marks are clamped to [0, question.marks]
     * and only objective-type checks can never be overridden here.
     */
    @Transactional
    fun markShortAnswer(staff: User, attemptId: Long, req: MarkShortAnswerRequest): ExamResultDto {
        val attempt = attemptRepo.findById(attemptId)
            .orElseThrow { ResponseStatusException(HttpStatus.NOT_FOUND, "Attempt not found") }
        if (attempt.status == AttemptStatus.IN_PROGRESS) {
            throw ResponseStatusException(HttpStatus.CONFLICT, "Attempt still in progress")
        }
        requireStaffExam(staff, attempt.examId)
        val question = questionRepo.findById(req.questionId)
            .orElseThrow { ResponseStatusException(HttpStatus.NOT_FOUND, "Question not found") }
        if (question.examId != attempt.examId) {
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, "Question not part of this exam")
        }
        if (question.qtype != QuestionType.SHORT_ANSWER) {
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, "Only short-answer questions are manually marked")
        }
        if (req.marksAwarded < 0 || req.marksAwarded > question.marks) {
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, "Marks must be between 0 and ${question.marks}")
        }
        val answer = answerRepo.findByAttemptIdAndQuestionId(attemptId, req.questionId)
            ?: throw ResponseStatusException(HttpStatus.CONFLICT, "No answer submitted for this question")
        answerRepo.save(answer.copy(marksAwarded = req.marksAwarded, feedback = req.feedback?.trim()?.takeIf { it.isNotEmpty() }))
        recalculateAttemptTotal(attempt)
        auditLog.log(action = "EXAM_MARKED", category = "EXAM", userId = staff.id,
            detail = """{"attemptId":$attemptId,"questionId":${req.questionId},"marks":${req.marksAwarded}}""")
        return toResult(attemptRepo.findById(attemptId).get(), includeBreakdown = true)
            ?: throw ResponseStatusException(HttpStatus.CONFLICT, "Attempt still in progress")
    }

    /** Recomputes the attempt score from auto-marked + manually marked answers. */
    private fun recalculateAttemptTotal(attempt: ExamAttempt) {
        val questions = questionRepo.findByExamIdOrderByOrderIndexAscIdAsc(attempt.examId).associateBy { it.id }
        val answers = answerRepo.findByAttemptId(attempt.id)
        var earned = 0.0
        answers.forEach { a ->
            val q = questions[a.questionId] ?: return@forEach
            when {
                a.marksAwarded != null -> earned += a.marksAwarded
                q.qtype != QuestionType.SHORT_ANSWER && a.answer != null &&
                    a.answer.trim().uppercase().equals(q.correctOption?.uppercase(), ignoreCase = true) -> earned += q.marks
            }
        }
        attemptRepo.save(attempt.copy(score = earned))
    }

    // ── Internals ─────────────────────────────────────────────────────────────

    private fun resumeAttempt(attempt: ExamAttempt, exam: Exam): StartAttemptResponse {
        if (Instant.now().isAfter(attempt.expiresAt.plusSeconds(LATE_GRACE_SECONDS))) {
            finalizeAttempt(attempt, AttemptStatus.TIMED_OUT, autoMark = true)
            throw ResponseStatusException(HttpStatus.CONFLICT, "Exam time expired")
        }
        val saved = answerRepo.findByAttemptId(attempt.id).associate { it.questionId to (it.answer ?: "") }
        return StartAttemptResponse(
            attemptId = attempt.id,
            examId = exam.id,
            expiresAt = attempt.expiresAt,
            remainingSeconds = remainingSeconds(attempt),
            questions = questionRepo.findByExamIdOrderByOrderIndexAscIdAsc(exam.id).map { it.toOut() },
            savedAnswers = saved
        )
    }

    private fun requireOwnActiveAttempt(student: User, attemptId: Long, allowGrace: Boolean = false): ExamAttempt {
        val attempt = attemptRepo.findById(attemptId)
            .orElseThrow { ResponseStatusException(HttpStatus.NOT_FOUND, "Attempt not found") }
        if (attempt.studentId != student.id) {
            throw ResponseStatusException(HttpStatus.FORBIDDEN, "Not your attempt")
        }
        if (attempt.status != AttemptStatus.IN_PROGRESS) {
            throw ResponseStatusException(HttpStatus.CONFLICT, "Attempt already finished")
        }
        val deadline = if (allowGrace) attempt.expiresAt.plusSeconds(LATE_GRACE_SECONDS) else attempt.expiresAt
        if (Instant.now().isAfter(deadline)) {
            finalizeAttempt(attempt, AttemptStatus.TIMED_OUT, autoMark = true)
            throw ResponseStatusException(HttpStatus.CONFLICT, "Exam time expired")
        }
        return attempt
    }

    private fun finalizeAttempt(attempt: ExamAttempt, status: AttemptStatus, autoMark: Boolean) {
        val score = if (autoMark) markAttempt(attempt.id) else attempt.score
        attemptRepo.save(
            attempt.copy(
                status = status,
                submittedAt = attempt.submittedAt ?: Instant.now(),
                score = score
            )
        )
    }

    /** Auto-marks objective questions server-side; short answers stay unmarked (manual). */
    private fun markAttempt(attemptId: Long): Double {
        val attempt = attemptRepo.findById(attemptId).get()
        val questions = questionRepo.findByExamIdOrderByOrderIndexAscIdAsc(attempt.examId)
        val answers = answerRepo.findByAttemptId(attemptId).associateBy { it.questionId }
        var earned = 0.0
        var autoTotal = 0.0
        questions.forEach { q ->
            if (q.qtype == QuestionType.SHORT_ANSWER) return@forEach // manual marking
            autoTotal += q.marks
            val given = answers[q.id]?.answer?.trim()?.uppercase()
            val correct = when (q.qtype) {
                QuestionType.MCQ, QuestionType.TRUE_FALSE -> given != null && given.equals(q.correctOption?.uppercase(), ignoreCase = true)
                else -> false
            }
            if (correct) earned += q.marks
        }
        // Manual short-answer marks would be added by a teacher-marking flow; the
        // objective score is authoritative for now and totalMarks reflects the
        // whole paper.
        val total = questions.sumOf { it.marks }
        attemptRepo.save(attempt.copy(totalMarks = total))
        return if (autoTotal > 0) earned else 0.0
    }

    private fun toResult(attempt: ExamAttempt, includeBreakdown: Boolean): ExamResultDto? {
        if (attempt.status == AttemptStatus.IN_PROGRESS) return null
        val exam = examRepo.findById(attempt.examId).orElse(null) ?: return null
        val student = userRepo.findById(attempt.studentId).orElse(null)
        val breakdown = if (includeBreakdown) {
            val questions = questionRepo.findByExamIdOrderByOrderIndexAscIdAsc(attempt.examId)
            val answers = answerRepo.findByAttemptId(attempt.id).associateBy { it.questionId }
            questions.map { q ->
                val answerRow = answers[q.id]
                val given = answerRow?.answer
                val correct = if (q.qtype == QuestionType.SHORT_ANSWER || given == null) null
                else given.trim().uppercase().equals(q.correctOption?.uppercase(), ignoreCase = true)
                // Manual marks take precedence; objective marks come from auto-marking.
                val awarded = answerRow?.marksAwarded ?: if (correct == true) q.marks.toDouble() else null
                QuestionResultDto(
                    questionId = q.id,
                    question = q.question,
                    qtype = q.qtype.name,
                    studentAnswer = given,
                    correct = correct,
                    marksAwarded = awarded,
                    marksPossible = q.marks,
                    correctAnswer = q.correctOption,
                    feedback = answerRow?.feedback
                )
            }
        } else emptyList()
        return ExamResultDto(
            attemptId = attempt.id,
            examId = attempt.examId,
            examTitle = exam.title,
            studentId = attempt.studentId,
            studentName = student?.name ?: "Unknown",
            status = attempt.status.name,
            score = attempt.score,
            totalMarks = attempt.totalMarks,
            submittedAt = attempt.submittedAt,
            breakdown = breakdown
        )
    }

    private fun toSummary(exam: Exam): ExamSummaryDto {
        val questions = questionRepo.findByExamIdOrderByOrderIndexAscIdAsc(exam.id)
        return ExamSummaryDto(
            id = exam.id,
            title = exam.title,
            subject = exam.subject,
            description = exam.description,
            durationMinutes = exam.durationMinutes,
            maxAttempts = exam.maxAttempts,
            status = exam.status.name,
            availableFrom = exam.availableFrom,
            availableUntil = exam.availableUntil,
            questionCount = questions.size,
            totalMarks = questions.sumOf { it.marks },
            createdAt = exam.createdAt
        )
    }

    private fun toDetail(exam: Exam, includeAnswers: Boolean): ExamDetailDto =
        ExamDetailDto(
            id = exam.id,
            title = exam.title,
            description = exam.description,
            subject = exam.subject,
            durationMinutes = exam.durationMinutes,
            maxAttempts = exam.maxAttempts,
            status = exam.status.name,
            availableFrom = exam.availableFrom,
            availableUntil = exam.availableUntil,
            questions = questionRepo.findByExamIdOrderByOrderIndexAscIdAsc(exam.id).map { it.toOut() }
        )

    private fun ExamQuestion.toOut() = ExamQuestionOut(
        id = id,
        question = question,
        qtype = qtype.name,
        options = listOf(optionA, optionB, optionC, optionD),
        marks = marks,
        orderIndex = orderIndex
    )

    private fun replaceQuestions(examId: Long, questions: List<ExamQuestionIn>) {
        questionRepo.deleteByExamId(examId)
        questions.forEachIndexed { idx, q ->
            val type = parseType(q.qtype)
            val (a, b, c, d) = when (type) {
                QuestionType.TRUE_FALSE -> listOf("True", "False", null, null)
                QuestionType.SHORT_ANSWER -> listOf<String?>(null, null, null, null)
                QuestionType.MCQ -> {
                    if (q.options.size < 2 || q.options.size > 4) {
                        throw ResponseStatusException(HttpStatus.BAD_REQUEST, "MCQ needs 2-4 options (question ${idx + 1})")
                    }
                    val opts = q.options.map { it.trim() }
                    listOf(opts.getOrNull(0), opts.getOrNull(1), opts.getOrNull(2), opts.getOrNull(3))
                }
            }
            if (q.question.isBlank()) {
                throw ResponseStatusException(HttpStatus.BAD_REQUEST, "Question ${idx + 1} text is required")
            }
            if (q.marks < 1) {
                throw ResponseStatusException(HttpStatus.BAD_REQUEST, "Marks must be at least 1 (question ${idx + 1})")
            }
            val correctOption = when (type) {
                QuestionType.MCQ, QuestionType.TRUE_FALSE -> {
                    val co = q.correctOption?.trim()?.uppercase()
                    if (co.isNullOrBlank() || co !in setOf("A", "B", "C", "D")) {
                        throw ResponseStatusException(HttpStatus.BAD_REQUEST, "Question ${idx + 1}: correct option must be A-D")
                    }
                    if (type == QuestionType.MCQ && (co == "C" || co == "D") && (c == null || d == null && co == "D")) {
                        throw ResponseStatusException(HttpStatus.BAD_REQUEST, "Question ${idx + 1}: correct option exceeds provided options")
                    }
                    co
                }
                QuestionType.SHORT_ANSWER -> {
                    if (q.correctText.isNullOrBlank()) {
                        throw ResponseStatusException(HttpStatus.BAD_REQUEST, "Question ${idx + 1}: short answer needs a model answer for auto-marking")
                    }
                    null
                }
            }
            questionRepo.save(
                ExamQuestion(
                    examId = examId,
                    question = q.question.trim(),
                    qtype = type,
                    optionA = a,
                    optionB = b,
                    optionC = c,
                    optionD = d,
                    correctOption = correctOption,
                    correctText = q.correctText?.trim(),
                    marks = q.marks,
                    orderIndex = idx
                )
            )
        }
    }

    private fun parseType(raw: String): QuestionType =
        try {
            QuestionType.valueOf(raw.trim().uppercase())
        } catch (e: IllegalArgumentException) {
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, "Unknown question type: $raw")
        }

    private fun validateExamPayload(title: String, subject: String, duration: Int, attempts: Int, questions: List<ExamQuestionIn>) {
        if (title.isBlank()) throw ResponseStatusException(HttpStatus.BAD_REQUEST, "Title is required")
        if (subject.isBlank()) throw ResponseStatusException(HttpStatus.BAD_REQUEST, "Subject is required")
        if (duration !in 1..300) throw ResponseStatusException(HttpStatus.BAD_REQUEST, "Duration must be 1-300 minutes")
        if (attempts !in 1..5) throw ResponseStatusException(HttpStatus.BAD_REQUEST, "Attempts must be 1-5")
        if (questions.size > 200) throw ResponseStatusException(HttpStatus.BAD_REQUEST, "Too many questions (max 200)")
    }

    private fun parseInstant(raw: String): Instant =
        try {
            Instant.parse(raw)
        } catch (e: Exception) {
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid timestamp: $raw")
        }

    private fun remainingSeconds(attempt: ExamAttempt): Long =
        java.time.Duration.between(Instant.now(), attempt.expiresAt).seconds.coerceAtLeast(0)

    private fun requireInstitution(user: User): Long =
        user.institutionId ?: throw ResponseStatusException(HttpStatus.CONFLICT, "Account has no institution")

    private fun requireStaffExam(staff: User, examId: Long): Exam {
        val exam = examRepo.findById(examId)
            .orElseThrow { ResponseStatusException(HttpStatus.NOT_FOUND, "Exam not found") }
        if (exam.institutionId != staff.institutionId) {
            throw ResponseStatusException(HttpStatus.FORBIDDEN, "Exam not in your institution")
        }
        return exam
    }

    private fun requireGuardianOf(guardian: User, wardId: Long) {
        val ward = userRepo.findById(wardId)
            .orElseThrow { ResponseStatusException(HttpStatus.NOT_FOUND, "Learner not found") }
        if (ward.role != UserRole.STUDENT) {
            throw ResponseStatusException(HttpStatus.FORBIDDEN, "Learner not accessible")
        }
        // The active guardian link is the authorization boundary (same model as
        // GuardianController): links are school-created, so an unlinked guardian
        // — including one from another institution — can never see results.
        val link = guardianLinkRepo.findByGuardianIdAndLearnerIdAndIsActiveTrue(guardian.id, wardId)
        if (link == null) {
            throw ResponseStatusException(HttpStatus.FORBIDDEN, "Not a guardian of this learner")
        }
    }
}
