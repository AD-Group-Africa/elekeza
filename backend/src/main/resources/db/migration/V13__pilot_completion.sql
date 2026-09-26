-- ============================================================================
-- ELEKEZA — V13 password reset, guardian lifecycle, timetable, accessibility
-- ----------------------------------------------------------------------------
-- Pilot-completion schema:
--   1. password_reset_tokens  — single-use, expiring, hashed reset tokens
--   2. guardian_links         — lifecycle columns (expires_at, revoked_at)
--   3. timetable_entries      — persisted class timetable (replaces client-only grid)
--   4. accessibility_profiles — per-learner display/reading preferences
--   5. engagement_events      — privacy-conscious pilot telemetry
-- Idempotent toward Hibernate validate: column types match the entities.
-- ============================================================================

-- ─── 1. PASSWORD RESET TOKENS ───────────────────────────────────────────────
-- Only the SHA-256 hash of the token is stored; the raw token exists solely in
-- the reset email. Single-use: used_at is set on successful consumption.
CREATE TABLE password_reset_tokens (
    id          BIGSERIAL PRIMARY KEY,
    user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash  VARCHAR(255) NOT NULL UNIQUE,
    expires_at  TIMESTAMPTZ NOT NULL,
    used_at     TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_password_reset_tokens_user ON password_reset_tokens(user_id);

-- ─── 1b. USER ACTIVATION ────────────────────────────────────────────────────
-- School-level user management: staff/learner accounts can be deactivated.
-- Enforced at login and refresh; a still-valid access token ages out within
-- its short TTL (documented in the runbook).
ALTER TABLE users ADD COLUMN active BOOLEAN NOT NULL DEFAULT TRUE;

-- ─── 2. GUARDIAN LINK LIFECYCLE ─────────────────────────────────────────────
-- Extends the V1 guardian_links relationship with revocation and expiry so
-- temporary caregivers can be safely granted and later removed. is_active
-- (V1) remains the immediate flag; revoked_at records when/that revocation
-- happened and expires_at bounds temporary grants.
ALTER TABLE guardian_links ADD COLUMN expires_at TIMESTAMPTZ;
ALTER TABLE guardian_links ADD COLUMN revoked_at TIMESTAMPTZ;

-- ─── 3. TIMETABLE ───────────────────────────────────────────────────────────
-- One row per (class, day, period) slot. Teacher is optional (free periods).
-- Uniqueness guarantees no double-booking of a class slot; teacher conflicts
-- are validated in the service layer (cross-class, same day/period/teacher).
CREATE TABLE timetable_entries (
    id             BIGSERIAL PRIMARY KEY,
    institution_id BIGINT NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
    class_id       BIGINT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    day_of_week    VARCHAR(10) NOT NULL,   -- MONDAY..FRIDAY
    period         INTEGER NOT NULL,       -- 1-based period index
    subject        VARCHAR(255) NOT NULL,
    teacher_id     BIGINT REFERENCES users(id) ON DELETE SET NULL,
    updated_by     BIGINT REFERENCES users(id) ON DELETE SET NULL,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_timetable_class_slot UNIQUE (class_id, day_of_week, period),
    CONSTRAINT ck_timetable_day CHECK (day_of_week IN ('MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY'))
);
CREATE INDEX idx_timetable_institution ON timetable_entries(institution_id);
CREATE INDEX idx_timetable_teacher ON timetable_entries(teacher_id);

-- ─── 4. ACCESSIBILITY PROFILES ──────────────────────────────────────────────
-- Per-learner presentation preferences (no medical/diagnostic classification).
-- The JSONB settings bag is intentionally free-form but validated in the
-- service layer against a known key set; unknown keys are rejected.
CREATE TABLE accessibility_profiles (
    id          BIGSERIAL PRIMARY KEY,
    user_id     BIGINT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    settings    JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_by  BIGINT REFERENCES users(id) ON DELETE SET NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── 5. ENGAGEMENT EVENTS ───────────────────────────────────────────────────
-- Append-only pilot telemetry. No free-text, no PII beyond the acting user
-- reference required for role-scoped aggregation; retention is handled by the
-- existing audit purge pattern.
CREATE TABLE engagement_events (
    id             BIGSERIAL PRIMARY KEY,
    user_id        BIGINT REFERENCES users(id) ON DELETE SET NULL,
    institution_id BIGINT REFERENCES institutions(id) ON DELETE CASCADE,
    event_type     VARCHAR(64) NOT NULL,  -- LESSON_STARTED, QUIZ_COMPLETED, ...
    ref_type       VARCHAR(64),           -- e.g. LESSON, QUIZ, EXAM, ASSIGNMENT
    ref_id         BIGINT,
    metadata       JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_engagement_events_user ON engagement_events(user_id, created_at);
CREATE INDEX idx_engagement_events_institution ON engagement_events(institution_id, event_type, created_at);
