-- =============================================================
-- V14__seed_test_accounts.sql
-- Elekeza — Test account seed for MasterCard / iHub review
--
-- Flyway placement: backend/src/main/resources/db/migration/
-- Runs automatically on next ./gradlew bootRun
--
-- Passwords (BCrypt cost=10, Spring Security compatible):
--   Elekeza2025!  →  mc.admin, ihub.admin, demo.learner
--   Test1234!     →  test (fallback)
--
-- To run manually instead:
--   psql -U <user> -d elekeza_db -f V14__seed_test_accounts.sql
-- =============================================================

-- ── Assumptions (adjust column names to match your User.kt entity) ──────────
-- Table  : users
-- Columns: id (UUID), email, password_hash, role (UserRole enum as text),
--          enabled, created_at, updated_at
--
-- If your User.kt uses different column names, find/replace below:
--   password_hash  → password  (if Spring names it 'password')
--   role           → user_role (if you used @Column(name="user_role"))
-- ────────────────────────────────────────────────────────────────────────────

BEGIN;

-- Guard: skip if test accounts already exist (safe to re-run)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM users WHERE email IN (
            'mc.admin@elekeza.app',
            'ihub.admin@elekeza.app',
            'demo.learner@elekeza.app',
            'test@elekeza.app'
        )
    ) THEN
        RAISE NOTICE 'Elekeza test accounts already exist — skipping seed.';
        RETURN;
END IF;
END
$$;

-- ── 1. MasterCard Admin ──────────────────────────────────────────────────────
INSERT INTO users (
    id,
    email,
    password_hash,
    role,
    enabled,
    created_at,
    updated_at
)
SELECT
    gen_random_uuid(),
    'mc.admin@elekeza.app',
    '$2b$10$Vqvi4zKHpQ58vgoyM2E3zuqNsu93OU3eG7vnR8HgHWGIfCLcVmav2',
    'ADMIN',
    true,
    NOW(),
    NOW()
    WHERE NOT EXISTS (
    SELECT 1 FROM users WHERE email = 'mc.admin@elekeza.app'
);

-- ── 2. iHub Admin ────────────────────────────────────────────────────────────
INSERT INTO users (
    id,
    email,
    password_hash,
    role,
    enabled,
    created_at,
    updated_at
)
SELECT
    gen_random_uuid(),
    'ihub.admin@elekeza.app',
    '$2b$10$Vqvi4zKHpQ58vgoyM2E3zuqNsu93OU3eG7vnR8HgHWGIfCLcVmav2',
    'ADMIN',
    true,
    NOW(),
    NOW()
    WHERE NOT EXISTS (
    SELECT 1 FROM users WHERE email = 'ihub.admin@elekeza.app'
);

-- ── 3. Demo Learner ──────────────────────────────────────────────────────────
INSERT INTO users (
    id,
    email,
    password_hash,
    role,
    enabled,
    created_at,
    updated_at
)
SELECT
    gen_random_uuid(),
    'demo.learner@elekeza.app',
    '$2b$10$Vqvi4zKHpQ58vgoyM2E3zuqNsu93OU3eG7vnR8HgHWGIfCLcVmav2',
    'LEARNER',
    true,
    NOW(),
    NOW()
    WHERE NOT EXISTS (
    SELECT 1 FROM users WHERE email = 'demo.learner@elekeza.app'
);

-- ── 4. Fallback test account ─────────────────────────────────────────────────
INSERT INTO users (
    id,
    email,
    password_hash,
    role,
    enabled,
    created_at,
    updated_at
)
SELECT
    gen_random_uuid(),
    'test@elekeza.app',
    '$2b$10$tJMJQREHI6w5nKQdkC9GuOlTOaIonSuHS3ZJZs5QsW/wFBnLvMa1S',
    'ADMIN',
    true,
    NOW(),
    NOW()
    WHERE NOT EXISTS (
    SELECT 1 FROM users WHERE email = 'test@elekeza.app'
);

-- ── Seed learner profile for demo.learner ────────────────────────────────────
-- Links to the learners table if your LearnerProfile entity is separate.
-- Remove this block if learner profile is created on first login instead.
INSERT INTO learners (
    id,
    user_id,
    display_name,
    created_at,
    updated_at
)
SELECT
    gen_random_uuid(),
    u.id,
    'Demo Learner',
    NOW(),
    NOW()
FROM users u
WHERE u.email = 'demo.learner@elekeza.app'
  AND NOT EXISTS (
    SELECT 1 FROM learners l WHERE l.user_id = u.id
);

-- ── Verify inserts ────────────────────────────────────────────────────────────
DO $$
DECLARE
v_count INT;
BEGIN
SELECT COUNT(*) INTO v_count
FROM users
WHERE email IN (
                'mc.admin@elekeza.app',
                'ihub.admin@elekeza.app',
                'demo.learner@elekeza.app',
                'test@elekeza.app'
    );

RAISE NOTICE '✓ Elekeza test accounts in DB: % / 4', v_count;
END
$$;

COMMIT;
