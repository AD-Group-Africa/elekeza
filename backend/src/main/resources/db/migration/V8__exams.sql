-- V8: Exams module.
-- Exams are institution-scoped. Attempts are SERVER-authoritative: the backend
-- records started_at/expires_at and validates submission timing; the client
-- timer is display-only. Answers are autosaved server-side so a refresh or
-- network drop never loses work. Integrity events are advisory (layered
-- controls), never an automatic fail.

CREATE TABLE exams (
    id               BIGSERIAL PRIMARY KEY,
    institution_id   BIGINT NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
    creator_id       BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title            VARCHAR(255) NOT NULL,
    description      TEXT,
    subject          VARCHAR(255) NOT NULL,
    duration_minutes INT NOT NULL DEFAULT 30,
    max_attempts     INT NOT NULL DEFAULT 1,
    status           VARCHAR(20) NOT NULL DEFAULT 'DRAFT',   -- DRAFT | PUBLISHED | CLOSED
    available_from   TIMESTAMPTZ,
    available_until  TIMESTAMPTZ,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_exam_institution ON exams(institution_id);
CREATE INDEX idx_exam_status ON exams(status);

CREATE TABLE exam_questions (
    id           BIGSERIAL PRIMARY KEY,
    exam_id      BIGINT NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
    question     TEXT NOT NULL,
    qtype        VARCHAR(20) NOT NULL DEFAULT 'MCQ',         -- MCQ | TRUE_FALSE | SHORT_ANSWER
    option_a     TEXT,
    option_b     TEXT,
    option_c     TEXT,
    option_d     TEXT,
    correct_option VARCHAR(1),                                -- A-D for MCQ/TRUE_FALSE (T/F stored as A/B)
    correct_text   TEXT,                                      -- for SHORT_ANSWER auto-marking
    marks        INT NOT NULL DEFAULT 1,
    order_index  INT NOT NULL DEFAULT 0
);
CREATE INDEX idx_exam_question_exam ON exam_questions(exam_id);

CREATE TABLE exam_attempts (
    id           BIGSERIAL PRIMARY KEY,
    exam_id      BIGINT NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
    student_id   BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    started_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at   TIMESTAMPTZ NOT NULL,
    submitted_at TIMESTAMPTZ,
    status       VARCHAR(20) NOT NULL DEFAULT 'IN_PROGRESS',  -- IN_PROGRESS | SUBMITTED | TIMED_OUT
    score        DOUBLE PRECISION,
    total_marks  INT NOT NULL DEFAULT 0
);
CREATE INDEX idx_exam_attempt_exam ON exam_attempts(exam_id);
CREATE INDEX idx_exam_attempt_student ON exam_attempts(student_id);

CREATE TABLE exam_answers (
    id          BIGSERIAL PRIMARY KEY,
    attempt_id  BIGINT NOT NULL REFERENCES exam_attempts(id) ON DELETE CASCADE,
    question_id BIGINT NOT NULL REFERENCES exam_questions(id) ON DELETE CASCADE,
    answer      TEXT,                                        -- option letter or free text
    saved_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_exam_answer_attempt ON exam_answers(attempt_id);
CREATE UNIQUE INDEX uq_exam_answer ON exam_answers(attempt_id, question_id);

CREATE TABLE exam_integrity_events (
    id          BIGSERIAL PRIMARY KEY,
    attempt_id  BIGINT NOT NULL REFERENCES exam_attempts(id) ON DELETE CASCADE,
    event_type  VARCHAR(50) NOT NULL,                        -- TAB_HIDDEN | WINDOW_BLURRED | FULLSCREEN_EXITED | NAVIGATION_ATTEMPT | REFRESH | NETWORK_LOST | ANSWER_SAVED | SUBMITTED
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    detail      VARCHAR(255)
);
CREATE INDEX idx_exam_integrity_attempt ON exam_integrity_events(attempt_id);
