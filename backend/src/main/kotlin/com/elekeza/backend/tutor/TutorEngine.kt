package com.elekeza.backend.tutor

import java.util.Base64

/**
 * Deterministic tutor engine: builds grounded learning-support content from
 * the lesson's own material. No provider, no network, no secrets — this is
 * the always-available fallback that keeps every tutor button honest when no
 * AI credentials are configured.
 *
 * Language rules mirror MasteryEngine's: encouraging, plain, never
 * diagnostic, never stigmatizing.
 */
object TutorEngine {

    private val random: kotlin.random.Random = kotlin.random.Random.Default

    // ── Explain ────────────────────────────────────────────────────────────

    fun explain(lessonTitle: String, body: String, keyTerms: Map<String, String>): String {
        val clean = body.trim()
        val sentences = clean.split(Regex("(?<=[.!?])\\s+")).filter { it.isNotBlank() }
        // Lead with the core statement, then the supporting sentences. If the
        // lesson is tiny, the whole text IS the explanation.
        val core = sentences.take(2).joinToString(" ").ifBlank { clean }
        val support = sentences.drop(2).take(2).joinToString(" ")
        val exampleSentence = sentences.firstOrNull { it.contains(Regex("\\b(for example|such as|e\\.g\\.)", RegexOption.IGNORE_CASE)) }

        val sb = StringBuilder()
        sb.append("Here is the idea behind \"").append(lessonTitle).append("\":\n\n")
        sb.append(core.trim())
        if (support.isNotBlank()) sb.append("\n\n").append(support.trim())
        exampleSentence?.let { sb.append("\n\nExample: ").append(it.trim()) }
        if (keyTerms.isNotEmpty()) {
            sb.append("\n\nWords to remember: ")
            sb.append(keyTerms.entries.take(3).joinToString("; ") { (t, d) -> "$t — $d" })
        }
        sb.append("\n\nIf that is still unclear, tap \"Let's make it simpler\" and I will break it into smaller steps.")
        return sb.toString()
    }

    fun explainSimpler(lessonTitle: String, body: String): String {
        val sentences = body.trim().split(Regex("(?<=[.!?])\\s+")).filter { it.isNotBlank() }
        // Simpler = shorter steps, one idea per line.
        val steps = sentences.take(4).mapIndexed { i, s -> "${i + 1}. ${s.trim()}" }
        val sb = StringBuilder("Let's take it step by step for \"").append(lessonTitle).append("\":\n\n")
        sb.append(if (steps.isEmpty()) "This lesson is short — read it once more with me." else steps.joinToString("\n"))
        sb.append("\n\nYou are doing the right thing by asking. Shall we try a practice question next?")
        return sb.toString()
    }

    // ── Summarize ──────────────────────────────────────────────────────────

    fun summarize(lessonTitle: String, body: String, keyTerms: Map<String, String>): String {
        val sentences = body.trim().split(Regex("(?<=[.!?])\\s+")).filter { it.isNotBlank() }
        val sb = StringBuilder()
        sb.append("## What you learned — ").append(lessonTitle).append("\n\n")
        sentences.take(3).forEach { s -> sb.append("- ").append(s.trim()).append("\n") }
        if (keyTerms.isNotEmpty()) {
            sb.append("\nRemember: ")
            sb.append(keyTerms.entries.take(3).joinToString("; ") { (t, d) -> "$t ($d)" })
            sb.append("\n")
        }
        // Quick check question: pulled from the lesson itself, answer shown small.
        val check = sentences.lastOrNull()
        if (check != null) {
            sb.append("\n**Try this:** can you say that last idea in your own words? (\"").append(shorten(check)).append("\")")
        }
        return sb.toString()
    }

    private fun shorten(s: String): String = if (s.length <= 90) s.trim() else s.take(87).trim() + "…"

    // ── Practice ───────────────────────────────────────────────────────────

    /**
     * Builds ONE practice question from the lesson's own sentences. Cloze
     * style: a meaningful sentence with its strongest word hidden, plus three
     * distractors drawn from other lesson words (so the question can never
     * drift off-topic). The correct index is shuffled.
     */
    fun makePractice(lessonTitle: String, body: String): PracticeQuestion {
        val sentences = body.trim().split(Regex("(?<=[.!?])\\s+")).filter { it.length in 30..220 }
        val chosen = sentences.randomOrNull(random)
            ?: sentences.firstOrNull()
            ?: body.trim().ifBlank { "Read the lesson text once more." }

        val words = Regex("[A-Za-z]{4,}").findAll(chosen).map { it.value }.toList()
            .filterNot { it.lowercase() in STOPWORDS }
        val target = words.maxByOrNull { it.length } ?: "lesson"
        val cloze = chosen.replaceFirst(target, "______")

        val distractorPool = Regex("[A-Za-z]{4,}").findAll(body).map { it.value }
            .filterNot { it.equals(target, ignoreCase = true) }
            .filterNot { it.lowercase() in STOPWORDS }
            .toSet()
        val distractors = distractorPool.shuffled(random).take(2)

        val options = (distractors + target).shuffled(random)
        val correctIndex = options.indexOfFirst { it.equals(target, ignoreCase = true) }

        return PracticeQuestion(
            question = "Fill the gap (from \"$lessonTitle\"):\n\n$cloze",
            options = options,
            correctIndex = correctIndex,
            explanation = "The sentence needs \"$target\" — that is the word the lesson uses here."
        )
    }

