-- V3__core_loop_schema.sql
-- lessons, lesson_sections, key_terms, quizzes, quiz_questions, quiz_responses

-- ── Lessons ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS lessons (
                                       id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    learner_id        UUID        NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
    title             TEXT        NOT NULL,
    raw_text          TEXT,
    estimated_minutes INT         NOT NULL DEFAULT 5,
    source_type       VARCHAR(20) NOT NULL DEFAULT 'text', -- text | file | image
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
    );

CREATE INDEX IF NOT EXISTS idx_lessons_learner_id ON lessons(learner_id);

CREATE TRIGGER lessons_updated_at
    BEFORE UPDATE ON lessons
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── Lesson Sections ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS lesson_sections (
                                               id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    lesson_id           UUID        NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
    sequence_number     INT         NOT NULL,
    content             TEXT        NOT NULL,
    time_spent_seconds  INT         NOT NULL DEFAULT 0,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
    );

CREATE INDEX IF NOT EXISTS idx_lesson_sections_lesson_id ON lesson_sections(lesson_id);

CREATE TRIGGER lesson_sections_updated_at
    BEFORE UPDATE ON lesson_sections
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── Key Terms ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS key_terms (
                                         id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    lesson_id   UUID        NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
    term        VARCHAR(255) NOT NULL,
    definition  TEXT        NOT NULL,
    was_tapped  BOOLEAN     NOT NULL DEFAULT false,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    );

CREATE INDEX IF NOT EXISTS idx_key_terms_lesson_id ON key_terms(lesson_id);

-- ── Quizzes ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS quizzes (
                                       id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    lesson_id        UUID        NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
    learner_id       UUID        NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
    score_percentage NUMERIC(5,2),
    correct_count    INT,
    total_questions  INT         NOT NULL DEFAULT 5,
    summary_message  TEXT,
    completed_at     TIMESTAMPTZ,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
    );

CREATE INDEX IF NOT EXISTS idx_quizzes_lesson_id   ON quizzes(lesson_id);
CREATE INDEX IF NOT EXISTS idx_quizzes_learner_id  ON quizzes(learner_id);

CREATE TRIGGER quizzes_updated_at
    BEFORE UPDATE ON quizzes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── Quiz Questions ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS quiz_questions (
                                              id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    quiz_id           UUID        NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
    sequence_number   INT         NOT NULL,
    question_text     TEXT        NOT NULL,
    options           JSONB       NOT NULL, -- [{ id, text }]
    correct_option_id VARCHAR(50) NOT NULL,
    explanation       TEXT,
    difficulty        VARCHAR(20) NOT NULL DEFAULT 'medium',
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
    );

CREATE INDEX IF NOT EXISTS idx_quiz_questions_quiz_id ON quiz_questions(quiz_id);

-- ── Quiz Responses ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS quiz_responses (
                                              id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    quiz_id            UUID        NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
    quiz_question_id   UUID        NOT NULL REFERENCES quiz_questions(id) ON DELETE CASCADE,
    selected_option_id VARCHAR(50) NOT NULL,
    is_correct         BOOLEAN     NOT NULL,
    latency_ms         INT,
    directive          VARCHAR(20), -- easier | same | harder | revisit
    learner_message    TEXT,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
    );

CREATE INDEX IF NOT EXISTS idx_quiz_responses_quiz_id ON quiz_responses(quiz_id);