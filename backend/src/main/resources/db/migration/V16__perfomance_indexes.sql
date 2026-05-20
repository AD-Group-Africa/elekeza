-- V16__performance_indexes.sql
-- Performance indexes for high-frequency queries
-- Safe to run on existing data — IF NOT EXISTS prevents errors

-- Content queries by user (dashboard history, file list)
CREATE INDEX IF NOT EXISTS idx_content_user_created
    ON content(user_id, created_at DESC);

-- Lesson progress queries (stats, streak calculation, recent activity)
CREATE INDEX IF NOT EXISTS idx_lesson_progress_user_created
    ON lesson_progress(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_lesson_progress_user_completed
    ON lesson_progress(user_id, completed);

-- Quiz sessions by lesson (quiz start/resume)
CREATE INDEX IF NOT EXISTS idx_quiz_sessions_lesson
    ON quiz_sessions(lesson_id);

CREATE INDEX IF NOT EXISTS idx_quiz_sessions_user
    ON quiz_sessions(user_id);

-- Audit log queries (analytics, debugging)
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_created
    ON audit_logs(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_action
    ON audit_logs(action, created_at DESC);

-- Learner profile by user (UI config, onboarding check)
-- Note: LearnerProfile entity already has @Index annotation
-- This ensures the index exists even if Hibernate didn't create it
CREATE INDEX IF NOT EXISTS idx_learner_profile_user
    ON learner_profiles(user_id);

-- Guardians by learner
CREATE INDEX IF NOT EXISTS idx_guardians_learner
    ON guardians(learner_id);