    /** Grades a submitted answer for the practice question this session issued. */
    fun gradePractice(question: PracticeQuestion, answerIndex: Int?): PracticeFeedbackDto {
        if (answerIndex == null) {
            return PracticeFeedbackDto(correct = false, explanation = question.explanation, canRetry = true)
        }
        val correct = answerIndex == question.correctIndex
        val praise = if (correct) "Correct — well done! " else "Not quite — and that is fine, this is how learning works. "
        return PracticeFeedbackDto(correct = correct, explanation = praise + question.explanation, canRetry = !correct)
    }

    private val STOPWORDS = setOf(
        "this", "that", "with", "from", "have", "when", "then", "than", "into", "onto",
        "which", "where", "while", "about", "after", "before", "because", "their", "there",
        "these", "those", "other", "would", "could", "should", "water", "them", "they",
        "were", "what", "your", "each", "make", "made", "more", "most", "also", "some",
        "such", "only", "over", "very", "will", "must", "been", "being", "does", "gets"
    )

    // ── Diagram ────────────────────────────────────────────────────────────

    /**
     * A simple labeled flow built from the lesson's sentence order — the
     * structure of the explanation, not an invented picture. Every node label
     * comes from the lesson, and altText carries the full reading so the
     * diagram is never the only way to understand the content.
     */
    fun makeDiagram(lessonTitle: String, body: String): TutorDiagram {
        val sentences = body.trim().split(Regex("(?<=[.!?])\\s+")).filter { it.isNotBlank() }.take(4)
        val nodes = sentences.mapIndexed { i, s ->
            DiagramNode(id = "s$i", label = shorten(firstWords(s, 6)))
        }
        val edges = nodes.zipWithNext { a, b -> DiagramEdge(from = a.id, to = b.id, label = "then") }
        val alt = "Flow of \"$lessonTitle\": " + sentences.joinToString(" Then, ") { firstWords(it, 14) }
        return TutorDiagram(
            title = "How \"$lessonTitle\" flows",
            altText = alt,
            nodes = nodes,
            edges = edges
        )
    }

    private fun firstWords(s: String, n: Int): String {
        val w = s.trim().split(Regex("\\s+"))
        return if (w.size <= n) s.trim() else w.take(n).joinToString(" ") + "…"
    }

    // ── Translate (deterministic dictionary fallback) ─────────────────────

    /**
     * Offline English→Kiswahili dictionary for common school words. Honest
     * partial translation: known words are translated, unknown words stay in
     * English and the UI labels the result as a fallback, not a full
     * translation. A provider-backed translator improves this when
     * credentials exist; the contract stays the same.
     */
    fun translateToKiswahili(text: String): Pair<String, String> {
        val translated = Regex("[A-Za-z]+", RegexOption.IGNORE_CASE).replace(text) { m ->
            SW_DICT[m.value.lowercase()] ?: m.value
        }
        return translated to "offline dictionary"
    }

    private val SW_DICT = mapOf(
        "water" to "maji", "sun" to "jua", "cloud" to "wingu", "clouds" to "mawingu",
        "rain" to "mvua", "river" to "mto", "sea" to "bahari", "ocean" to "bahari",
        "evaporation" to "uvukizaji", "evaporates" to "huvukiza", "condensation" to "kujongea",
        "precipitation" to "mvua", "cycle" to "mzunguko", "vapor" to "mvuke",
        "rises" to "inapanda", "falls" to "inanguka", "cools" to "inapoa", "heats" to "inaota",
        "learn" to "jifunze", "lesson" to "somo", "book" to "kitabu", "school" to "shule",
        "teacher" to "mwalimu", "student" to "mwanafunzi", "plant" to "mmea", "plants" to "mimea",
        "seed" to "mbegu", "grow" to "kua", "food" to "chakula", "earth" to "dunia",
        "air" to "hewa", "heat" to "joto", "cold" to "baridi", "ground" to "ardhi",
        "tree" to "mti", "trees" to "miti", "flower" to "ua", "leaf" to "jani"
    )

    // ── Mastery-aware tone ─────────────────────────────────────────────────

    /** Encouraging opener per mastery state. Educational evidence, never a label of the child. */
    fun masteryIntro(state: String?): String? = when (state) {
        "MASTERED" -> "Great work on this lesson — want a challenge?"
        "APPROACHING" -> "You're close. Let's try another example."
        "DEVELOPING" -> "Let's break this into smaller steps."
        "NEEDS_SUPPORT" -> "Let's go back to the key idea and work through it together."
        else -> null
    }

    /** Opaque session id for practice-question state (no learner data inside). */
    fun newPracticeId(): String {
        val bytes = ByteArray(9)
        random.nextBytes(bytes)
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes)
    }
}
