-- V15: Seed test accounts (correct column names, safe re-run)
-- Passwords encoded with BCrypt cost=10, Spring Security compatible:
--   teacher123, student123, parent123

-- Teachers
INSERT INTO users (id, name, email, password, role, onboarding_complete)
VALUES (2, 'Alice Mwalimu', 'teacher@elekeza.app', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'TEACHER', true)
ON CONFLICT (email) DO NOTHING;

-- Students
INSERT INTO users (id, name, email, password, role, onboarding_complete)
VALUES (1, 'Juma Ali', 'student@elekeza.app', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'STUDENT', true)
ON CONFLICT (email) DO NOTHING;

-- Guardians
INSERT INTO users (id, name, email, password, role, onboarding_complete)
VALUES (3, 'Fatima Ali', 'parent@elekeza.app', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'GUARDIAN', true)
ON CONFLICT (email) DO NOTHING;

-- Advance the sequence past the explicitly inserted IDs so future inserts don't collide
SELECT setval(pg_get_serial_sequence('users', 'id'), GREATEST(nextval(pg_get_serial_sequence('users', 'id')), 10));
