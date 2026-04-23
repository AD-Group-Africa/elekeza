-- V4: Security hardening + performance indexes
-- Run: ./gradlew flywayMigrate

-- ============================================================
-- PASSWORD RESET TOKENS (BE-003)
-- ============================================================
CREATE TABLE IF NOT EXISTS password_reset_tokens (
                                                     id          BIGSERIAL PRIMARY KEY,
                                                     user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash  VARCHAR(64) NOT NULL UNIQUE,
    expires_at  TIMESTAMP NOT NULL,
    used        BOOLEAN DEFAULT FALSE,
    created_at  TIMESTAMP DEFAULT NOW()
    );

CREATE INDEX IF NOT EXISTS idx_prt_hash    ON password_reset_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_prt_expires ON password_reset_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_prt_user    ON password_reset_tokens(user_id);

-- ============================================================
-- PERFORMANCE INDEXES (BE-004)
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_users_email
    ON users(email);

CREATE INDEX IF NOT EXISTS idx_users_role
    ON users(role);

CREATE INDEX IF NOT EXISTS idx_learner_profile_user
    ON learner_profiles(user_id);

CREATE INDEX IF NOT EXISTS idx_lesson_progress_user
    ON lesson_progress(user_id);

CREATE INDEX IF NOT EXISTS idx_lesson_progress_user_done
    ON lesson_progress(user_id, completed);

CREATE INDEX IF NOT EXISTS idx_lesson_progress_date
    ON lesson_progress(completed_at DESC);