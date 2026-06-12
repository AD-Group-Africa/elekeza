-- V18: Institution model for school management
CREATE TABLE IF NOT EXISTS institutions (
                                            id BIGSERIAL PRIMARY KEY,
                                            name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL DEFAULT 'SCHOOL',
    sub_county VARCHAR(100),
    county VARCHAR(100),
    country VARCHAR(100) DEFAULT 'Kenya',
    plan VARCHAR(50) DEFAULT 'STARTER',
    plan_expires_at TIMESTAMPTZ,
    max_students INTEGER DEFAULT 50,
    max_teachers INTEGER DEFAULT 5,
    contact_email VARCHAR(255),
    contact_phone VARCHAR(20),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

-- Add institution_id to users if not exists
DO $$ BEGIN
ALTER TABLE users ADD COLUMN IF NOT EXISTS institution_id BIGINT REFERENCES institutions(id);
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Add institution_id to learner_profiles if not exists
DO $$ BEGIN
ALTER TABLE learner_profiles ADD COLUMN IF NOT EXISTS institution_id BIGINT REFERENCES institutions(id);
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Guardian-to-learner linking table
CREATE TABLE IF NOT EXISTS guardian_links (
                                              id BIGSERIAL PRIMARY KEY,
                                              guardian_id BIGINT NOT NULL REFERENCES users(id),
    learner_id BIGINT NOT NULL REFERENCES users(id),
    relationship VARCHAR(50) DEFAULT 'PARENT',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(guardian_id, learner_id)
    );

CREATE INDEX IF NOT EXISTS idx_users_institution ON users(institution_id);
CREATE INDEX IF NOT EXISTS idx_learner_profiles_institution ON learner_profiles(institution_id);
CREATE INDEX IF NOT EXISTS idx_guardian_links_guardian ON guardian_links(guardian_id);
CREATE INDEX IF NOT EXISTS idx_guardian_links_learner ON guardian_links(learner_id);