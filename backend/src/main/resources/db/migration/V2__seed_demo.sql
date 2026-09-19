-- ============================================================================
-- ELEKEZA — V2 pilot demo seed
-- ----------------------------------------------------------------------------
-- DEMO-ONLY data for the v1.0.0 pilot. Passwords below are for demo accounts
-- ONLY (student123 / teacher123 / parent123) and must never be used as real
-- production credentials. Remove this migration (or these inserts) before a
-- fully public production launch if demo accounts are not desired.
-- ============================================================================

-- ─── Demo institution ────────────────────────────────────────────────────────
INSERT INTO institutions (id, name, type, sub_county, county, plan, max_students, max_teachers, contact_email, is_active) VALUES
    (1, 'Demo Academy', 'SCHOOL', 'Central', 'Nairobi', 'STARTER', 500, 20, 'admin@elekeza.app', TRUE);

-- ─── Demo users ──────────────────────────────────────────────────────────────
-- teacher and student belong to the demo institution so institution-scoped
-- analytics (teacher dashboards, per-question results) work out of the box.
INSERT INTO users (id, email, password, name, role, institution_id, created_at, updated_at) VALUES
    (1, 'student@elekeza.app',    '$2b$10$jTpva6I8xvemm7CiwpbER.pzRiwCcMkCZkVPg4AVtan25OQWaodsm', 'Juma Ali',      'STUDENT',      1, NOW(), NOW()),
    (2, 'teacher@elekeza.app',    '$2b$10$bxug5LMJLTn5Deu4JNoEneIwGPeIPsUXxuI53791MquR4xXwnYK3S', 'Alice Mwalimu', 'TEACHER',      1, NOW(), NOW()),
    (3, 'parent@elekeza.app',     '$2b$10$RXwyomqcdZIUAk42SURm2.eMkJUPE4MgHRE5HTqy4L4cFLXjMEcuC', 'Fatima Ali',    'GUARDIAN',     NULL, NOW(), NOW()),
    (4, 'admin@elekeza.app',      '$2b$10$2ytuUPazbzjwK9U1cSKuNOmHE9Dbl55nm6vYzz/FkkMhIG7uGOpjm', 'Demo School Admin', 'SCHOOL_ADMIN', NULL, NOW(), NOW()),
    (5, 'superadmin@elekeza.app', '$2b$10$xlbUJ5f4M7kMehYj8mXpsOIvKw2tq1tPgnRX4caTKqDkL/x9c.eWa', 'Demo Super Admin', 'ADMIN',        NULL, NOW(), NOW());

-- Guardian link: parent (3) -> learner (1)
INSERT INTO guardian_links (id, guardian_id, learner_id, relationship, is_active, created_at) VALUES
    (1, 3, 1, 'PARENT', TRUE, NOW());

-- ─── Demo lesson content (owned by the teacher) ──────────────────────────────
-- simplified_text stores the AI-contract lesson JSON plus a legacy-format quiz
-- (options with isCorrect flags) that the backend quiz engine parses on start.
INSERT INTO content (id, user_id, title, status, word_count, simplified_text, created_at, updated_at) VALUES
    (1, 2, 'The Water Cycle', 'READY', 89,
     '{"lesson":{"title":"The Water Cycle","sections":[{"heading":"How Water Moves","body":"Water moves around the Earth. The sun heats it and turns it into vapor."},{"heading":"Clouds Form","body":"Vapor rises and makes clouds. When clouds get heavy, rain falls."},{"heading":"The Cycle Continues","body":"The water flows back to rivers and oceans. Then the cycle repeats."}],"key_terms":[{"term":"Evaporation","definition":"When heat turns water into invisible vapor."},{"term":"Condensation","definition":"When vapor cools and forms water droplets."},{"term":"Precipitation","definition":"Water falling from clouds as rain or snow."}]},"quiz":{"questions":[{"question":"What starts the water cycle?","options":[{"text":"The sun heats water","isCorrect":true},{"text":"Rain falls","isCorrect":false},{"text":"Clouds form","isCorrect":false},{"text":"Water flows","isCorrect":false}]},{"question":"What do water droplets form in the sky?","options":[{"text":"Rain","isCorrect":false},{"text":"Clouds","isCorrect":true},{"text":"Vapor","isCorrect":false},{"text":"Ice","isCorrect":false}]}]}}',
     NOW(), NOW());

-- ─── Demo quiz + questions (seeded so the demo quiz is ready immediately) ────
INSERT INTO quizzes (id, content_id, user_id, created_at) VALUES (1, 1, 2, NOW());

INSERT INTO quiz_questions (id, quiz_id, question, option_a, option_b, option_c, option_d, correct_option, explanation) VALUES
    (1, 1, 'What starts the water cycle?',            'The sun heats water', 'Rain falls', 'Clouds form', 'Water flows', 'A', 'The sun''s heat turns water into vapor, which starts the cycle.'),
    (2, 1, 'What do water droplets form in the sky?', 'Rain',                'Clouds',     'Vapor',       'Ice',        'B', 'Vapor rises and cools into droplets that make clouds.');

-- ─── Demo assignment: student has the lesson + a quiz attempt record ─────────
INSERT INTO lesson_progress (id, user_id, content_id, quiz_score, completed, created_at) VALUES
    (1, 1, 1, NULL, FALSE, NOW());

-- ─── Advance BIGSERIAL sequences past the explicitly-inserted ids ───────────
SELECT setval('institutions_id_seq',     1, true);
SELECT setval('users_id_seq',             5, true);
SELECT setval('guardian_links_id_seq',    1, true);
SELECT setval('content_id_seq',           1, true);
SELECT setval('quizzes_id_seq',           1, true);
SELECT setval('quiz_questions_id_seq',    2, true);
SELECT setval('lesson_progress_id_seq',   1, true);
