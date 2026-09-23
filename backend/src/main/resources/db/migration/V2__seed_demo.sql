-- ============================================================================
-- ELEKEZA — V2 pilot demo seed
-- ----------------------------------------------------------------------------
-- DEMO-ONLY data for the v1.0.0 pilot. Passwords below are for demo accounts
-- ONLY (student123 / teacher123 / parent123) and must never be used as real
-- production credentials.
--
-- SEED GATE: every INSERT is guarded by `WHERE UPPER('<demoSeedEnabled>') = 'TRUE'`,
-- so the entire demo dataset (institution, users, content, quiz, progress) is
-- inserted only when the Flyway placeholder `demoSeedEnabled` is TRUE.
-- Wiring (see ELEKEZA_README.md §14):
--   * default/dev profiles  -> ON  (application.yaml: demo accounts for local dev,
--                                   backend tests and the E2E suite depend on them)
--   * prod profile          -> OFF (application-prod.yaml: DEMO_SEED_ENABLED, default FALSE)
--   * docker profile        -> OFF (application-docker.yml: DEMO_SEED_ENABLED, default FALSE)
--
-- To run a DEMO deployment, set DEMO_SEED_ENABLED=true in the environment.
-- Never enable it on an internet-facing deployment with a public domain.
--
-- NOTE FOR EXISTING NON-H2 DEV DATABASES: editing this migration changes its
-- Flyway checksum. Any database that already applied the old V2 must run
-- `flyway repair` once (or be recreated); fresh and in-memory databases are
-- unaffected.
-- ============================================================================

-- ─── Demo institution ────────────────────────────────────────────────────────
INSERT INTO institutions (id, name, type, sub_county, county, plan, max_students, max_teachers, contact_email, is_active)
SELECT 1, 'Demo Academy', 'SCHOOL', 'Central', 'Nairobi', 'STARTER', 500, 20, 'admin@elekeza.app', TRUE
WHERE UPPER('${demoSeedEnabled}') = 'TRUE';

-- ─── Demo users ──────────────────────────────────────────────────────────────
-- teacher and student belong to the demo institution so institution-scoped
-- analytics (teacher dashboards, per-question results) work out of the box.
INSERT INTO users (id, email, password, name, role, institution_id, created_at, updated_at)
SELECT * FROM (
    SELECT 1, 'student@elekeza.app',    '$2b$10$jTpva6I8xvemm7CiwpbER.pzRiwCcMkCZkVPg4AVtan25OQWaodsm', 'Juma Ali',      'STUDENT',      CAST(1 AS BIGINT), NOW(), NOW() UNION ALL
    SELECT 2, 'teacher@elekeza.app',    '$2b$10$bxug5LMJLTn5Deu4JNoEneIwGPeIPsUXxuI53791MquR4xXwnYK3S', 'Alice Mwalimu', 'TEACHER',      CAST(1 AS BIGINT), NOW(), NOW() UNION ALL
    SELECT 3, 'parent@elekeza.app',     '$2b$10$RXwyomqcdZIUAk42SURm2.eMkJUPE4MgHRE5HTqy4L4cFLXjMEcuC', 'Fatima Ali',    'GUARDIAN',     CAST(NULL AS BIGINT), NOW(), NOW() UNION ALL
    SELECT 4, 'admin@elekeza.app',      '$2b$10$2ytuUPazbzjwK9U1cSKuNOmHE9Dbl55nm6vYzz/FkkMhIG7uGOpjm', 'Demo School Admin', 'SCHOOL_ADMIN', CAST(NULL AS BIGINT), NOW(), NOW() UNION ALL
    SELECT 5, 'superadmin@elekeza.app', '$2b$10$xlbUJ5f4M7kMehYj8mXpsOIvKw2tq1tPgnRX4caTKqDkL/x9c.eWa', 'Demo Super Admin', 'ADMIN',        CAST(NULL AS BIGINT), NOW(), NOW()
) AS seed_users
WHERE UPPER('${demoSeedEnabled}') = 'TRUE';

