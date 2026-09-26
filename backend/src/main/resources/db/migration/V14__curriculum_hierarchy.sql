-- ============================================================================
-- ELEKEZA — V14 curriculum hierarchy
-- ----------------------------------------------------------------------------
-- The structural spine for CBC-aligned curriculum content:
--
--   learning_area → strand → sub_strand → competency → learning_objective
--
-- DESIGN RULES
--  - The hierarchy is SHARED reference data (institution_id NULL = system/
--    platform-wide, e.g. a national curriculum) or school-local (institution_id
--    set). No tenant may modify shared rows.
--  - No curriculum content is fabricated by this migration: tables ship empty
--    apart from API/seed tooling. Real content is loaded by schools/publishers.
--  - ordered columns give stable display ordering; active flags allow
--    retirement without breaking history.
--  - Lessons/content and assessments link INTO the hierarchy via
--    content.objective_id (nullable FK added here) — never the reverse, so
--    existing rows stay valid while mapping progresses.
-- ============================================================================

CREATE TABLE learning_areas (
    id             BIGSERIAL PRIMARY KEY,
    institution_id BIGINT REFERENCES institutions(id) ON DELETE CASCADE,
    code           VARCHAR(64) NOT NULL,
    name           VARCHAR(255) NOT NULL,
    description    TEXT,
    ordering       INT NOT NULL DEFAULT 0,
    active         BOOLEAN NOT NULL DEFAULT TRUE,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_learning_area_code UNIQUE (institution_id, code)
);
CREATE INDEX idx_learning_areas_institution ON learning_areas(institution_id);

CREATE TABLE strands (
    id               BIGSERIAL PRIMARY KEY,
    learning_area_id BIGINT NOT NULL REFERENCES learning_areas(id) ON DELETE CASCADE,
    institution_id   BIGINT REFERENCES institutions(id) ON DELETE CASCADE,
    code             VARCHAR(64) NOT NULL,
    name             VARCHAR(255) NOT NULL,
    description      TEXT,
    ordering         INT NOT NULL DEFAULT 0,
    active           BOOLEAN NOT NULL DEFAULT TRUE,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_strand_code UNIQUE (learning_area_id, code)
);
CREATE INDEX idx_strands_area ON strands(learning_area_id);
CREATE INDEX idx_strands_institution ON strands(institution_id);

CREATE TABLE sub_strands (
    id         BIGSERIAL PRIMARY KEY,
    strand_id  BIGINT NOT NULL REFERENCES strands(id) ON DELETE CASCADE,
    institution_id BIGINT REFERENCES institutions(id) ON DELETE CASCADE,
    code       VARCHAR(64) NOT NULL,
    name       VARCHAR(255) NOT NULL,
    description TEXT,
    ordering   INT NOT NULL DEFAULT 0,
    active     BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_sub_strand_code UNIQUE (strand_id, code)
);
CREATE INDEX idx_sub_strands_strand ON sub_strands(strand_id);
CREATE INDEX idx_sub_strands_institution ON sub_strands(institution_id);

CREATE TABLE competencies (
    id            BIGSERIAL PRIMARY KEY,
    sub_strand_id BIGINT NOT NULL REFERENCES sub_strands(id) ON DELETE CASCADE,
    institution_id BIGINT REFERENCES institutions(id) ON DELETE CASCADE,
    code          VARCHAR(64) NOT NULL,
    name          VARCHAR(255) NOT NULL,
    description   TEXT,
    ordering      INT NOT NULL DEFAULT 0,
    active        BOOLEAN NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_competency_code UNIQUE (sub_strand_id, code)
);
CREATE INDEX idx_competencies_sub_strand ON competencies(sub_strand_id);
CREATE INDEX idx_competencies_institution ON competencies(institution_id);

CREATE TABLE learning_objectives (
    id             BIGSERIAL PRIMARY KEY,
    competency_id  BIGINT NOT NULL REFERENCES competencies(id) ON DELETE CASCADE,
    institution_id BIGINT REFERENCES institutions(id) ON DELETE CASCADE,
    code           VARCHAR(64) NOT NULL,
    name           VARCHAR(255) NOT NULL DEFAULT '',
    statement      TEXT NOT NULL,
    description    TEXT,
    ordering       INT NOT NULL DEFAULT 0,
    active         BOOLEAN NOT NULL DEFAULT TRUE,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_objective_code UNIQUE (competency_id, code)
);
CREATE INDEX idx_objectives_competency ON learning_objectives(competency_id);

-- Content links into the hierarchy (nullable: mapping is progressive).
ALTER TABLE content ADD COLUMN objective_id BIGINT REFERENCES learning_objectives(id) ON DELETE SET NULL;
CREATE INDEX idx_content_objective ON content(objective_id);
