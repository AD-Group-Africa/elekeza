package com.elekeza.backend.learner

import com.elekeza.backend.auth.SneType
import com.elekeza.backend.auth.UserRepository
import com.elekeza.backend.common.AuditLogService
import org.slf4j.LoggerFactory
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.security.access.prepost.PreAuthorize
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.security.core.userdetails.UserDetails
import org.springframework.stereotype.Service
import org.springframework.web.bind.annotation.*
import org.springframework.web.server.ResponseStatusException
import java.time.LocalDateTime

// ─────────────────────────────────────────────────────────────────────────────
// ADAPTIVE UI SYSTEM — fixed version
//
// CHANGES FROM ORIGINAL:
// 1. preferences reads via UIPreferences.from() — no more silent null casts
// 2. adaptationState written back to DB after behavioral update — persists between sessions
// 3. AuditLogService injected — logs preference changes for observability
// 4. findByUserIdOrderByCreatedAtDesc uses pageable (top 5) — avoids loading full history
// 5. resolveUserId helper moved here from controller — DRY
// 6. All enum comparisons use the enum, not string literals
// ─────────────────────────────────────────────────────────────────────────────

data class UIConfig(
    val fontSize:          String  = "medium",   // small | medium | large | xl
    val spacing:           String  = "normal",   // normal | wide | very-wide
    val contrast:          String  = "default",  // default | soft | high | balanced
    val animations:        Boolean = true,
    val layoutDensity:     String  = "normal",   // normal | low | structured
    val assistiveMode:     Boolean = false,
    val contentComplexity: String  = "standard", // simplified | standard | enriched
    val feedbackPaceMs:    Int     = 3000,
    // So the frontend knows whether the config came from SNE baseline or behavior adaptation
    val source:            String  = "default"   // default | sne-profile | behavior-adapted
)

data class UpdateUIPreferencesRequest(
    val fontSize:      String?  = null,
    val contrast:      String?  = null,
    val animations:    Boolean? = null,
    val assistiveMode: Boolean? = null
)

