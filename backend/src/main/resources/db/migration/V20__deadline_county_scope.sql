-- ============================================================================
-- V20 — county scoping for REGIONAL school dates
-- ----------------------------------------------------------------------------
-- A REGIONAL deadline previously had no way to say *which* region it belonged
-- to: `deadlines` carried only institution_id and user_id, and the entity had
-- no region concept. The only visibility rule that could be implemented was
-- "every guardian sees every county's dates", which is why REGIONAL rows were
-- temporarily excluded altogether (see
-- docs/audit/ELEKEZA_REGIONAL_SCHOOL_DATES_REGRESSION_REVIEW.md).
--
-- This column supplies the missing key. It stores a NORMALISED county key
-- (lowercase, punctuation and a trailing "County" removed — see CountyKey.kt)
-- so it can be compared with `institutions.county` without relying on exact
-- free-text formatting.
--
-- BACKWARD COMPATIBILITY / DATA POLICY
--   * Nullable: no existing row is modified.
--   * NO BACKFILL. Existing REGIONAL rows are intentionally left with a NULL
--     county_code. Guessing a county from the creator, the institution or the
--     operator's location would be inventing a fact about a school calendar.
--   * A NULL county_code means "not scoped", and an unscoped REGIONAL row is
--     visible to nobody. It must be corrected deliberately by an administrator
--     (see the maintenance query at the bottom of this file).
--   * Non-REGIONAL rows keep NULL and are unaffected: their visibility is
--     decided by institution_id / user_id as before.
-- ============================================================================

ALTER TABLE deadlines ADD COLUMN county_code VARCHAR(64);

COMMENT ON COLUMN deadlines.county_code IS
    'Normalised county key for REGIONAL deadlines (CountyKey.normalize). NULL = unscoped and therefore hidden. Ignored for other scopes.';

CREATE INDEX idx_deadline_county ON deadlines(county_code);

-- ─── Administrative follow-up (do NOT run automatically) ─────────────────────
-- Identify regional rows that are currently invisible because they have no
-- county. An administrator must assign the correct county deliberately:
--
--   SELECT id, title, due_at, created_by
--     FROM deadlines
--    WHERE scope = 'REGIONAL' AND county_code IS NULL
--    ORDER BY due_at;
--
--   UPDATE deadlines SET county_code = '<normalised county>'
--    WHERE id = <id> AND scope = 'REGIONAL';
--
-- Only rows whose county is known from an authoritative source should be
-- updated. There is no automatic derivation.
