package com.elekeza.backend.calendar

/**
 * Canonical form for a county name, used to compare a REGIONAL deadline with
 * the counties of a learner's institutions.
 *
 * The database stores county names as free text (`institutions.county`), so
 * comparison must not depend on case, spacing, punctuation or a trailing
 * "County" suffix. Everything is reduced to a stable lowercase key:
 *
 *   "Nairobi"          -> "nairobi"
 *   "  NAIROBI  "      -> "nairobi"
 *   "Nairobi County"   -> "nairobi"
 *   "Taita-Taveta"     -> "taita taveta"
 *   "Murang'a"         -> "muranga"
 *
 * This is deliberately not a fixed list of the 47 counties: inventing a
 * taxonomy that the data does not use would reject real school records. The
 * guarantee provided is *consistency*, not validation — an unknown county is
 * still a usable key, it simply will not match anybody (see
 * [DeadlineVisibility]).
 *
 * [normalize] returns null for blank input or input that exceeds the column
 * length, so callers fail closed rather than storing a value that can never
 * match.
 */
object CountyKey {

    /** Must stay <= the `county_code` column length (V20). */
    const val MAX_LENGTH = 64

    private val NON_ALPHANUMERIC = Regex("[^a-z0-9]+")
    private val TRAILING_COUNTY = Regex("\\s+county$")

    fun normalize(raw: String?): String? {
        val lowered = raw?.lowercase()?.replace("'", "") ?: return null
        val key = lowered
            .replace(NON_ALPHANUMERIC, " ")
            .trim()
            .replace(TRAILING_COUNTY, "")
            .trim()
        return key.takeIf { it.isNotEmpty() && it.length <= MAX_LENGTH }
    }

    /** True when both sides resolve to the same non-null county key. */
    fun matches(a: String?, b: String?): Boolean {
        val left = normalize(a) ?: return false
        val right = normalize(b) ?: return false
        return left == right
    }
}