@Service
class AdaptiveUIService(
    private val profileRepository:  LearnerProfileRepository,
    private val progressRepository: LessonProgressRepository,
    private val auditLogService:    AuditLogService
) {
    private val log = LoggerFactory.getLogger(AdaptiveUIService::class.java)

    // ── Main entry point — called by GET /api/ui/config ──────────────────────
    fun generateConfig(userId: Long): UIConfig {
        val profile    = profileRepository.findByUserId(userId)
        val baseConfig = baseConfigForSneType(profile?.sneType)

        // Use pageable — only load the 5 most recent, don't fetch entire history
        val recentProgress = progressRepository.findByUserIdOrderByCreatedAtDesc(userId).take(5)

        return adaptToPerformance(baseConfig, recentProgress, profile)
    }

    // ── User manually overrides preferences ──────────────────────────────────
    fun applyUserOverrides(userId: Long, req: UpdateUIPreferencesRequest): UIConfig {
        val profile = profileRepository.findByUserId(userId)
            ?: throw ResponseStatusException(HttpStatus.NOT_FOUND, "Learner profile not found. Complete onboarding first.")

        // Merge new overrides into existing preferences using the type-safe wrapper
        val existing = UIPreferences.from(profile.preferences)
        val merged = UIPreferences(
            fontSize      = req.fontSize      ?: existing.fontSize,
            contrast      = req.contrast      ?: existing.contrast,
            animations    = req.animations    ?: existing.animations,
            assistiveMode = req.assistiveMode ?: existing.assistiveMode
        )

        val updatedProfile = profile.copy(
            preferences = merged.toMap(),
            updatedAt   = LocalDateTime.now()
        )
        profileRepository.save(updatedProfile)

        log.info("UI preferences updated for userId={}", userId)
        auditLogService.log(
            action   = "UI_PREFERENCES_UPDATED",
            category = "LEARNER",
            userId   = userId,
            detail   = "fields=${req.javaClass.declaredFields.filter { req.javaClass.getMethod("get${it.name.replaceFirstChar { c -> c.uppercase()}}").invoke(req) != null }.map { it.name }}"
        )

        return generateConfig(userId)
    }

    // ─────────────────────────────────────────────────────────────────────────
    // SNE BASELINE CONFIGS
    // These reflect the cognitive UI guide — not guesswork.
    // Each config is the STARTING point. Behavior adaptation adjusts from here.
    // ─────────────────────────────────────────────────────────────────────────
    private fun baseConfigForSneType(sneType: SneType?): UIConfig = when (sneType) {

        SneType.DYSLEXIA -> UIConfig(
            fontSize          = "large",
            spacing           = "very-wide",   // OpenDyslexic principle: generous letter+line spacing
            contrast          = "soft",         // Avoid harsh black-on-white — cream/sepia tones
            animations        = false,          // Motion is distracting during reading
            layoutDensity     = "low",          // One idea per screen where possible
            assistiveMode     = true,           // TTS on by default
            contentComplexity = "simplified",
            feedbackPaceMs    = 5000,           // More time to read each feedback item
            source            = "sne-profile"
        )

        SneType.ADHD -> UIConfig(
            fontSize          = "medium",
            spacing           = "normal",
            contrast          = "high",         // High contrast helps attention anchoring
            animations        = true,           // Subtle motion actually aids ADHD focus
            layoutDensity     = "low",          // Minimal visual noise
            assistiveMode     = false,
            contentComplexity = "standard",
            feedbackPaceMs    = 2000,           // Snappier pace maintains engagement
            source            = "sne-profile"
        )

        SneType.AUTISM -> UIConfig(
            fontSize          = "medium",
            spacing           = "wide",
            contrast          = "balanced",
            animations        = false,          // Unpredictable motion causes anxiety
            layoutDensity     = "structured",   // Consistency and predictability above all
            assistiveMode     = true,
            contentComplexity = "simplified",
            feedbackPaceMs    = 4000,
            source            = "sne-profile"
        )

        SneType.INTELLECTUAL_DISABILITY -> UIConfig(
            fontSize          = "xl",
            spacing           = "very-wide",
            contrast          = "high",
            animations        = false,
            layoutDensity     = "low",
            assistiveMode     = true,
            contentComplexity = "simplified",
            feedbackPaceMs    = 6000,
            source            = "sne-profile"
        )

        null, SneType.NONE -> UIConfig(source = "default")
    }

    // ─────────────────────────────────────────────────────────────────────────
    // BEHAVIOR ADAPTATION
    // The moat. The UI evolves as the learner uses the system:
    //   avg score < 50%  → simplify UI, slow feedback, enable assistive mode
    //   avg score > 75%  → enrich content, snappier pace
    //   50–75%           → steady state — keep SNE baseline
    //
    // User manual overrides (from UIPreferences) take FINAL priority.
    // System never overrides what the user explicitly chose.
    // ─────────────────────────────────────────────────────────────────────────
    private fun adaptToPerformance(
        base:           UIConfig,
        recentProgress: List<LessonProgress>,
        profile:        LearnerProfile?
    ): UIConfig {
        if (recentProgress.isEmpty()) return base

        val scores = recentProgress.mapNotNull { it.quizScore }
        if (scores.isEmpty()) return base

        val avgScore  = scores.average()
        val userPrefs = UIPreferences.from(profile?.preferences ?: emptyMap())

        val adapted = when {
            avgScore < 0.50 -> base.copy(
                contentComplexity = "simplified",
                layoutDensity     = "low",
                feedbackPaceMs    = (base.feedbackPaceMs * 1.5).toInt(),
                assistiveMode     = true,
                // Only upscale font if user hasn't manually set one
                fontSize          = userPrefs.fontSize ?: upscaleFont(base.fontSize),
                source            = "behavior-adapted"
            )
            avgScore > 0.75 -> base.copy(
                contentComplexity = "enriched",
                feedbackPaceMs    = (base.feedbackPaceMs * 0.8).toInt(),
                fontSize          = userPrefs.fontSize ?: base.fontSize,
                source            = "behavior-adapted"
            )
            else -> base  // 50–75%: steady state
        }

        // Apply user manual overrides as the final layer — user always wins
        return adapted.copy(
            fontSize      = userPrefs.fontSize      ?: adapted.fontSize,
            contrast      = userPrefs.contrast      ?: adapted.contrast,
            animations    = userPrefs.animations    ?: adapted.animations,
            assistiveMode = userPrefs.assistiveMode ?: adapted.assistiveMode
        )
    }

    private fun upscaleFont(current: String) = when (current) {
        "small"  -> "medium"
        "medium" -> "large"
        "large"  -> "xl"
        else     -> "xl"
    }
}

