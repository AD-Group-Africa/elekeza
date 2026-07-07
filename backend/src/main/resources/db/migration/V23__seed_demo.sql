-- V23: Demo seed data (safe explicit IDs with sequence advancement)
-- All inserts use ON CONFLICT DO NOTHING so re-runs are safe.

-- Teachers (password: teacher123)
INSERT INTO users (id, name, email, password, role, onboarding_complete)
VALUES (2, 'Alice Mwalimu', 'teacher@elekeza.app', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'TEACHER', true)
ON CONFLICT (email) DO NOTHING;

-- Students (password: student123)
INSERT INTO users (id, name, email, password, role, onboarding_complete)
VALUES (1, 'Juma Ali', 'student@elekeza.app', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'STUDENT', true)
ON CONFLICT (email) DO NOTHING;

-- Guardians (password: parent123)
INSERT INTO users (id, name, email, password, role, onboarding_complete)
VALUES (3, 'Fatima Ali', 'parent@elekeza.app', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'GUARDIAN', true)
ON CONFLICT (email) DO NOTHING;

-- Advance users sequence past explicit IDs
SELECT setval(pg_get_serial_sequence('users', 'id'), GREATEST(nextval(pg_get_serial_sequence('users', 'id')), 10));

-- Learner profile for student (dyslexia)
INSERT INTO learner_profiles (id, user_id, sne_type, preferences, adaptation_state)
VALUES (1, 1, 'DYSLEXIA', '{}', '{}')
ON CONFLICT DO NOTHING;

SELECT setval(pg_get_serial_sequence('learner_profiles', 'id'), GREATEST(nextval(pg_get_serial_sequence('learner_profiles', 'id')), 10));

-- Guardian link (UUID PK — use gen_random_uuid, skip if already exists)
INSERT INTO guardians (id, learner_id, full_name, relationship, phone, email)
SELECT gen_random_uuid(), gen_random_uuid(), 'Fatima Ali', 'Mother', '+254712345678', 'parent@elekeza.app'
WHERE NOT EXISTS (SELECT 1 FROM guardians WHERE email = 'parent@elekeza.app');

-- Demo lesson (content)
INSERT INTO content (id, user_id, title, status, simplified_text)
VALUES (1, 2, 'The Water Cycle', 'READY',
  '{"lesson":{"title":"The Water Cycle","sections":[{"header":"How Water Moves","content":"Water moves around the Earth. The sun heats it and turns it into vapor."},{"header":"Clouds Form","content":"Vapor rises and makes clouds. When clouds get heavy, rain falls."},{"header":"The Cycle Continues","content":"The water flows back to rivers and oceans. Then the cycle repeats."}],"terms":[{"term":"Evaporation","definition":"When heat turns water into invisible vapor."},{"term":"Condensation","definition":"When vapor cools and forms water droplets."},{"term":"Precipitation","definition":"Water falling from clouds as rain or snow."}]},"quiz":{"questions":[{"question":"What starts the water cycle?","options":[{"text":"The sun heats water","isCorrect":true},{"text":"Rain falls","isCorrect":false},{"text":"Clouds form","isCorrect":false},{"text":"Water flows","isCorrect":false}]},{"question":"What do water droplets form in the sky?","options":[{"text":"Rain","isCorrect":false},{"text":"Clouds","isCorrect":true},{"text":"Vapor","isCorrect":false},{"text":"Ice","isCorrect":false}]}]}}')
ON CONFLICT DO NOTHING;

SELECT setval(pg_get_serial_sequence('content', 'id'), GREATEST(nextval(pg_get_serial_sequence('content', 'id')), 10));
