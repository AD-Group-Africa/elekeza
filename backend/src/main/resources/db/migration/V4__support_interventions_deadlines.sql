-- ============================================================================
-- ELEKEZA — V4 support signals, interventions, academic deadlines
-- ----------------------------------------------------------------------------
-- Early-support signal system (explainable flags), intervention workflow,
-- and a role-scoped academic calendar/deadlines subsystem. Also adds
-- quiz_answers analytics indexes for per-question reporting.
-- ============================================================================

-- ─── Support signals (early-support, explainable, not diagnostic) ────────────
CREATE TABLE support_flags (
    id            BIGSERIAL PRIMARY KEY,
    learner_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    teacher_id    BIGINT REFERENCES users(id) ON DELETE SET NULL,
    signal_type   VARCHAR(50) NOT NULL,   -- LOW_PERFORMANCE|DECLINING|REPEATED_FAILURES|INACTIVITY
    status        VARCHAR(20) NOT NULL DEFAULT 'OPEN',  -- OPEN|ACKNOWLEDGED|DISMISSED
    reasons       TEXT NOT NULL,          -- one human-readable reason per line
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reviewed_at   TIMESTAMPTZ
);
CREATE INDEX idx_support_flag_learner ON support_flags(learner_id);
CREATE INDEX idx_support_flag_status  ON support_flags(status);

-- ─── Interventions (signal -> support action -> outcome) ─────────────────────
CREATE TABLE interventions (
    id            BIGSERIAL PRIMARY KEY,
    learner_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    teacher_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    signal_id     BIGINT REFERENCES support_flags(id) ON DELETE SET NULL,
    type          VARCHAR(50) NOT NULL,   -- EXTRA_PRACTICE|REVIEW_SESSION|PEER_SUPPORT|PARENT_CONTACT|OTHER
    target        TEXT NOT NULL,
    start_date    DATE NOT NULL,
    review_date   DATE,
    status        VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',  -- ACTIVE|COMPLETED|CANCELLED
    outcome       TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_intervention_learner ON interventions(learner_id);
CREATE INDEX idx_intervention_status ON interventions(status);

-- ─── Academic calendar / deadlines (role-scoped) ─────────────────────────────
CREATE TABLE deadlines (
    id             BIGSERIAL PRIMARY KEY,
    institution_id BIGINT REFERENCES institutions(id) ON DELETE CASCADE,
    user_id        BIGINT REFERENCES users(id) ON DELETE CASCADE,  -- individual deadline
    title          VARCHAR(255) NOT NULL,
    deadline_type  VARCHAR(50) NOT NULL,  -- EXAM|ASSIGNMENT|APPLICATION|CURRICULUM|SCHOOL_EVENT|OTHER
    scope          VARCHAR(20) NOT NULL DEFAULT 'INSTITUTION', -- NATIONAL|REGIONAL|INSTITUTION|CLASS|INDIVIDUAL
    due_at         TIMESTAMPTZ NOT NULL,
    description    TEXT,
    created_by     BIGINT NOT NULL REFERENCES users(id),
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_deadline_scope   ON deadlines(scope);
CREATE INDEX idx_deadline_due     ON deadlines(due_at);
CREATE INDEX idx_deadline_user    ON deadlines(user_id);
CREATE INDEX idx_deadline_inst    ON deadlines(institution_id);

-- ─── Quiz analytics indexes (per-question reporting) ─────────────────────────
CREATE INDEX idx_quiz_answer_question_correct ON quiz_answers(question_id, is_correct);
CREATE INDEX idx_quiz_answer_attempt_correct  ON quiz_answers(attempt_id, is_correct);
