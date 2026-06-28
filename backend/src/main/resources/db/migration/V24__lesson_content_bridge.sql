-- V24__lesson_content_bridge.sql
-- Adds content_id FK to lessons table so ContentController can look up
-- lesson rows by content.id without scanning rawText.

ALTER TABLE lessons
    ADD COLUMN IF NOT EXISTS content_id BIGINT REFERENCES content(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_lessons_content_id ON lessons(content_id);

-- Lesson plan tables (pilot extension — file reading → schedule feature)
CREATE TABLE IF NOT EXISTS lesson_plans (
    id          BIGSERIAL    PRIMARY KEY,
    teacher_id  BIGINT       NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title       VARCHAR(255) NOT NULL,
    subject     VARCHAR(100),
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS lesson_plan_items (
    id             BIGSERIAL PRIMARY KEY,
    plan_id        BIGINT    NOT NULL REFERENCES lesson_plans(id) ON DELETE CASCADE,
    content_id     BIGINT    NOT NULL REFERENCES content(id)      ON DELETE CASCADE,
    scheduled_date DATE,
    sequence_order INT       NOT NULL,
    duration_mins  INT               DEFAULT 45,
    created_at     TIMESTAMPTZ       NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lpi_plan    ON lesson_plan_items(plan_id);
CREATE INDEX IF NOT EXISTS idx_lpi_content ON lesson_plan_items(content_id);

-- Guardian lookup index by email (used by fixed GuardianController)
CREATE INDEX IF NOT EXISTS idx_guardians_email ON guardians(email);
