-- V25__multi_school_foundation.sql
-- Extends the existing schema for multi-school onboarding, in-app notifications,
-- CSV import tracking, and institution-scoped analytics.

-- 1. institution_id FK on users (safe: adds column only if missing)
ALTER TABLE users ADD COLUMN IF NOT EXISTS institution_id BIGINT REFERENCES institutions(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_users_institution ON users(institution_id);

-- 2. CSV import job tracking
CREATE TABLE IF NOT EXISTS import_jobs (
    id              BIGSERIAL    PRIMARY KEY,
    institution_id  BIGINT       NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
    uploaded_by     BIGINT       NOT NULL REFERENCES users(id),
    filename        VARCHAR(255) NOT NULL,
    status          VARCHAR(20)  NOT NULL DEFAULT 'PENDING'
                                 CHECK (status IN ('PENDING','RUNNING','DONE','DONE_WITH_ERRORS','FAILED')),
    total_rows      INT          NOT NULL DEFAULT 0,
    succeeded_rows  INT          NOT NULL DEFAULT 0,
    failed_rows     INT          NOT NULL DEFAULT 0,
    error_log       TEXT,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    completed_at    TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_import_jobs_institution ON import_jobs(institution_id);

-- 3. In-app notifications (quiz completed, lesson assigned, progress reports)
CREATE TABLE IF NOT EXISTS notifications (
    id              BIGSERIAL    PRIMARY KEY,
    user_id         BIGINT       NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type            VARCHAR(50)  NOT NULL,
    title           VARCHAR(255) NOT NULL,
    body            TEXT         NOT NULL,
    read            BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, read);
CREATE INDEX IF NOT EXISTS idx_notifications_created   ON notifications(created_at DESC);

-- 4. Lesson plans — add institution scope
ALTER TABLE lesson_plans ADD COLUMN IF NOT EXISTS institution_id BIGINT REFERENCES institutions(id) ON DELETE SET NULL;

-- 5. Guardian email lookup index
CREATE INDEX IF NOT EXISTS idx_guardians_email ON guardians(email);

-- 6. Institution invite tokens (for SCHOOL_ADMIN to invite teachers)
CREATE TABLE IF NOT EXISTS institution_invites (
    id             BIGSERIAL    PRIMARY KEY,
    institution_id BIGINT       NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
    email          VARCHAR(255) NOT NULL,
    role           VARCHAR(50)  NOT NULL DEFAULT 'TEACHER',
    token_hash     VARCHAR(64)  NOT NULL UNIQUE,
    expires_at     TIMESTAMPTZ  NOT NULL,
    accepted       BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_invites_token ON institution_invites(token_hash);
CREATE INDEX IF NOT EXISTS idx_invites_email ON institution_invites(email);
