-- Add institution_id to users
ALTER TABLE users ADD COLUMN IF NOT EXISTS institution_id BIGINT;

-- Create institutions table
CREATE TABLE IF NOT EXISTS institutions (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) DEFAULT 'SCHOOL',
    sub_county VARCHAR(255),
    county VARCHAR(255),
    country VARCHAR(100) DEFAULT 'Kenya',
    plan VARCHAR(50) DEFAULT 'STARTER',
    plan_expires_at TIMESTAMP,
    max_students INT DEFAULT 50,
    max_teachers INT DEFAULT 5,
    contact_email VARCHAR(255),
    contact_phone VARCHAR(50),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create guardian_links table
CREATE TABLE IF NOT EXISTS guardian_links (
    id BIGSERIAL PRIMARY KEY,
    guardian_id BIGINT NOT NULL,
    learner_id BIGINT NOT NULL,
    relationship VARCHAR(50) DEFAULT 'PARENT',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