-- Guardian link: parent (3) -> learner (1)
INSERT INTO guardian_links (id, guardian_id, learner_id, relationship, is_active, created_at)
SELECT 1, 3, 1, 'PARENT', TRUE, NOW()
WHERE UPPER('${demoSeedEnabled}') = 'TRUE';

-- ─── Demo lesson content (owned by the teacher) ──────────────────────────────
-- simplified_text stores the AI-contract lesson JSON plus a legacy-format quiz
-- (options with isCorrect flags) that the backend quiz engine parses on start.
INSERT INTO content (id, user_id, title, status, word_count, simplified_text, created_at, updated_at)
SELECT 1, 2, 'The Water Cycle', 'READY', 89,
     '{"lesson":{"title":"The Water Cycle","sections":[{"heading":"How Water Moves","body":"Water moves around the Earth. The sun heats it and turns it into vapor."},{"heading":"Clouds Form","body":"Vapor rises and makes clouds. When clouds get heavy, rain falls."},{"heading":"The Cycle Continues","body":"The water flows back to rivers and oceans. Then the cycle repeats."}],"key_terms":[{"term":"Evaporation","definition":"When heat turns water into invisible vapor."},{"term":"Condensation","definition":"When vapor cools and forms water droplets."},{"term":"Precipitation","definition":"Water falling from clouds as rain or snow."}]},"quiz":{"questions":[{"question":"What starts the water cycle?","options":[{"text":"The sun heats water","isCorrect":true},{"text":"Rain falls","isCorrect":false},{"text":"Clouds form","isCorrect":false},{"text":"Water flows","isCorrect":false}]},{"question":"What do water droplets form in the sky?","options":[{"text":"Rain","isCorrect":false},{"text":"Clouds","isCorrect":true},{"text":"Vapor","isCorrect":false},{"text":"Ice","isCorrect":false}]}]}}',
     NOW(), NOW()
WHERE UPPER('${demoSeedEnabled}') = 'TRUE';

-- ─── Demo quiz + questions (seeded so the demo quiz is ready immediately) ────
INSERT INTO quizzes (id, content_id, user_id, created_at)
SELECT 1, 1, 2, NOW()
WHERE UPPER('${demoSeedEnabled}') = 'TRUE';

INSERT INTO quiz_questions (id, quiz_id, question, option_a, option_b, option_c, option_d, correct_option, explanation)
SELECT * FROM (
    SELECT 1, 1, 'What starts the water cycle?',            'The sun heats water', 'Rain falls', 'Clouds form', 'Water flows', 'A', 'The sun''s heat turns water into vapor, which starts the cycle.' UNION ALL
    SELECT 2, 1, 'What do water droplets form in the sky?', 'Rain',                'Clouds',     'Vapor',       'Ice',        'B', 'Vapor rises and cools into droplets that make clouds.'
) AS seed_questions
WHERE UPPER('${demoSeedEnabled}') = 'TRUE';

-- ─── Demo assignment: student has the lesson + a quiz attempt record ─────────
INSERT INTO lesson_progress (id, user_id, content_id, quiz_score, completed, created_at)
SELECT 1, 1, 1, NULL, FALSE, NOW()
WHERE UPPER('${demoSeedEnabled}') = 'TRUE';

-- ─── Advance BIGSERIAL sequences past the explicitly-inserted ids ───────────
-- Harmless when the seed is skipped (fresh DBs keep these positions anyway).
SELECT setval('institutions_id_seq',     1, true);
SELECT setval('users_id_seq',             5, true);
SELECT setval('guardian_links_id_seq',    1, true);
SELECT setval('content_id_seq',           1, true);
SELECT setval('quizzes_id_seq',           1, true);
SELECT setval('quiz_questions_id_seq',    2, true);
SELECT setval('lesson_progress_id_seq',   1, true);
