package com.elekeza.backend.quiz

import com.fasterxml.jackson.databind.ObjectMapper
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test

class AiQuizParserTest {

    private val parser = AiQuizParser(ObjectMapper())

    // ── New FastAPI format ──────────────────────────────────────────────────

    @Test
    fun `parses new AI quiz format with id text options correct_id explanation`() {
        val stored = """
            {
              "lesson": {"title": "The Water Cycle", "sections": [], "key_terms": [], "estimated_minutes": 5, "profile": "none", "stage_flags": {}},
              "quiz": {
                "questions": [
                  {
                    "id": "q1",
                    "text": "What starts the water cycle?",
                    "options": [
                      {"id": "a", "text": "The sun heats water"},
                      {"id": "b", "text": "Rain falls"},
                      {"id": "c", "text": "Clouds form"},
                      {"id": "d", "text": "Water flows"}
                    ],
                    "correct_id": "b",
                    "explanation": "The sun's heat turns water into vapor."
                  }
                ]
              }
            }
        """.trimIndent()

        val parsed = parser.parse(stored)

        assertThat(parsed).isNotNull
        assertThat(parsed!!).hasSize(1)
        val q = parsed[0]
        assertThat(q.question).isEqualTo("What starts the water cycle?")
        assertThat(q.optionA).isEqualTo("The sun heats water")
        assertThat(q.optionB).isEqualTo("Rain falls")
        assertThat(q.optionC).isEqualTo("Clouds form")
        assertThat(q.optionD).isEqualTo("Water flows")
        assertThat(q.correctOption).isEqualTo("B")
        assertThat(q.explanation).isEqualTo("The sun's heat turns water into vapor.")
    }

    @Test
    fun `maps option ids a b c d to optionA optionB optionC optionD`() {
        val stored = """
            {
              "quiz": {
                "questions": [
                  {
                    "id": "q1",
                    "text": "Which letter comes first?",
                    "options": [
                      {"id": "a", "text": "one"},
                      {"id": "b", "text": "two"},
                      {"id": "c", "text": "three"},
                      {"id": "d", "text": "four"}
                    ],
                    "correct_id": "d",
                    "explanation": "Four is d."
                  }
                ]
              }
            }
        """.trimIndent()

        val q = parser.parse(stored)!!.single()

        assertThat(q.optionA).isEqualTo("one")
        assertThat(q.optionB).isEqualTo("two")
        assertThat(q.optionC).isEqualTo("three")
        assertThat(q.optionD).isEqualTo("four")
        assertThat(q.correctOption).isEqualTo("D")
    }

    @Test
    fun `persists correct_id server-side in the parsed dto`() {
        val stored = """
            {"quiz": {"questions": [
              {"id": "q1", "text": "Q?", "options": [
                {"id": "a", "text": "A"}, {"id": "b", "text": "B"},
                {"id": "c", "text": "C"}, {"id": "d", "text": "D"}],
               "correct_id": "a", "explanation": "E"}
            ]}}
        """.trimIndent()

        // The parser exposes the answer key only to persistence code; the
        // controller's learner-facing payload never includes it.
        assertThat(parser.parse(stored)!!.single().correctOption).isEqualTo("A")
    }

    // ── Legacy stored format ────────────────────────────────────────────────

    @Test
    fun `parses legacy stored quiz format deriving correct letter from isCorrect position`() {
        val stored = """
            {
              "lesson": {"title": "The Water Cycle"},
              "quiz": {
                "questions": [
                  {
                    "question": "What starts the water cycle?",
                    "options": [
                      {"text": "The sun heats water", "isCorrect": true},
                      {"text": "Rain falls", "isCorrect": false},
                      {"text": "Clouds form", "isCorrect": false},
                      {"text": "Water flows", "isCorrect": false}
                    ]
                  },
                  {
                    "question": "What do water droplets form in the sky?",
                    "options": [
                      {"text": "Rain", "isCorrect": false},
                      {"text": "Clouds", "isCorrect": false},
                      {"text": "Vapor", "isCorrect": true},
                      {"text": "Ice", "isCorrect": false}
                    ]
                  }
                ]
              }
            }
        """.trimIndent()

        val parsed = parser.parse(stored)!!

        assertThat(parsed).hasSize(2)
        assertThat(parsed[0].correctOption).isEqualTo("A")
        assertThat(parsed[1].correctOption).isEqualTo("C")
        assertThat(parsed[0].optionA).isEqualTo("The sun heats water")
        assertThat(parsed[1].optionB).isEqualTo("Clouds")
    }

    // ── Malformed / incomplete questions are rejected ───────────────────────

    @Test
    fun `rejects questions with a blank stem`() {
        val stored = """
            {"quiz": {"questions": [
              {"id": "q1", "text": "   ", "options": [
                {"id": "a", "text": "A"}, {"id": "b", "text": "B"},
                {"id": "c", "text": "C"}, {"id": "d", "text": "D"}],
               "correct_id": "a", "explanation": "E"}
            ]}}
        """.trimIndent()

        assertThat(parser.parse(stored)).isEmpty()
    }

