package com.elekeza.backend.personalization

import com.elekeza.backend.auth.User
import com.elekeza.backend.auth.UserRepository
import com.elekeza.backend.auth.UserRole
import com.elekeza.backend.institution.GuardianLinkRepository
import com.elekeza.backend.learner.LearnerProfile
import com.elekeza.backend.learner.LearnerProfileRepository
import com.elekeza.backend.learner.LessonProgressRepository
import org.springframework.http.HttpStatus
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.server.ResponseStatusException

/**
 * Canonical per-student learning profile service. One LearnerProfile row per
 * student already exists; its JSONB `preferences["learning"]` map holds typed
 * [PreferenceEntry] values keyed by [LearningPreferences.KEYS], and
 * `adaptationState["signals"]` holds [LearningSignal] evidence.
 *
 * Precedence is enforced at WRITE time:
 *   EXPLICIT (learner) > TEACHER > GUARDIAN > OBSERVED > SYSTEM(defaults)
 * so no silent AI/behaviour override of an explicit human choice is possible.
 */
@Service
class PersonalizationService(
    private val learnerProfileRepo: LearnerProfileRepository,
    private val userRepo: UserRepository,
    private val guardianLinkRepo: GuardianLinkRepository,
    private val lessonProgressRepo: LessonProgressRepository
) {

    val SYSTEM_DEFAULTS: Map<String, PreferenceEntry> = mapOf(
        LearningPreferences.DENSITY to PreferenceEntry("STANDARD", Source.SYSTEM),
        LearningPreferences.EXPLANATION_STYLE to PreferenceEntry("CONCISE", Source.SYSTEM),
        LearningPreferences.EXAMPLE_FREQUENCY to PreferenceEntry("MEDIUM", Source.SYSTEM),
        LearningPreferences.TEXT_SIZE to PreferenceEntry("MEDIUM", Source.SYSTEM),
        LearningPreferences.CONTRAST to PreferenceEntry("STANDARD", Source.SYSTEM),
        LearningPreferences.VISUAL_SUPPORT to PreferenceEntry("false", Source.SYSTEM),
        LearningPreferences.READ_ALOUD to PreferenceEntry("false", Source.SYSTEM)
    )

    val STYLE_LABELS: Map<String, String> = mapOf(
        "CONCISE" to "Clear explanations",
        "STEP_BY_STEP" to "Step-by-step explanations",
        "EXAMPLE_FIRST" to "Examples before explanations",
        "DETAILED" to "Detailed explanations",
        "STANDARD" to "Standard density",
        "SPACIOUS" to "Spacious layout",
        "COMPACT" to "Compact layout",
        "HIGH" to "Frequent worked examples",
        "MEDIUM" to "Some examples",
        "LOW" to "Few examples"
    )

    private val PRECEDENCE = mapOf(
        Source.EXPLICIT to 5, Source.TEACHER to 4, Source.GUARDIAN to 3,
        Source.OBSERVED to 2, Source.SYSTEM to 1
    )

    // ── Profile IO ──────────────────────────────────────────────────────────

    @Transactional
    fun getOrCreate(user: User): LearnerProfile {
        learnerProfileRepo.findByUserId(user.id)?.let { return it }
        return learnerProfileRepo.save(
            LearnerProfile(user = user, preferences = emptyMap(), adaptationState = emptyMap())
        )
    }

    private fun learningMap(profile: LearnerProfile): MutableMap<String, Any> {
        val ns = (profile.preferences[LearningPreferences.LEARNING_NS] as? Map<*, *>)
        @Suppress("UNCHECKED_CAST")
        return (ns as? Map<String, Any>)?.toMutableMap() ?: mutableMapOf()
    }

    @Transactional
    fun readEffective(user: User): Map<String, Map<String, Any>> {
        val profile = getOrCreate(user)
        val map = learningMap(profile)
        val result = mutableMapOf<String, Map<String, Any>>()
        SYSTEM_DEFAULTS.forEach { (key, def) ->
            val entry = map[key]?.let { LearningPreferences.parseEntry(it) } ?: def
            result[key] = mapOf(
                "value" to entry.value,
                "source" to entry.source.name,
                "confidence" to entry.confidence
            )
        }
        return result
    }

    /**
     * Write one preference with an explicit source. Higher-precedence values
     * may overwrite lower; lower may never overwrite higher. Returns the
     * persisted entry or throws 409 when the learner's explicit choice already
     * stands (used for teacher/guardian overrides).
     */
    @Transactional
    fun writePreference(user: User, key: String, value: String, source: Source, allowDowngrade: Boolean = true): PreferenceEntry {
        require(LearningPreferences.KEYS.contains(key)) { throw ResponseStatusException(HttpStatus.BAD_REQUEST, "Unknown preference key: $key") }
        val valid = LearningPreferences.ENUM_BY_KEY[key]?.map { it.name }
        if (key == LearningPreferences.VISUAL_SUPPORT || key == LearningPreferences.READ_ALOUD) {
            require(value in setOf("true", "false")) { throw ResponseStatusException(HttpStatus.BAD_REQUEST, "Value must be true or false") }
        } else {
            require(valid!!.contains(value)) { throw ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid value '$value' for $key") }
        }

        val profile = getOrCreate(user)
        val map = learningMap(profile)
        val existing = map[key]?.let { LearningPreferences.parseEntry(it) }
        val existingSource = existing?.source ?: Source.SYSTEM

        if (!allowDowngrade && PRECEDENCE[source]!! < PRECEDENCE[existingSource]!!) {
            throw ResponseStatusException(
                HttpStatus.CONFLICT,
                "The learner chose this preference themselves ($existingSource); a $source value cannot override it."
            )
        }
        val entry = PreferenceEntry(value, source)
        map[key] = LearningPreferences.entryToMap(entry)
        val updated = profile.copy(
            preferences = profile.preferences + (LearningPreferences.LEARNING_NS to map),
            updatedAt = java.time.LocalDateTime.now()
        )
        learnerProfileRepo.save(updated)
        return entry
    }

    @Transactional
    fun applyObserved(user: User, key: String, entry: PreferenceEntry?) {
        if (entry == null) return
        val profile = getOrCreate(user)
        val map = learningMap(profile)
        val existing = map[key]?.let { LearningPreferences.parseEntry(it) }
        // Observed never overrides any human-set preference.
        if (existing != null && existing.source != Source.OBSERVED) return
        map[key] = LearningPreferences.entryToMap(entry.copy(source = Source.OBSERVED))
        learnerProfileRepo.save(
            profile.copy(preferences = profile.preferences + (LearningPreferences.LEARNING_NS to map),
                updatedAt = java.time.LocalDateTime.now())
        )
    }

    @Transactional
    fun readSignals(user: User): Map<String, LearningSignal> {
        val profile = getOrCreate(user)
        val raw = profile.adaptationState["signals"] as? Map<*, *> ?: return emptyMap()
        val result = mutableMapOf<String, LearningSignal>()
        raw.forEach { (k, v) ->
            val key = k as? String ?: return@forEach
            val m = v as? Map<*, *> ?: return@forEach
            val direction = m["direction"] as? String ?: return@forEach
            val confidence = (m["confidence"] as? Number)?.toDouble() ?: 0.0
            val evidence = (m["evidenceCount"] as? Number)?.toInt() ?: 0
            val updated = (m["lastUpdatedEpochMs"] as? Number)?.toLong() ?: System.currentTimeMillis()
            result[key] = LearningSignal(key, direction, confidence, evidence, updated)
        }
        return result
    }

    @Transactional
    fun recordSignal(user: User, key: String, direction: String, helpful: Boolean): LearningSignal? {
        val profile = getOrCreate(user)
        val accumulator = SignalAccumulator()
        val signals = readSignals(user).toMutableMap()
        val decayed = signals[key]?.let { accumulator.decay(it) }
        if (decayed != null) signals[key] = decayed
        val updated = accumulator.record(signals, key, direction, helpful)
        signals[key] = updated
        val state = profile.adaptationState + ("signals" to signals.mapValues { (_, s) ->
            mapOf(
                "direction" to s.direction, "confidence" to s.confidence,
                "evidenceCount" to s.evidenceCount, "lastUpdatedEpochMs" to s.lastUpdatedEpochMs
            )
        })
        learnerProfileRepo.save(profile.copy(adaptationState = state, updatedAt = java.time.LocalDateTime.now()))
        // Upgrade to an OBSERVED preference only once the evidence is sufficient.
        if (helpful) applyObserved(user, key, accumulator.asObservedPreference(updated))
        return updated
    }

    // ── Teacher / guardian views ────────────────────────────────────────────

    /** Which human sources configured the learning namespace (EXPLICIT/TEACHER/GUARDIAN). */
    private fun configuredBy(profile: LearnerProfile?): Set<String> {
        val ns = profile?.preferences?.get(LearningPreferences.LEARNING_NS) as? Map<*, *> ?: return emptySet()
        val sources = mutableSetOf<String>()
        ns.values.forEach { v -> (v as? Map<*, *>)?.get("s")?.let { sources.add(it.toString()) } }
        return sources
    }

    /** Teacher-facing learning-support summary (never psychological labels). */
    @Transactional
    fun teacherSupportSummary(teacher: User, studentId: Long): Map<String, Any> {
        val student = userRepo.findById(studentId)
            .orElseThrow { ResponseStatusException(HttpStatus.NOT_FOUND, "Student not found") }
        if (student.role != UserRole.STUDENT || teacher.institutionId == null || student.institutionId != teacher.institutionId) {
            throw ResponseStatusException(HttpStatus.FORBIDDEN, "Student not in your institution")
        }
        val profile = learnerProfileRepo.findByUserId(studentId)
        val effective = readEffective(student)
        val signals = readSignals(student)

        val respondedWell = signals.values
            .filter { it.confidence >= 0.6 }
            .sortedByDescending { it.confidence }
            .take(4)
            .map { STYLE_LABELS[it.direction] ?: it.direction }

        val weakestSubject = lessonProgressRepo.findByUserIdOrderByCreatedAtDesc(studentId)
            .filter { it.completed }
            .minByOrNull { it.quizScore ?: 100.0 }
            ?.let { p -> mapOf("contentId" to p.contentId, "score" to (p.quizScore ?: 0.0)) }

        return mapOf(
            "studentId" to studentId,
            "studentName" to student.name,
            "mastery" to (lessonProgressRepo.avgQuizScore(studentId) ?: 0.0),
            "respondsWellTo" to respondedWell,
            "currentlyBenefitsFrom" to (weakestSubject?.let { listOf(mapOf("lessonId" to it["contentId"], "note" to "additional practice in this lesson would help")) } ?: emptyList()),
            "presentation" to effective.mapValues { (_, v) -> v["value"] },
            "aiConfidence" to (
                signals.values.maxOfOrNull { it.confidence }?.let { c ->
                    when { c >= 0.75 -> "High"; c >= 0.5 -> "Medium"; else -> "Emerging" }
                } ?: "Emerging"
                ),
            "profileSource" to configuredBy(profile)
        )
    }

    /** Guardian-facing summary in plain, non-stigmatising language. */
    @Transactional
    fun guardianSupportSummary(guardian: User, wardId: Long): Map<String, Any> {
        val link = guardianLinkRepo.findAll().firstOrNull { it.guardianId == guardian.id && it.learnerId == wardId }
            ?: throw ResponseStatusException(HttpStatus.FORBIDDEN, "Not authorized")
        val student = userRepo.findById(wardId).orElse(null) ?: throw ResponseStatusException(HttpStatus.NOT_FOUND, "Ward not found")
        val profile = learnerProfileRepo.findByUserId(wardId)
        val effective = readEffective(student)
        val style = effective[LearningPreferences.EXPLANATION_STYLE]?.get("value") as? String
        val density = effective[LearningPreferences.DENSITY]?.get("value") as? String
        val signals = readSignals(student)

        val narrative = buildString {
            append("Elekeza is presenting lessons in a way that suits ${student.name} right now.")
            when (style) {
                "STEP_BY_STEP" -> append(" Lessons are broken into small, step-by-step sections, which has been helping them work through activities.")
                "DETAILED" -> append(" ${student.name} is shown fuller explanations to go deeper.")
                "CONCISE" -> append(" Explanations are kept clear and to the point.")
                else -> append(" Explanations follow their preferred style.")
            }
            if (density == "SPACIOUS") append(" Content is laid out with plenty of space so nothing feels crowded.")
            val progress = lessonProgressRepo.findByUserIdOrderByCreatedAtDesc(wardId)
            val completed = progress.count { it.completed }
            val avg = lessonProgressRepo.avgQuizScore(wardId)
            append(" ${student.name} has completed $completed lesson${if (completed == 1) "" else "s"}")
            avg?.let { append(" with an average score of ${"%.0f".format(it)}%") }
            append(".")
            signals.values.filter { it.confidence >= 0.6 }.take(2).forEach {
                append(" More ${(STYLE_LABELS[it.direction] ?: it.direction).lowercase()} seems to help.")
            }
        }
        return mapOf(
            "wardId" to wardId,
            "wardName" to student.name,
            "summary" to narrative,
            "profileConfiguredBy" to configuredBy(profile)
        )
    }
}
