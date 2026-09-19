package com.elekeza.backend.content

import com.fasterxml.jackson.databind.ObjectMapper

/**
 * Builds the learner-facing lesson view from a stored [Content] row.
 *
 * The AI pipeline stores an adapted lesson under `simplified_text` as a JSON
 * document; older content stores simpler shapes. All supported shapes are
 * normalised here so the frontend lesson page only ever sees:
 *
 *   { "id", "title", "status", "sections": [{ "heading", "body" }],
 *     "keyTerms": { "term": "definition" } }
 */
object LessonView {

    /**
     * Parses `sections` and `keyTerms` out of the stored JSON. Pure and
     * deterministic; callers decide what to do when nothing parseable exists.
     */
    fun parseSimplified(raw: String?, objectMapper: ObjectMapper): LessonContent {
        if (raw.isNullOrBlank()) return LessonContent()
        val tree = runCatching { objectMapper.readTree(raw) }.getOrNull() ?: return LessonContent()
        if (!tree.isObject) return LessonContent()

        // Preferred: {"lesson": {...}} (combined AI document).
        val lessonNode = tree.get("lesson")?.takeIf { it.isObject } ?: tree

        val sections = mutableListOf<SectionView>()
        val sectionNodes = lessonNode.get("sections")
        if (sectionNodes != null && sectionNodes.isArray) {
            for (node in sectionNodes) {
                if (!node.isObject) continue
                val heading = node.get("heading")?.asText("")?.trim().orEmpty()
                val bodyNode = node.get("body")
                val body = when {
                    bodyNode == null -> ""
                    bodyNode.isTextual -> bodyNode.asText()
                    bodyNode.isObject -> (bodyNode.get("text") ?: bodyNode.get("content"))?.asText("").orEmpty()
                    else -> ""
                }
                if (body.isBlank() && heading.isBlank()) continue
                sections += SectionView(heading = heading, body = body)
            }
        }
        // Legacy: {"text": "..."} or {"content": "..."} → a single section.
        if (sections.isEmpty()) {
            val legacy = (tree.get("text") ?: tree.get("content"))?.asText("")?.trim().orEmpty()
            if (legacy.isNotBlank()) sections += SectionView(heading = "", body = legacy)
        }

        val keyTerms = linkedMapOf<String, String>()
        val termsNode = lessonNode.get("key_terms") ?: lessonNode.get("keyTerms")
        if (termsNode != null && termsNode.isArray) {
            for (node in termsNode) {
                if (!node.isObject) continue
                val term = node.get("term")?.asText("")?.trim().orEmpty()
                val definition = node.get("definition")?.asText("")?.trim().orEmpty()
                if (term.isNotBlank()) keyTerms[term] = definition
            }
        } else if (termsNode != null && termsNode.isObject) {
            termsNode.fieldNames().forEachRemaining { name ->
                val definition = termsNode.get(name)?.asText("")?.trim().orEmpty()
                keyTerms[name] = definition
            }
        }

        return LessonContent(
            title = lessonNode.get("title")?.asText("")?.trim().orEmpty(),
            sections = sections,
            keyTerms = keyTerms
        )
    }

    fun render(content: Content, objectMapper: ObjectMapper): Map<String, Any?> {
        val parsed = parseSimplified(content.simplifiedText, objectMapper)
        var sections = parsed.sections
        // No adapted sections: fall back to the raw source text so content is
        // readable even before/without AI processing.
        if (sections.isEmpty() && !content.rawText.isNullOrBlank()) {
            sections = listOf(SectionView(heading = "", body = content.rawText))
        }
        return mapOf(
            "id" to content.id,
            "title" to (parsed.title.ifBlank { content.title }.orEmpty()),
            "status" to content.status.name,
            "sections" to sections.map { mapOf("heading" to it.heading, "body" to it.body) },
            "keyTerms" to parsed.keyTerms
        )
    }
}

data class SectionView(val heading: String, val body: String)

data class LessonContent(
    val title: String = "",
    val sections: List<SectionView> = emptyList(),
    val keyTerms: Map<String, String> = emptyMap()
)
