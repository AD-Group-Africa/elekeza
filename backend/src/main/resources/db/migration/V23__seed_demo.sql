-- Teachers (password: teacher123)
INSERT INTO users (id, name, email, password, role, onboarding_complete)
VALUES (2, 'Alice Mwalimu', 'teacher@elekeza.app', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'TEACHER', true);

-- Students (password: student123)
INSERT INTO users (id, name, email, password, role, onboarding_complete)
VALUES (1, 'Juma Ali', 'student@elekeza.app', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'STUDENT', true);

-- Parents (password: parent123)
INSERT INTO users (id, name, email, password, role, onboarding_complete)
VALUES (3, 'Fatima Ali', 'parent@elekeza.app', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'GUARDIAN', true);

-- Learner profile for student (dyslexia)
INSERT INTO learner_profiles (id, user_id, sne_type, preferences, adaptation_state)
VALUES (1, 1, 'DYSLEXIA', '{}', '{}');

-- Guardian link
INSERT INTO guardians (id, learner_id, full_name, relationship, phone, email)
VALUES (1, 1, 'Fatima Ali', 'Mother', '+254712345678', 'parent@elekeza.app');

-- Demo lesson
INSERT INTO content (id, user_id, title, status, simplified_text)
VALUES (1, 2, 'The Water Cycle', 'READY', '{"text":"Water moves around the Earth. The sun heats it and turns it into vapor. Vapor rises and makes clouds. When clouds get heavy, rain falls. The water flows back and the cycle repeats."}');