    @Test
    fun `rejects questions with missing or non-array options`() {
        val noOptions = """{"quiz": {"questions": [{"id": "q1", "text": "Q?", "correct_id": "a"}]}}"""
        val scalarOptions = """{"quiz": {"questions": [{"id": "q1", "text": "Q?", "options": "a,b,c,d", "correct_id": "a"}]}}"""

        assertThat(parser.parse(noOptions)).isEmpty()
        assertThat(parser.parse(scalarOptions)).isEmpty()
    }

    @Test
    fun `rejects questions with fewer than two usable options`() {
        val stored = """
            {"quiz": {"questions": [
              {"id": "q1", "text": "Q?", "options": [
                {"id": "a", "text": "Only option"}],
               "correct_id": "a", "explanation": "E"}
            ]}}
        """.trimIndent()

        assertThat(parser.parse(stored)).isEmpty()
    }

    @Test
    fun `rejects questions whose correct_id does not match any option id`() {
        val stored = """
            {"quiz": {"questions": [
              {"id": "q1", "text": "Q?", "options": [
                {"id": "a", "text": "A"}, {"id": "b", "text": "B"},
                {"id": "c", "text": "C"}, {"id": "d", "text": "D"}],
               "correct_id": "z", "explanation": "E"}
            ]}}
        """.trimIndent()

        assertThat(parser.parse(stored)).isEmpty()
    }

    @Test
    fun `rejects questions with no determinable correct answer`() {
        // New format without correct_id and no isCorrect flags.
        val newFormat = """
            {"quiz": {"questions": [
              {"id": "q1", "text": "Q?", "options": [
                {"id": "a", "text": "A"}, {"id": "b", "text": "B"},
                {"id": "c", "text": "C"}, {"id": "d", "text": "D"}],
               "explanation": "E"}
            ]}}
        """.trimIndent()
        // Legacy format where no option is flagged correct.
        val legacy = """
            {"quiz": {"questions": [
              {"question": "Q?", "options": [
                {"text": "A", "isCorrect": false}, {"text": "B", "isCorrect": false},
                {"text": "C", "isCorrect": false}, {"text": "D", "isCorrect": false}]}
            ]}}
        """.trimIndent()

        assertThat(parser.parse(newFormat)).isEmpty()
        assertThat(parser.parse(legacy)).isEmpty()
    }

    @Test
    fun `skips malformed questions but keeps valid ones`() {
        val stored = """
            {"quiz": {"questions": [
              {"id": "q1", "text": "Valid question", "options": [
                {"id": "a", "text": "A"}, {"id": "b", "text": "B"},
                {"id": "c", "text": "C"}, {"id": "d", "text": "D"}],
               "correct_id": "c", "explanation": "E"},
              {"id": "q2", "text": "", "options": [
                {"id": "a", "text": "A"}, {"id": "b", "text": "B"},
                {"id": "c", "text": "C"}, {"id": "d", "text": "D"}],
               "correct_id": "a", "explanation": "E"}
            ]}}
        """.trimIndent()

        val parsed = parser.parse(stored)!!

        assertThat(parsed).hasSize(1)
        assertThat(parsed.single().question).isEqualTo("Valid question")
        assertThat(parsed.single().correctOption).isEqualTo("C")
    }

    // ── Fallback semantics: null vs empty list ──────────────────────────────

    @Test
    fun `returns null when there is no stored quiz at all`() {
        assertThat(parser.parse(null)).isNull()
        assertThat(parser.parse("   ")).isNull()
        assertThat(parser.parse("Plain extracted text, not JSON.")).isNull()
        assertThat(parser.parse("""{"lesson": {"title": "Only a lesson"}}""")).isNull()
        assertThat(parser.parse("""{"quiz": {"something": 1}}""")).isNull()
    }

    @Test
    fun `returns empty list when quiz section exists but questions array is empty`() {
        // A quiz section is present — the caller must NOT replace it with
        // generic placeholder questions.
        val stored = """{"quiz": {"questions": []}}"""

        assertThat(parser.parse(stored)).isEmpty()
    }

    @Test
    fun `returns empty list when every question is malformed rather than null`() {
        val stored = """
            {"quiz": {"questions": [
              {"id": "q1", "text": "", "options": [
                {"id": "a", "text": "A"}, {"id": "b", "text": "B"},
                {"id": "c", "text": "C"}, {"id": "d", "text": "D"}],
               "correct_id": "a"}
            ]}}
        """.trimIndent()

        assertThat(parser.parse(stored)).isEmpty()
    }

    @Test
    fun `ignores unknown extra fields in stored json`() {
        val stored = """
            {"lesson": {"title": "T", "extra": {"nested": true}},
             "quiz": {"questions": [
               {"id": "q1", "text": "Q?", "unexpected": "x", "options": [
                 {"id": "a", "text": "A"}, {"id": "b", "text": "B"},
                 {"id": "c", "text": "C"}, {"id": "d", "text": "D"}],
                "correct_id": "b", "explanation": "E"}
             ]}}
        """.trimIndent()

        assertThat(parser.parse(stored)!!).hasSize(1)
    }
}
