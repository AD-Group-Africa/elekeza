package com.elekeza.backend.auth

// ─────────────────────────────────────────────────────────────────────────────
// SneType — Special Needs Education profile types supported by Elekeza.
//
// ADDING A NEW TYPE:
// 1. Add it here
// 2. Add a prompt file: ai-elewa/prompts/<name>.txt
// 3. Add a baseline UIConfig in AdaptiveUIService.baseConfigForSneType()
// 4. Add Swahili TTS handling in the AI service if applicable
//
// NONE means the learner chose not to specify — use the default config.
// ─────────────────────────────────────────────────────────────────────────────

enum class SneType {
    DYSLEXIA,
    ADHD,
    AUTISM,
    INTELLECTUAL_DISABILITY,
    NONE;               // "Not sure yet" — selected during onboarding

    companion object {
        // Safe parse — frontend sends strings, don't let an unexpected value crash the request
        fun fromString(value: String?): SneType =
            values().firstOrNull { it.name.equals(value?.trim(), ignoreCase = true) } ?: NONE
    }
}
