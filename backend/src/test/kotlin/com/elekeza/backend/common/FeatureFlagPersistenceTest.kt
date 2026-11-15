package com.elekeza.backend.common

import com.elekeza.backend.common.FeatureFlagOverrideRepository
import com.elekeza.backend.common.FeatureFlagProperties
import com.elekeza.backend.common.FlagConfig
import com.elekeza.backend.common.FeatureFlagService
import com.elekeza.backend.testutil.ApiTestSupport
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired

/**
 * Sprint 3 regression: runtime flag overrides used to live only in an
 * in-memory ConcurrentHashMap and disappeared when the backend restarted.
 * They are write-through persisted now; this test simulates a restart by
 * constructing a SECOND FeatureFlagService against the same repository —
 * the same thing Spring does on boot via its init block.
 */
class FeatureFlagPersistenceTest : ApiTestSupport() {

    @Autowired lateinit var overrideRepo: FeatureFlagOverrideRepository

    private val flagName = "restart-test-flag"

    private fun freshService() = FeatureFlagService(
        // rolloutPercent = 100 ⇒ enabled for everyone (the service treats
        // enabled=true + rollout 100% as the "everyone" configuration).
        FeatureFlagProperties(flags = mapOf(flagName to FlagConfig(enabled = true, rolloutPercent = 100))),
        overrideRepo,
    )

    @Test
    fun `an override survives a (simulated) restart and a clear restores the config value`() {
        assertThat(overrideRepo.findByFlagName(flagName)).isNull()

        val firstInstance = freshService()
        assertThat(firstInstance.isEnabled(flagName, userId = 1L)).isTrue() // config default

        // Admin kill switch → persisted.
        firstInstance.setOverride(flagName, false, updatedBy = 42L)
        assertThat(overrideRepo.findByFlagName(flagName)?.enabled).isFalse()

        // "Restart": a brand new service instance replays the persisted override from init.
        val restarted = freshService()
        assertThat(restarted.isEnabled(flagName, userId = 1L))
            .`as`("a restart must not resurrect a persisted kill switch").isFalse()

        // Clear → the config value applies again.
        restarted.clearOverride(flagName)
        assertThat(overrideRepo.findByFlagName(flagName)).isNull()
        val postClear = freshService()
        assertThat(postClear.isEnabled(flagName, userId = 1L)).isTrue()

        // Leave no override row behind.
        postClear.clearOverride(flagName)
    }
}
