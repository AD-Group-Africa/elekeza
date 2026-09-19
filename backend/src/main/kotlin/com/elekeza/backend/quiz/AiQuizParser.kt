package com.elekeza.backend.quiz

import com.fasterxml.jackson.databind.JsonNode
import com.fasterxml.jackson.databind.ObjectMapper
import org.springframework.stereotype.Component

/**
 * A parsed, validated AI quiz question ready for persistence.
 *
 * [correctOption] is the server-side answer key. It must only ever be persisted
 * into [QuizQuestion.correctOption] and must never appear in learner-facing
 * question payloads (see QuizController.startQuiz).
 */
data class ParsedAiQuestion(
    val question: String,
    val optionA: String,
    val optionB: String,
    val optionC: String,
    val optionD: String,
    val correctOption: String,
    val explanation: String?
)

/**
 * Parses the AI-generated quiz JSON stored in Content.simplifiedText.
 *
 * New stored format (FastAPI QuizResponse):
 *   {"quiz": {"questions": [{"id", "text", "options": [{"id","text"}], "correct_id", "explanation"}]}}
 * Legacy stored format (e.g. seeded demo content):
 *   {"quiz": {"questions": [{"question", "options": [{"text", "isCorrect"}]}]}}
 *
 * Return contract:
 *  - `null` — there is genuinely no stored quiz (blank text, non-JSON, no
 *    "quiz" object, or no "questions" array). Callers may fall back to
 *    placeholder questions here.
 *  - empty list — a "quiz" section exists but every question was malformed.
 *    Callers must NOT silently substitute placeholder questions: the AI
 *    content is present but broken, so the problem should surface instead
 *    of being masked by generic rows.
 *  - otherwise the parseable questions, with malformed entries skipped so no
 *    corrupt QuizQuestion rows are ever created.
 */
@Component
class AiQuizParser(private val objectMapper: ObjectMapper) {

    fun parse(storedJson: String?): List<ParsedAiQuestion>? {
        if (storedJson.isNullOrBlank()) return null
        val tree = runCatching { objectMapper.readTree(storedJson) }.getOrNull() ?: return null
        if (!tree.isObject) return null

        val quizNode = tree.get("quiz") ?: return null
        val questionsNode = quizNode.get("questions")
        if (questionsNode == null || !questionsNode.isArray) return null

        return (0 until questionsNode.size()).mapNotNull { i -> parseQuestion(questionsNode.get(i)) }
    }

    private fun parseQuestion(node: JsonNode): ParsedAiQuestion? {
        // Stem: new format "text", legacy format "question".
        val stem = (node.get("text") ?: node.get("question"))?.asText("")?.trim().orEmpty()
        if (stem.isBlank()) return null

        val optionsNode = node.get("options")
        if (optionsNode == null || !optionsNode.isArray) return null

        // Resolve each usable option to a (letter, text) pair. The letter is the
        // option's id when present (new format, "a".."d"), otherwise the
        // positional letter A..D (legacy format). Options with blank text are
        // dropped — they cannot be displayed meaningfully.
        val resolved = mutableListOf<Pair<String, String>>()
        for (i in 0 until optionsNode.size()) {
            val opt = optionsNode.get(i)
            val text = opt.get("text")?.asText("")?.trim().orEmpty()
            if (text.isBlank()) continue
            val id = opt.get("id")?.asText("")?.trim()?.uppercase().orEmpty()
            val letter = if (id.isNotBlank()) id else if (i < 26) ('A' + i).toString() else return null
            resolved += letter to text
        }
        // Fewer than two usable options — cannot grade safely, reject.
        if (resolved.size < 2) return null

        val letters = resolved.map { it.first }.toSet()

        // Correct answer: new format explicit "correct_id"; legacy format the
        // option whose "isCorrect" flag is true (letter by position).
        val explicit = node.get("correct_id")?.asText("")?.trim()?.uppercase()?.takeIf { it.isNotBlank() }
        val legacyIdx = (0 until optionsNode.size()).firstOrNull { i ->
            optionsNode.get(i).get("isCorrect")?.asBoolean(false) ?: false
        }
        val correctLetter = when {
            // New format: correct_id must reference an actual option id, matching
            // the FastAPI service's own completeness validation.
            explicit != null -> if (explicit in letters) explicit else return null
            // Legacy: flag position maps to a letter; the derived letter must
            // reference a usable option (never an empty slot).
            legacyIdx != null && legacyIdx < resolved.size -> ('A' + legacyIdx).toString().takeIf { it in letters } ?: return null
            // No determinable correct answer — reject rather than guess.
            else -> return null
        }

        return ParsedAiQuestion(
            question = stem,
            optionA = resolved.firstOrNull { it.first == "A" }?.second.orEmpty(),
            optionB = resolved.firstOrNull { it.first == "B" }?.second.orEmpty(),
            optionC = resolved.firstOrNull { it.first == "C" }?.second.orEmpty(),
            optionD = resolved.firstOrNull { it.first == "D" }?.second.orEmpty(),
            correctOption = correctLetter,
            explanation = node.get("explanation")?.asText(null)
        )
    }
}
