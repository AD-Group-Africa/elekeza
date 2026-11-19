package com.elekeza.backend.config.seed

import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.DisplayName
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.springframework.boot.DefaultApplicationArguments
import org.springframework.mock.env.MockEnvironment

/**
 * Wave 0 (SEC-P0-03) regression tests.
 *
 * These pin two things that were previously wrong:
 *  1. The base profile must not default the demo dataset ON, because that
 *     dataset creates a platform ADMIN whose password is in the repository.
 *  2. The startup guard must fail closed for any profile that is not dev/test.
 */
class DemoSeedGuardTest {

    private fun guard(seed: String, vararg profiles: String): DemoSeedGuard {
        val env = MockEnvironment().apply { setActiveProfiles(*profiles) }
        return DemoSeedGuard(seed, env)
    }

    // ── Guard decision matrix ────────────────────────────────────────────────

    @Test
    @DisplayName("seeding OFF is always permitted, on every profile")
    fun offIsAlwaysPermitted() {
        assertTrue(DemoSeedGuard.isPermitted("FALSE", listOf("prod")))
        assertTrue(DemoSeedGuard.isPermitted("false", emptyList()))
        assertTrue(DemoSeedGuard.isPermitted(null, listOf("docker")))
        assertTrue(DemoSeedGuard.isPermitted("", listOf("staging")))
    }

    @Test
    @DisplayName("seeding ON is permitted only for dev and test")
    fun onIsPermittedOnlyForDevAndTest() {
        assertTrue(DemoSeedGuard.isPermitted("TRUE", listOf("dev")))
        assertTrue(DemoSeedGuard.isPermitted("true", listOf("test")))
        assertTrue(DemoSeedGuard.isPermitted(" TRUE ", listOf("test", "extra")))
    }

    @Test
    @DisplayName("seeding ON is rejected for production, docker, staging and no profile at all")
    fun onIsRejectedEverywhereElse() {
        assertFalse(DemoSeedGuard.isPermitted("TRUE", listOf("prod")), "prod must fail closed")
        assertFalse(DemoSeedGuard.isPermitted("TRUE", listOf("docker")), "docker must fail closed")
        assertFalse(DemoSeedGuard.isPermitted("TRUE", listOf("staging")), "staging must fail closed")
        // The original defect: a bare `java -jar` with no profile selected the
        // base config. That must now be a hard failure, not an open ADMIN.
        assertFalse(DemoSeedGuard.isPermitted("TRUE", emptyList()), "no profile must fail closed")
    }

    @Test
    @DisplayName("the runner throws when seeding is enabled outside dev/test")
    fun runnerThrowsOutsidePermittedProfiles() {
        assertThrows<IllegalStateException> { guard("TRUE", "prod").run(DefaultApplicationArguments()) }
        assertThrows<IllegalStateException> { guard("TRUE").run(DefaultApplicationArguments()) }
    }

    @Test
    @DisplayName("the runner does not throw when seeding is enabled for dev")
    fun runnerAllowsDev() {
        guard("TRUE", "dev").run(DefaultApplicationArguments())
    }

    @Test
    @DisplayName("the runner does not throw when seeding is disabled")
    fun runnerAllowsDisabled() {
        guard("FALSE", "prod").run(DefaultApplicationArguments())
    }

    // ── Shipped configuration default ────────────────────────────────────────

    @Test
    @DisplayName("base application.yaml defaults demo seeding to FALSE")
    fun baseProfileDefaultsToDisabled() {
        val yaml = javaClass.classLoader.getResource("application.yaml")
        checkNotNull(yaml) { "application.yaml missing from the classpath" }
        val line = yaml.readText().lineSequence().firstOrNull { it.contains("demoSeedEnabled") }
        checkNotNull(line) { "demoSeedEnabled placeholder is missing from application.yaml" }
        assertTrue(
            line.contains("DEMO_SEED_ENABLED:FALSE"),
            "base profile must default demo seeding to FALSE, found: $line"
        )
    }

    @Test
    @DisplayName("test profile keeps the demo fixtures available")
    fun testProfileKeepsFixtures() {
        val yaml = javaClass.classLoader.getResource("application-test.yml")
        checkNotNull(yaml) { "application-test.yml missing from the classpath" }
        val text = yaml.readText()
        assertTrue(
            text.contains("demoSeedEnabled") && text.contains("TRUE"),
            "the test profile must opt in to the demo fixtures explicitly"
        )
    }
}
