-- ============================================================================
-- ELEKEZA — V1 baseline schema
-- ----------------------------------------------------------------------------
-- Consolidated, single-source baseline built from the CURRENT JPA entity model
-- (users/content/quiz/institution/learner/notification/audit/mpesa/waitlist).
--
-- WHY THIS REPLACES THE OLD V1..V32 SET:
-- The previous migration files were written against several generations of the
-- schema (learners-UUID era vs users-BIGINT era) and could not build a fresh
-- database: the trigger function referenced by V2/V3 was never defined, the
-- `users` and `learner_profiles` tables were never created, and table/column
-- definitions conflicted across generations. Flyway was also never a runtime
-- dependency, so no environment ever applied any of those migrations. This
-- baseline is therefore the first migration any database will actually run.
-- ============================================================================

-- ─── AUTH: USERS ─────────────────────────────────────────────────────────────
CREATE TABLE users (
    id              BIGSERIAL PRIMARY KEY,
    email           VARCHAR(255) NOT NULL UNIQUE,
    password        VARCHAR(255) NOT NULL,
    name            VARCHAR(255) NOT NULL,
    role            VARCHAR(255) NOT NULL,          -- STUDENT|TEACHER|GUARDIAN|ADMIN|SCHOOL_ADMIN
    institution_id  BIGINT,
    gender          VARCHAR(255),
    phone           VARCHAR(255),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE refresh_tokens (
    id          BIGSERIAL PRIMARY KEY,
    user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash  VARCHAR(255) NOT NULL UNIQUE,
    revoked     BOOLEAN NOT NULL DEFAULT FALSE,
    expires_at  TIMESTAMPTZ NOT NULL
);
CREATE INDEX idx_refresh_tokens_user ON refresh_tokens(user_id);

-- ─── LEARNER PROFILES ────────────────────────────────────────────────────────
CREATE TABLE learner_profiles (
    id               BIGSERIAL PRIMARY KEY,
    user_id          BIGINT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    sne_type         VARCHAR(50),
    preferences      JSONB NOT NULL DEFAULT '{}'::jsonb,
    adaptation_state JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at       TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_learner_profile_user ON learner_profiles(user_id);

-- ─── CONTENT ─────────────────────────────────────────────────────────────────
CREATE TABLE content (
    id                BIGSERIAL PRIMARY KEY,
    user_id           BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title             VARCHAR(255),
    original_filename VARCHAR(255),
    file_path         TEXT,
    sne_type          VARCHAR(50),
    status            VARCHAR(20) NOT NULL,          -- UPLOADING|PROCESSING|READY|FAILED
    simplified_text   TEXT,
    word_count        INT,
    created_at        TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_content_user_id ON content(user_id);
CREATE INDEX idx_content_status ON content(status);

-- ─── LESSON PROGRESS / ASSIGNMENTS ───────────────────────────────────────────
CREATE TABLE lesson_progress (
    id           BIGSERIAL PRIMARY KEY,
    user_id      BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content_id   BIGINT NOT NULL REFERENCES content(id) ON DELETE CASCADE,
    quiz_score   DOUBLE PRECISION,
    completed    BOOLEAN NOT NULL DEFAULT FALSE,
    completed_at TIMESTAMP,
    created_at   TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_lp_user ON lesson_progress(user_id);
CREATE INDEX idx_lp_content ON lesson_progress(content_id);

-- ─── QUIZ ────────────────────────────────────────────────────────────────────
CREATE TABLE quizzes (
    id         BIGSERIAL PRIMARY KEY,
    content_id BIGINT NOT NULL REFERENCES content(id) ON DELETE CASCADE,
    user_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_quiz_content ON quizzes(content_id);
CREATE INDEX idx_quiz_user ON quizzes(user_id);

CREATE TABLE quiz_questions (
    id             BIGSERIAL PRIMARY KEY,
    quiz_id        BIGINT NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
    question       TEXT NOT NULL,
    option_a       TEXT,
    option_b       TEXT,
    option_c       TEXT,
    option_d       TEXT,
    correct_option VARCHAR(1) NOT NULL DEFAULT 'A',
    explanation    TEXT
);
CREATE INDEX idx_quiz_question_quiz ON quiz_questions(quiz_id);

CREATE TABLE quiz_attempts (
    id              BIGSERIAL PRIMARY KEY,
    quiz_id         BIGINT NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
    user_id         BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    score           DOUBLE PRECISION,
    total_questions INT NOT NULL DEFAULT 0,
    completed       BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    completed_at    TIMESTAMP
);
CREATE INDEX idx_quiz_attempt_quiz ON quiz_attempts(quiz_id);
CREATE INDEX idx_quiz_attempt_user ON quiz_attempts(user_id);

-- ─── INSTITUTIONS / GUARDIAN LINKS ───────────────────────────────────────────
CREATE TABLE institutions (
    id              BIGSERIAL PRIMARY KEY,
    name            VARCHAR(255) NOT NULL,
    type            VARCHAR(255) NOT NULL DEFAULT 'SCHOOL',
    sub_county      VARCHAR(255),
    county          VARCHAR(255),
    country         VARCHAR(255) NOT NULL DEFAULT 'Kenya',
    plan            VARCHAR(255) NOT NULL DEFAULT 'STARTER',
    plan_expires_at TIMESTAMPTZ,
    max_students    INT NOT NULL DEFAULT 50,
    max_teachers    INT NOT NULL DEFAULT 5,
    contact_email   VARCHAR(255),
    contact_phone   VARCHAR(255),
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE guardian_links (
    id           BIGSERIAL PRIMARY KEY,
    guardian_id  BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    learner_id   BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    relationship VARCHAR(255) NOT NULL DEFAULT 'PARENT',
    is_active    BOOLEAN NOT NULL DEFAULT TRUE,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_guardian_links_guardian ON guardian_links(guardian_id);
CREATE INDEX idx_guardian_links_learner ON guardian_links(learner_id);

-- ─── NOTIFICATIONS ───────────────────────────────────────────────────────────
CREATE TABLE notifications (
    id         BIGSERIAL PRIMARY KEY,
    user_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type       VARCHAR(50) NOT NULL,                 -- QUIZ_COMPLETED|LESSON_ASSIGNED|PROGRESS_REPORT
    title      VARCHAR(255) NOT NULL,
    body       TEXT NOT NULL,
    read       BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_notif_user_read ON notifications(user_id, read);
CREATE INDEX idx_notif_created ON notifications(created_at);

-- ─── AUDIT ───────────────────────────────────────────────────────────────────
CREATE TABLE audit_logs (
    id         BIGSERIAL PRIMARY KEY,
    user_id    BIGINT REFERENCES users(id) ON DELETE SET NULL,
    action     VARCHAR(50) NOT NULL,
    category   VARCHAR(50) NOT NULL,
    detail     TEXT,
    ip_address VARCHAR(45),
    request_id VARCHAR(36),
    success    BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_audit_user_created ON audit_logs(user_id, created_at);
CREATE INDEX idx_audit_created ON audit_logs(created_at);

-- ─── M-PESA ──────────────────────────────────────────────────────────────────
CREATE TABLE mpesa_transactions (
    id                   BIGSERIAL PRIMARY KEY,
    merchant_request_id  VARCHAR(255),
    checkout_request_id  VARCHAR(255),
    phone_number         VARCHAR(255) NOT NULL,
    amount               DOUBLE PRECISION NOT NULL,
    reference            VARCHAR(255) NOT NULL,
    description          VARCHAR(255) NOT NULL,
    status               VARCHAR(255) NOT NULL DEFAULT 'PENDING',
    result_code          INT,
    result_desc          VARCHAR(255),
    mpesa_receipt_number VARCHAR(255),
    transaction_date     TIMESTAMPTZ,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── WAITLIST ────────────────────────────────────────────────────────────────
CREATE TABLE waitlist_entries (
    id         BIGSERIAL PRIMARY KEY,
    email      VARCHAR(255) NOT NULL UNIQUE,
    name       VARCHAR(100) NOT NULL,
    role       VARCHAR(50) NOT NULL,
    school     VARCHAR(200),
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ─── LEGACY LEARNER MODEL (kept for the learner/guardian entities) ───────────
CREATE TABLE learners (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email               VARCHAR(255) NOT NULL UNIQUE,
    preferred_language  VARCHAR(10),
    age_group           VARCHAR(20),
    learning_goal       TEXT,
    cognitive_profiles  JSONB NOT NULL DEFAULT '[]'::jsonb,
    literacy_level      VARCHAR(20),
    onboarding_complete BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE guardians (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    learner_id   UUID NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
    full_name    VARCHAR(255) NOT NULL,
    relationship VARCHAR(255) NOT NULL,
    phone        VARCHAR(255),
    email        VARCHAR(255)
);
CREATE INDEX idx_guardians_learner ON guardians(learner_id);

CREATE TABLE lessons (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    learner_id        UUID NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
    title             VARCHAR(255) NOT NULL,
    raw_text          TEXT,
    estimated_minutes INT,
    source_type       VARCHAR(255),
    quiz_questions    JSONB,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_lessons_learner ON lessons(learner_id);

CREATE TABLE lesson_sections (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lesson_id           UUID NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
    sequence_number     INT NOT NULL,
    content             TEXT NOT NULL,
    time_spent_seconds  INT NOT NULL DEFAULT 0,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_lesson_sections_lesson ON lesson_sections(lesson_id);

CREATE TABLE key_terms (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lesson_id   UUID REFERENCES lessons(id) ON DELETE CASCADE,
    term        TEXT,
    definition  TEXT
);
CREATE INDEX idx_key_terms_lesson ON key_terms(lesson_id);
