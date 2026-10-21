package com.elekeza.backend.payments

import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Assertions.fail
import org.junit.jupiter.api.Test
import java.io.File

/**
 * SPRINT 3 P1 — Source-level regression guard.
 *
 * Verifies the P1 fix (failure-path provider verification) is present in
 * MpesaService.kt. Deliberately does not mock the service: a behavioural test
 * needs the full MpesaService constructor, and a source-level guard is enough
 * to catch a revert. Real provider-round-trip behaviour is covered by the
 * existing MpesaCallbackVerificationTest.
 *
 * If this test fails after a code change, either the fix was reverted or the
 * method was refactored and this guard needs updating.
 */
class MpesaCallbackFailureTrustSourceTest {

    private fun locateSource(): File {
        val candidates = listOf(
            File("src/main/kotlin/com/elekeza/backend/payments/MpesaService.kt"),
            File("backend/src/main/kotlin/com/elekeza/backend/payments/MpesaService.kt"),
            File("../backend/src/main/kotlin/com/elekeza/backend/payments/MpesaService.kt"),
        )
        return candidates.firstOrNull { it.exists() && it.length() > 0 }
            ?: fail("Could not locate MpesaService.kt. cwd=${File(".").absolutePath}").let { File("") }
    }

    @Test
    fun `old unverified failure block is absent`() {
        val src = locateSource().readText()
        val old = Regex(
            """if\s*\(\s*resultCode\s*!=\s*0\s*\)\s*\{\s*finalizer\.markFailed\s*\(\s*transaction\s*,\s*resultCode\s*,\s*resultDesc\s*\)\s*return\s*mapOf\s*\(\s*"ResultCode"\s*to\s*0""",
            RegexOption.DOT_MATCHES_ALL
        )
        assertFalse(
            old.containsMatchIn(src),
            "SPRINT 3 P1 REGRESSION: the old unverified failure block is back in MpesaService.kt"
        )
    }

    @Test
    fun `failure path checks isLive before terminal transition`() {
        val src = locateSource().readText()
        assertTrue(src.contains("if (!statusVerifier.isLive)"),
            "SPRINT 3 P1: mock-mode short-circuit missing in failure path")
    }

    @Test
    fun `failure path handles all three verification outcomes`() {
        val src = locateSource().readText()
        val failureSection = src.substringAfter("// SPRINT 3 P1 FIX", "")
        assertTrue(failureSection.isNotEmpty(),
            "SPRINT 3 P1: fix marker absent — cannot locate failure-path block")
        assertTrue(failureSection.contains("is VerificationOutcome.Confirmed"),
            "SPRINT 3 P1: Confirmed outcome not handled in failure path")
        assertTrue(failureSection.contains("is VerificationOutcome.NotSuccessful"),
            "SPRINT 3 P1: NotSuccessful outcome not handled in failure path")
        assertTrue(failureSection.contains("is VerificationOutcome.Unavailable"),
            "SPRINT 3 P1: Unavailable outcome not handled in failure path")
    }

    @Test
    fun `failure path emits audit events for contradicted and unverified cases`() {
        val src = locateSource().readText()
        assertTrue(src.contains("MPESA_FAILURE_CALLBACK_CONTRADICTED"),
            "SPRINT 3 P1: audit event for provider-contradicted failure missing")
        assertTrue(src.contains("MPESA_FAILURE_CALLBACK_UNVERIFIED"),
            "SPRINT 3 P1: audit event for unverified failure missing")
    }

    @Test
    fun `failure path parks unverified transactions instead of failing them`() {
        val src = locateSource().readText()
        assertTrue(src.contains("parkAwaitingVerification"),
            "SPRINT 3 P1: parkAwaitingVerification call missing in failure path")
    }
}
