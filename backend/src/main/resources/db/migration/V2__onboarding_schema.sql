-- V2__onboarding_schema.sql
-- Onboarding fields on learners + guardians table

ALTER TABLE learners
    ADD COLUMN IF NOT EXISTS preferred_language VARCHAR(10)  NOT NULL DEFAULT 'en',
    ADD COLUMN IF NOT EXISTS age_group          VARCHAR(20),
    ADD COLUMN IF NOT EXISTS literacy_level     VARCHAR(20),
    ADD COLUMN IF NOT EXISTS learning_goal      TEXT;

CREATE TABLE IF NOT EXISTS guardians (
                                         id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    learner_id   UUID         NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
    full_name    VARCHAR(255) NOT NULL,
    phone        VARCHAR(30),
    email        VARCHAR(255),
    relationship VARCHAR(50)  NOT NULL,
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ  NOT NULL DEFAULT now()
    );

CREATE INDEX IF NOT EXISTS idx_guardians_learner_id ON guardians(learner_id);

CREATE TRIGGER guardians_updated_at
    BEFORE UPDATE ON guardians
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();