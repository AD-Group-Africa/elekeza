package com.elekeza.backend.personalization

import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test

/**
 * Pure-domain tests for the adaptation engine, safety validator and signal
 * accumulator — no Spring context, deterministic by construction.
 *
 * Key invariants under test:
 *  - deterministic transforms never invent content (curriculum preserved);
 *  - AI-output validation rejects diagnostic phrasing / invented text;
 *  - a single interaction never flips a persistent preference;
 *  - confidence decays so stale inferences re-evaluate.
 */
class PersonalizationDomainTest {

    private val source = """
        Fractions are parts of a whole. A fraction has a numerator on top and a denominator on the bottom.
        The numerator counts the parts you have. The denominator shows how many equal parts make the whole.
    """.trimIndent()

    // ── TextAdaptation: determinism + curriculum preservation ──────────────

    @Test
    fun `original code returns text unchanged`() {
        assertThat(TextAdaptation.adapt(source, AdaptationCode.ORIGINAL)).isEqualTo(source.trim())
    }

    @Test
    fun `all codes preserve every content sentence`() {
        val sentences = source.trim().split(Regex("(?<=[.!?])\\s+"))
        val words = source.lowercase().split(Regex("\\W+")).filter { it.length > 3 }.toSet()
        AdaptationCode.entries.filter { it != AdaptationCode.ORIGINAL }.forEach { code ->
            val out = TextAdaptation.adapt(source, code)
            val outWords = out.lowercase().split(Regex("\\W+")).toSet()
            // Every key content term of the original survives the transform.
            assertThat(outWords).containsAll(words)
            // No invented vocabulary appears.
            assertThat(outWords - words).doesNotContain("banana", "alien", "gravity")
        }
        // Sentence count is preserved exactly for non-de-duplicating codes.
        assertThat(TextAdaptation.adapt(source, AdaptationCode.STEP_BY_STEP).split("\n\n").size)
            .isEqualTo(TextAdaptation.adapt(source, AdaptationCode.SPACED).split("\n\n").size)
    }

    @Test
    fun `adaptation is deterministic`() {
        val a = TextAdaptation.adapt(source, AdaptationCode.STEP_BY_STEP)
        val b = TextAdaptation.adapt(source, AdaptationCode.STEP_BY_STEP)
        assertThat(a).isEqualTo(b)
        assertThat(a).contains("Step 1")
    }

    // ── AdaptationSafety: never present unsafe AI output ────────────────────

    @Test
    fun `safety rejects diagnostic phrasing`() {
        val bad = "Fractions are parts of a whole. You have dyslexia so we made this simple."
        assertThat(TextAdaptation.AdaptationSafety.validate(source, bad))
            .anyMatch { it.contains("diagnostic") }
    }

    @Test
    fun `safety rejects invented output that loses the curriculum`() {
        // Only ~1 key term survives → fails the key-term check.
        val invented = "Just think of pizza slices."
        assertThat(TextAdaptation.AdaptationSafety.validate(source, invented))
            .anyMatch { it.contains("key terms") }
    }

    @Test
    fun `safety rejects implausibly short output`() {
        val short = "Fractions."
        assertThat(TextAdaptation.AdaptationSafety.validate(source, short))
            .anyMatch { it.contains("short") }
    }

    @Test
    fun `safety accepts a faithful rephrasing`() {
        val faithful = "Fractions are parts of a whole. The numerator counts the parts you have. " +
            "The denominator shows how many equal parts make the whole."
        assertThat(TextAdaptation.AdaptationSafety.validate(source, faithful)).isEmpty()
    }

    // ── SignalAccumulator: evidence before change, decay, no labelling ──────

    @Test
    fun `single helpful interaction never promotes a persistent preference`() {
        val acc = SignalAccumulator()
        var signals = emptyMap<String, LearningSignal>()
        val s1 = acc.record(signals, LearningPreferences.EXPLANATION_STYLE, "STEP_BY_STEP", helpful = true)
        assertThat(acc.asObservedPreference(s1)).isNull()
        signals = mapOf(LearningPreferences.EXPLANATION_STYLE to s1)
        val s2 = acc.record(signals, LearningPreferences.EXPLANATION_STYLE, "STEP_BY_STEP", helpful = true)
        assertThat(acc.asObservedPreference(s2)).isNull()
        // Third consistent helpful signal reaches the threshold.
        val s3 = acc.record(mapOf(LearningPreferences.EXPLANATION_STYLE to s2), LearningPreferences.EXPLANATION_STYLE, "STEP_BY_STEP", helpful = true)
        val pref = acc.asObservedPreference(s3)
        assertThat(pref).isNotNull
        assertThat(pref!!.value).isEqualTo("STEP_BY_STEP")
        assertThat(pref.source).isEqualTo(Source.OBSERVED)
        assertThat(pref.confidence).isGreaterThanOrEqualTo(0.6)
    }

    @Test
    fun `unhelpful feedback halves confidence instead of accumulating`() {
        val acc = SignalAccumulator()
        var s = acc.record(emptyMap(), LearningPreferences.DENSITY, "SPACIOUS", helpful = true)
        repeat(3) {
            s = acc.record(mapOf(LearningPreferences.DENSITY to s), LearningPreferences.DENSITY, "SPACIOUS", helpful = false)
        }
        assertThat(acc.asObservedPreference(s)).isNull()
        assertThat(s.confidence).isLessThan(0.2)
    }

    @Test
    fun `stale signals decay so the learner is never permanently labelled`() {
        val acc = SignalAccumulator()
        val old = LearningSignal(
            LearningPreferences.EXPLANATION_STYLE, "STEP_BY_STEP", 0.9, 30,
            System.currentTimeMillis() - (365L * 86_400_000L) // a year ago
        )
        val decayed = acc.decay(old)
        assertThat(decayed.confidence).isLessThan(0.2)
    }

    @Test
    fun `fresh signals barely decay`() {
        val acc = SignalAccumulator()
        val fresh = LearningSignal(LearningPreferences.DENSITY, "SPACIOUS", 0.9, 30, System.currentTimeMillis())
        assertThat(acc.decay(fresh).confidence).isCloseTo(0.9, org.assertj.core.data.Offset.offset(0.01))
    }

    // ── Preference serialization round-trip ─────────────────────────────────

    @Test
    fun `entry serializes and parses with source and confidence`() {
        val entry = PreferenceEntry("STEP_BY_STEP", Source.TEACHER, confidence = 0.77, evidenceCount = 12)
        val parsed = LearningPreferences.parseEntry(LearningPreferences.entryToMap(entry))
        assertThat(parsed).isNotNull
        assertThat(parsed!!.value).isEqualTo("STEP_BY_STEP")
        assertThat(parsed.source).isEqualTo(Source.TEACHER)
        assertThat(parsed.confidence).isEqualTo(0.77)
    }

    @Test
    fun `unknown raw map parses as null instead of crashing`() {
        assertThat(LearningPreferences.parseEntry("not-a-map")).isNull()
        assertThat(LearningPreferences.parseEntry(mapOf("x" to 1))).isNull()
    }
}
