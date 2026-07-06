-- V15: Seed test accounts (fixed column names)
-- Teachers (password: teacher123)
INSERT INTO users (id, name, email, password, role, onboarding_complete)
VALUES (2, 'Alice Mwalimu', 'teacher@elekeza.app', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'TEACHER', true)
ON CONFLICT (email) DO NOTHING;

-- Students (password: student123)
INSERT INTO users (id, name, email, password, role, onboarding_complete)
VALUES (1, 'Juma Ali', 'student@elekeza.app', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'STUDENT', true)
ON CONFLICT (email) DO NOTHING;

-- Parents (password: parent123)
INSERT INTO users (id, name, email, password, role, onboarding_complete)
VALUES (3, 'Fatima Ali', 'parent@elekeza.app', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'GUARDIAN', true)
ON CONFLICT (email) DO NOTHING;
