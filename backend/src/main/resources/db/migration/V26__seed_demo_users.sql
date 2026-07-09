-- V26: Insert demo users if they don't exist (safe re-run)

-- Teachers (password: teacher123)
INSERT INTO users (name, email, password, role, onboarding_complete)
VALUES ('Alice Mwalimu', 'teacher@elekeza.app', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'TEACHER', true)
ON CONFLICT (email) DO NOTHING;

-- Students (password: student123)
INSERT INTO users (name, email, password, role, onboarding_complete)
VALUES ('Juma Ali', 'student@elekeza.app', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'STUDENT', true)
ON CONFLICT (email) DO NOTHING;

-- Guardians (password: parent123)
INSERT INTO users (name, email, password, role, onboarding_complete)
VALUES ('Fatima Ali', 'parent@elekeza.app', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'GUARDIAN', true)
ON CONFLICT (email) DO NOTHING;
