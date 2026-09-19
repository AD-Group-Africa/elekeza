-- ============================================================================
-- ELEKEZA — V3 quiz answers
-- ----------------------------------------------------------------------------
-- Persists one row per question answered in a quiz attempt, so post-quiz
-- review (and later teacher analytics) can show per-question results without
-- re-sending the answer key to the learner while they are answering.
-- ============================================================================

CREATE TABLE quiz_answers (
    id              BIGSERIAL PRIMARY KEY,
    attempt_id      BIGINT NOT NULL REFERENCES quiz_attempts(id)  ON DELETE CASCADE,
    question_id     BIGINT NOT NULL REFERENCES quiz_questions(id) ON DELETE CASCADE,
    selected_option VARCHAR(1) NOT NULL,
    is_correct      BOOLEAN NOT NULL,
    answered_at     TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_quiz_answer_attempt  ON quiz_answers(attempt_id);
CREATE INDEX idx_quiz_answer_question ON quiz_answers(question_id);
