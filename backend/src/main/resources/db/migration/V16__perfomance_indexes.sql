-- V16: Performance indexes (fixed - removed non-existent quiz_sessions table)

-- Content indexes
CREATE INDEX IF NOT EXISTS idx_content_user_status ON content(user_id, status);

-- Quiz indexes
CREATE INDEX IF NOT EXISTS idx_quiz_content ON quizzes(content_id);
CREATE INDEX IF NOT EXISTS idx_quiz_question_quiz ON quiz_questions(quiz_id);
CREATE INDEX IF NOT EXISTS idx_quiz_attempt_user_quiz ON quiz_attempts(user_id, quiz_id);

-- Lesson progress indexes
CREATE INDEX IF NOT EXISTS idx_lesson_progress_user_content ON lesson_progress(user_id, content_id);
CREATE INDEX IF NOT EXISTS idx_lesson_progress_user_completed ON lesson_progress(user_id, completed);

-- User indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- Guardian indexes
CREATE INDEX IF NOT EXISTS idx_guardians_email ON guardians(email);
CREATE INDEX IF NOT EXISTS idx_guardians_learner ON guardians(learner_id);
