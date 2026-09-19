package com.elekeza.backend.content

import com.fasterxml.jackson.databind.ObjectMapper
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test

class LessonViewTest {

    private val mapper = ObjectMapper()

    private fun content(simplified: String?, raw: String? = null, title: String? = "T") = Content(
        userId = 1L,
        title = title,
        status = ContentStatus.READY,
        simplifiedText = simplified,
        rawText = raw
    )

    @Test
    fun `renders adapted lesson sections and key terms from combined AI document`() {
        val doc = """
            {"lesson": {"title": "The Water Cycle", "sections": [
                {"heading": "Evaporation", "body": "The sun heats water."},
                {"heading": "Rain", "body": "Clouds release water."}
             ], "key_terms": [{"term": "vapour", "definition": "Water in gas form"}]},
             "quiz": {"questions": []}}
        """.trimIndent()
        val view = LessonView.render(content(doc), mapper)
        assertThat(view["title"]).isEqualTo("The Water Cycle")
        @Suppress("UNCHECKED_CAST")
        val sections = view["sections"] as List<Map<String, Any>>
        assertThat(sections).hasSize(2)
        assertThat(sections[0]).containsEntry("heading", "Evaporation")
        assertThat(sections[0]).containsEntry("body", "The sun heats water.")
        assertThat(view["keyTerms"]).isEqualTo(mapOf("vapour" to "Water in gas form"))
    }

    @Test
    fun `renders legacy text-only content as one section`() {
        val view = LessonView.render(content("""{"text":"Water moves around the Earth."}"""), mapper)
        assertThat(view["title"]).isEqualTo("T")
        @Suppress("UNCHECKED_CAST")
        val sections = view["sections"] as List<Map<String, Any>>
        assertThat(sections).hasSize(1)
        assertThat(sections[0]).containsEntry("body", "Water moves around the Earth.")
    }

    @Test
    fun `falls back to raw text when nothing adapted is stored`() {
        val view = LessonView.render(content(null, raw = "Plain source lesson body."), mapper)
        @Suppress("UNCHECKED_CAST")
        val sections = view["sections"] as List<Map<String, Any>>
        assertThat(sections).hasSize(1)
        assertThat(sections[0]).containsEntry("body", "Plain source lesson body.")
        assertThat(view["keyTerms"]).isEqualTo(emptyMap<String, String>())
    }

    @Test
    fun `malformed JSON never crashes the view`() {
        val view = LessonView.render(content("{not json", raw = "Raw still readable."), mapper)
        @Suppress("UNCHECKED_CAST")
        val sections = view["sections"] as List<Map<String, Any>>
        assertThat(sections.map { it["body"] }).contains("Raw still readable.")
    }
}
