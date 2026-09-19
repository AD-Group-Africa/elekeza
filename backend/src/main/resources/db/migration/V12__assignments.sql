-- V12: Assignments module.
-- Teachers create assignments (title, instructions, due date, points) scoped
-- to their institution and attach them to classes they are authorized for.
-- Learners submit text (and later files) — one submission per learner per
-- assignment (uniqueness enforced), with status lifecycle and server-owned
-- grading. A guardian reads read-only ward evidence; attendance-style tenant
-- isolation rules apply end to end.

CREATE TABLE assignments (
    id             BIGSERIAL PRIMARY KEY,
    institution_id BIGINT NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
    class_id       BIGINT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    created_by     BIGINT NOT NULL REFERENCES users(id),
    title          VARCHAR(200) NOT NULL,
    instructions   TEXT,
    due_date       DATE,
    points         INT NOT NULL DEFAULT 100 CHECK (points > 0),
    status         VARCHAR(20) NOT NULL DEFAULT 'PUBLISHED'
                   CHECK (status IN ('DRAFT', 'PUBLISHED', 'CLOSED')),
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_assignment_institution ON assignments(institution_id);
CREATE INDEX idx_assignment_class ON assignments(class_id);
CREATE INDEX idx_assignment_due ON assignments(due_date);

CREATE TABLE assignment_submissions (
    id            BIGSERIAL PRIMARY KEY,
    assignment_id BIGINT NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
    learner_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content       TEXT NOT NULL,
    submitted_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- server-owned grading; NULL until a teacher grades
    score         INT,
    feedback      VARCHAR(2000),
    graded_by     BIGINT REFERENCES users(id),
    graded_at     TIMESTAMPTZ,
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- one submission per learner per assignment (resubmission = UPDATE)
    CONSTRAINT uq_submission_assignment_learner UNIQUE (assignment_id, learner_id),
    CONSTRAINT ck_submission_score_nonneg CHECK (score IS NULL OR score >= 0)
);
CREATE INDEX idx_submission_assignment ON assignment_submissions(assignment_id);
CREATE INDEX idx_submission_learner ON assignment_submissions(learner_id);