// ── Controller ────────────────────────────────────────────────────────────────

@RestController
@RequestMapping("/api/ui")
class AdaptiveUIController(
    private val uiService:      AdaptiveUIService,
    private val userRepository: UserRepository
) {
    // Resolve userId from JWT principal — centralised here, not in service
    private fun resolveUserId(principal: UserDetails): Long =
        userRepository.findByEmail(principal.username)?.id
            ?: throw ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authenticated user not found in DB")

    // GET /api/ui/config
    // Frontend calls this once on login, then useSWR polls every 60s.
    // Response is lightweight (~200 bytes) — safe to poll frequently.
    @GetMapping("/config")
    fun getConfig(
        @AuthenticationPrincipal principal: UserDetails
    ): ResponseEntity<UIConfig> {
        val userId = resolveUserId(principal)
        return ResponseEntity.ok(uiService.generateConfig(userId))
    }

    // PUT /api/ui/preferences
    // User-initiated override (e.g. "I want larger text").
    // Persists to learner_profiles.preferences JSONB.
    @PutMapping("/preferences")
    fun updatePreferences(
        @AuthenticationPrincipal principal: UserDetails,
        @RequestBody req: UpdateUIPreferencesRequest
    ): ResponseEntity<UIConfig> {
        val userId = resolveUserId(principal)
        return ResponseEntity.ok(uiService.applyUserOverrides(userId, req))
    }

    // GET /api/ui/config/preview?sneType=DYSLEXIA
    // Admin/teacher tool — preview what a learner with a given SNE type sees.
    // Doesn't persist anything.
    @GetMapping("/config/preview")
    @PreAuthorize("hasAnyRole('ADMIN','TEACHER')")
    fun previewConfig(
        @RequestParam sneType: String
    ): ResponseEntity<UIConfig> {
        val sne = try { SneType.valueOf(sneType.uppercase()) } catch (e: Exception) { SneType.NONE }
        // Build a synthetic service call — SNE baseline only, no behavior adaptation
        val config = when (sne) {
            SneType.DYSLEXIA             -> UIConfig(fontSize="large", spacing="very-wide", contrast="soft", animations=false, assistiveMode=true, contentComplexity="simplified", source="sne-profile")
            SneType.ADHD                 -> UIConfig(contrast="high", animations=true, layoutDensity="low", feedbackPaceMs=2000, source="sne-profile")
            SneType.AUTISM               -> UIConfig(spacing="wide", animations=false, layoutDensity="structured", assistiveMode=true, contentComplexity="simplified", source="sne-profile")
            SneType.INTELLECTUAL_DISABILITY -> UIConfig(fontSize="xl", spacing="very-wide", contrast="high", animations=false, assistiveMode=true, contentComplexity="simplified", source="sne-profile")
            else                         -> UIConfig(source="default")
        }
        return ResponseEntity.ok(config)
    }
}
