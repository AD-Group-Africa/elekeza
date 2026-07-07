-- V16: Performance indexes (fixed - removed non-existent quiz_sessions table)

-- Content queries by user (dashboard history, file list)
CREATE INDEX IF NOT EXISTS idx_content_user_created
    ON content(user_id, created_at DESC);

-- Lesson progress queries (stats, streak calculation, recent activity)
CREATE INDEX IF NOT EXISTS idx_lesson_progress_user_created
    ON lesson_progress(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_lesson_progress_user_completed
    ON lesson_progress(user_id, completed);

-- Audit log queries (analytics, debugging)
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_created
    ON audit_logs(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_action
    ON audit_logs(action, created_at DESC);

-- Learner profile by user (UI config, onboarding check)
CREATE INDEX IF NOT EXISTS idx_learner_profile_user
    ON learner_profiles(user_id);

-- Guardians by learner
CREATE INDEX IF NOT EXISTS idx_guardians_learner
    ON guardians(learner_id);
