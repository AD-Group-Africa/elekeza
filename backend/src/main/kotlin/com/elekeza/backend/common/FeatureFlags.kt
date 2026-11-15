package com.elekeza.backend.common

import org.slf4j.LoggerFactory
import org.springframework.boot.context.properties.ConfigurationProperties
import org.springframework.boot.context.properties.EnableConfigurationProperties
import org.springframework.context.annotation.Configuration
import org.springframework.stereotype.Service
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PutMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController
import org.springframework.security.access.prepost.PreAuthorize
import org.springframework.http.ResponseEntity
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.stereotype.Repository
import org.springframework.transaction.annotation.Transactional
import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.Table
import java.time.Instant
import java.util.concurrent.ConcurrentHashMap

// ─────────────────────────────────────────────────────────────────────────────
// WHAT THIS IS: Feature Flags (also called Feature Toggles)
//
// From your rollback screenshot: "Use feature flags for risky changes."
// Instead of deploying and hoping, you deploy with the feature OFF,
// then turn it ON for specific users, then roll it out gradually.
// If something breaks → flip the flag → instant rollback, no redeploy.
//
// ENGINEERING LESSON:
// "The fastest fix for a bad deployment is rolling back to a known good state."
// Feature flags give you that power WITHOUT redeploying.
// Deploy often, release carefully.
//
// HOW TO USE:
//   // In any service:
//   if (featureFlags.isEnabled("adaptive-ui", userId)) {
//       return uiService.generateConfig(userId)  // new path
//   } else {
//       return UIConfig()  // safe default
//   }
// ─────────────────────────────────────────────────────────────────────────────

// Flags loaded from application.yaml — no restart needed if you use a config server later
@ConfigurationProperties(prefix = "features")
data class FeatureFlagProperties(
    val flags: Map<String, FlagConfig> = emptyMap()
)

data class FlagConfig(
    val enabled: Boolean = false,
    val rolloutPercent: Int = 0,        // 0–100: % of users who get it
    val allowedUserIds: Set<Long> = emptySet()  // specific users for testing
)

@Configuration
@EnableConfigurationProperties(FeatureFlagProperties::class)
class FeatureFlagConfig

/**
 * Persisted ADMIN runtime-override layer (Sprint 3). Overrides used to live
 * only in an in-memory map and were lost on every backend restart — a kill
 * switch that un-killed itself. They are now write-through persisted here
 * and reloaded into memory on service construction (i.e. on every boot).
 */
@Entity
@Table(name = "feature_flag_overrides")
data class FeatureFlagOverride(
    @Id
    @Column(name = "flag_name", nullable = false, length = 100)
    val flagName: String,
    @Column(nullable = false)
    val enabled: Boolean,
    @Column(name = "updated_by") val updatedBy: Long? = null,
    @Column(name = "updated_at", nullable = false) val updatedAt: Instant = Instant.now()
)

@Repository
interface FeatureFlagOverrideRepository : JpaRepository<FeatureFlagOverride, Long> {
    fun findByFlagName(flagName: String): FeatureFlagOverride?
}

@Service
class FeatureFlagService(
    private val properties: FeatureFlagProperties,
    private val overrideRepo: FeatureFlagOverrideRepository,
) {
    private val log = LoggerFactory.getLogger(FeatureFlagService::class.java)

    // Runtime overrides — changed via admin API without restart.
    // Backed by feature_flag_overrides so they survive a restart.
    private val runtimeOverrides = ConcurrentHashMap<String, Boolean>()

    init {
        // Replay the persisted override layer into memory on every boot so a
        // restarted backend honours the ADMIN decisions taken before it died.
        overrideRepo.findAll().forEach {
            runtimeOverrides[it.flagName] = it.enabled
            log.info("Feature flag override restored from database: '{}' → {}", it.flagName, it.enabled)
        }
    }

    // ── Main check — use this everywhere in the codebase ─────────────────────
    fun isEnabled(flagName: String, userId: Long? = null): Boolean {
        // Runtime override takes absolute priority (for kill switches)
        runtimeOverrides[flagName]?.let { return it }

        val config = properties.flags[flagName] ?: return false
        if (!config.enabled) return false

        // Specific user allow-list (for internal testing)
        if (userId != null && userId in config.allowedUserIds) {
            log.debug("Flag '{}' enabled for userId={} via allowlist", flagName, userId)
            return true
        }

        // Percentage rollout — deterministic per userId (not random, so same user always gets same result)
        if (config.rolloutPercent > 0 && userId != null) {
            val bucket = (userId % 100).toInt()
            val result = bucket < config.rolloutPercent
            if (result) log.debug("Flag '{}' enabled for userId={} via {}% rollout", flagName, userId, config.rolloutPercent)
            return result
        }

        return config.rolloutPercent == 100  // 100% = everyone
    }

    // Override at runtime (admin action — persisted so it survives restart)
    @Transactional
    fun setOverride(flagName: String, enabled: Boolean, updatedBy: Long? = null) {
        log.warn("Feature flag RUNTIME OVERRIDE: '{}' → {}", flagName, enabled)
        runtimeOverrides[flagName] = enabled
        overrideRepo.save(FeatureFlagOverride(flagName = flagName, enabled = enabled, updatedBy = updatedBy))
    }

    @Transactional
    fun clearOverride(flagName: String) {
        runtimeOverrides.remove(flagName)
        overrideRepo.findByFlagName(flagName)?.let { overrideRepo.delete(it) }
        log.info("Feature flag override cleared: '{}'", flagName)
    }

    fun allFlags(): Map<String, Any> = properties.flags.keys.union(runtimeOverrides.keys)
        .associate { name ->
            name to mapOf(
                "enabled"         to isEnabled(name),
                "runtimeOverride" to runtimeOverrides[name],
                "config"          to properties.flags[name]
            )
        }
}

// ── Admin Controller — ADMIN only ─────────────────────────────────────────────
@RestController
@RequestMapping("/api/admin/flags")
class FeatureFlagController(private val featureFlags: FeatureFlagService) {

    // GET /api/admin/flags — see all flag states
    @GetMapping
    @PreAuthorize("hasRole('ADMIN')")
    fun listFlags(): ResponseEntity<*> = ResponseEntity.ok(featureFlags.allFlags())

    // PUT /api/admin/flags/{name}/override — kill switch (instant rollback)
    @PutMapping("/{name}/override")
    @PreAuthorize("hasRole('ADMIN')")
    fun setOverride(
        @PathVariable name: String,
        @RequestBody body: Map<String, Boolean>
    ): ResponseEntity<*> {
        val enabled = body["enabled"] ?: return ResponseEntity.badRequest().body(mapOf("error" to "Missing 'enabled' field"))
        featureFlags.setOverride(name, enabled)
        return ResponseEntity.ok(mapOf("flag" to name, "enabled" to enabled, "type" to "runtime-override"))
    }

    // DELETE /api/admin/flags/{name}/override — restore to yaml config
    @PutMapping("/{name}/clear")
    @PreAuthorize("hasRole('ADMIN')")
    fun clearOverride(@PathVariable name: String): ResponseEntity<*> {
        featureFlags.clearOverride(name)
        return ResponseEntity.ok(mapOf("flag" to name, "status" to "override-cleared"))
    }
}
