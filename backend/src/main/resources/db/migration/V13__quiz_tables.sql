-- V7: Quiz tables (BE-009)

CREATE TABLE IF NOT EXISTS quizzes (
                                       id         BIGSERIAL PRIMARY KEY,
                                       content_id BIGINT    NOT NULL REFERENCES content(id) ON DELETE CASCADE,
    questions  JSONB     NOT NULL DEFAULT '[]',
    created_at TIMESTAMP DEFAULT NOW()
    );

CREATE INDEX IF NOT EXISTS idx_quiz_content ON quizzes(content_id);

CREATE TABLE IF NOT EXISTS quiz_attempts (
                                             id       BIGSERIAL PRIMARY KEY,
                                             user_id  BIGINT         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    quiz_id  BIGINT         NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
    answers  JSONB,
    score    DECIMAL(5, 4)  CHECK (score >= 0 AND score <= 1),
    passed   BOOLEAN,
    taken_at TIMESTAMP DEFAULT NOW()
    );

CREATE INDEX IF NOT EXISTS idx_quiz_attempts_user    ON quiz_attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_quiz    ON quiz_attempts(quiz_id);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_taken   ON quiz_attempts(taken_at DESC);