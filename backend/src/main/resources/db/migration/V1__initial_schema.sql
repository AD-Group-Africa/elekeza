-- ============================================================
-- Elewa Database Schema — V1
-- All FK columns are indexed. updated_at trigger on every table.
-- ============================================================

-- ─── TRIGGER FUNCTION ───────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ─── LEARNERS ───────────────────────────────────────────────
CREATE TABLE learners (
                          id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                          email                VARCHAR(255) NOT NULL UNIQUE,
                          password_hash        VARCHAR(255) NOT NULL,
                          full_name            VARCHAR(255),
                          broad_goal           TEXT,
                          language_level       VARCHAR(50),
                          content_difficulty   VARCHAR(50),
                          cognitive_profiles   TEXT[],                     -- e.g. ARRAY['dyslexia','adhd']
                          onboarding_complete  BOOLEAN NOT NULL DEFAULT FALSE,
                          created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                          updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TRIGGER trg_learners_updated_at
    BEFORE UPDATE ON learners
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─── REFRESH TOKENS ─────────────────────────────────────────
CREATE TABLE refresh_tokens (
                                id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                                learner_id   UUID NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
                                token_hash   VARCHAR(255) NOT NULL UNIQUE,
                                expires_at   TIMESTAMPTZ NOT NULL,
                                revoked      BOOLEAN NOT NULL DEFAULT FALSE,
                                created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                                updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_refresh_tokens_learner_id  ON refresh_tokens(learner_id);
CREATE INDEX idx_refresh_tokens_token_hash  ON refresh_tokens(token_hash);
CREATE TRIGGER trg_refresh_tokens_updated_at
    BEFORE UPDATE ON refresh_tokens
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─── GUARDIAN LINKS ─────────────────────────────────────────
CREATE TABLE guardian_links (
                                id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                                guardian_id  UUID NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
                                learner_id   UUID NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
                                created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                                updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                                UNIQUE (guardian_id, learner_id)
);
CREATE INDEX idx_guardian_links_guardian_id ON guardian_links(guardian_id);
CREATE INDEX idx_guardian_links_learner_id  ON guardian_links(learner_id);
CREATE TRIGGER trg_guardian_links_updated_at
    BEFORE UPDATE ON guardian_links
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─── LESSONS ────────────────────────────────────────────────
CREATE TABLE lessons (
                         id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                         learner_id       UUID NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
                         title            VARCHAR(500),
                         source_type      VARCHAR(50),                    -- 'text' | 'pdf' | 'docx' | 'image'
                         original_content TEXT,
                         started_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                         completed_at     TIMESTAMPTZ,
                         created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                         updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_lessons_learner_id  ON lessons(learner_id);
CREATE INDEX idx_lessons_started_at  ON lessons(started_at DESC);
CREATE TRIGGER trg_lessons_updated_at
    BEFORE UPDATE ON lessons
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─── LESSON SECTIONS ────────────────────────────────────────
CREATE TABLE lesson_sections (
                                 id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                                 lesson_id          UUID NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
                                 section_order      INTEGER NOT NULL,
                                 content            TEXT NOT NULL,
                                 time_spent_seconds INTEGER NOT NULL DEFAULT 0,
                                 created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                                 updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_lesson_sections_lesson_id ON lesson_sections(lesson_id);
CREATE TRIGGER trg_lesson_sections_updated_at
    BEFORE UPDATE ON lesson_sections
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─── KEY TERMS ──────────────────────────────────────────────
CREATE TABLE key_terms (
                           id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                           lesson_id  UUID NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
                           term       VARCHAR(255) NOT NULL,
                           definition TEXT,
                           was_tapped BOOLEAN NOT NULL DEFAULT FALSE,
                           created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                           updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_key_terms_lesson_id ON key_terms(lesson_id);
CREATE TRIGGER trg_key_terms_updated_at
    BEFORE UPDATE ON key_terms
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─── QUIZZES ────────────────────────────────────────────────
CREATE TABLE quizzes (
                         id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                         lesson_id        UUID NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
                         learner_id       UUID NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
                         score_percentage NUMERIC(5,2),
                         summary_message  TEXT,
                         completed_at     TIMESTAMPTZ,
                         created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                         updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_quizzes_lesson_id   ON quizzes(lesson_id);
CREATE INDEX idx_quizzes_learner_id  ON quizzes(learner_id);
CREATE TRIGGER trg_quizzes_updated_at
    BEFORE UPDATE ON quizzes
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─── QUIZ QUESTIONS ─────────────────────────────────────────
CREATE TABLE quiz_questions (
                                id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                                quiz_id        UUID NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
                                question_order INTEGER NOT NULL,
                                question_text  TEXT NOT NULL,
                                options        JSONB,                            -- array of answer choices
                                correct_answer VARCHAR(500),
                                created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                                updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_quiz_questions_quiz_id ON quiz_questions(quiz_id);
CREATE TRIGGER trg_quiz_questions_updated_at
    BEFORE UPDATE ON quiz_questions
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─── QUIZ RESPONSES ─────────────────────────────────────────
CREATE TABLE quiz_responses (
                                id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                                quiz_id          UUID NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
                                question_id      UUID NOT NULL REFERENCES quiz_questions(id) ON DELETE CASCADE,
                                learner_answer   TEXT,
                                is_correct       BOOLEAN,
                                directive        VARCHAR(100),                   -- adaptive-response directive
                                created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                                updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_quiz_responses_quiz_id      ON quiz_responses(quiz_id);
CREATE INDEX idx_quiz_responses_question_id  ON quiz_responses(question_id);
CREATE TRIGGER trg_quiz_responses_updated_at
    BEFORE UPDATE ON quiz_responses
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─── SYSTEM EVENTS ──────────────────────────────────────────
CREATE TABLE system_events (
                               id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                               event_type  VARCHAR(100) NOT NULL,               -- e.g. 'SCHEDULED_JOB'
                               job_name    VARCHAR(255),
                               status      VARCHAR(50) NOT NULL,                -- 'SUCCESS' | 'FAILURE'
                               message     TEXT,
                               occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_system_events_event_type  ON system_events(event_type);
CREATE INDEX idx_system_events_occurred_at ON system_events(occurred_at DESC);