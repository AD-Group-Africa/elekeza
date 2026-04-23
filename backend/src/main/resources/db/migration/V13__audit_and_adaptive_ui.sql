-- V9: Audit logs + adaptive UI columns

-- ── Audit log table ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_logs (
                                          id          BIGSERIAL PRIMARY KEY,
                                          user_id     BIGINT        REFERENCES users(id) ON DELETE SET NULL,
    action      VARCHAR(50)   NOT NULL,
    category    VARCHAR(50)   NOT NULL,
    detail      TEXT,
    ip_address  VARCHAR(45),
    request_id  VARCHAR(36),
    success     BOOLEAN       NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMP     DEFAULT NOW()
    );

CREATE INDEX IF NOT EXISTS idx_audit_user     ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_action   ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_category ON audit_logs(category);
CREATE INDEX IF NOT EXISTS idx_audit_created  ON audit_logs(created_at DESC);
-- Partial index for failure queries (only indexes failed rows = smaller, faster)
CREATE INDEX IF NOT EXISTS idx_audit_failures ON audit_logs(action, created_at DESC) WHERE success = FALSE;

-- ── Adaptive UI columns on learner_profiles ───────────────────────────────────
-- Already has: user_id, sne_type, preferences JSONB
-- Add: adaptation_state (tracks behavioral history for UI adaptation decisions)
ALTER TABLE learner_profiles
    ADD COLUMN IF NOT EXISTS adaptation_state JSONB DEFAULT '{}';

-- NOTE: ui_preferences are stored inside the existing "preferences" JSONB column.
-- No schema change needed — Kotlin reads/writes the sub-keys directly.
-- This is intentional: JSONB for flexible, schema-free preference storage.
