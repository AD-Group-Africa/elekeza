-- ============================================================================
-- V20 staging verification — synthetic fixtures (elekeza_v20_upgrade)
-- ----------------------------------------------------------------------------
-- Applied at schema **v19**, i.e. BEFORE V20 runs, so the deadline rows here
-- are genuine "legacy" rows: they cannot carry a county because the column
-- does not exist yet. After V20 they must still be NULL — that is the
-- no-backfill guarantee under test.
--
-- All identities are synthetic and clearly namespaced (v20.*@staging.local).
-- No real learner or guardian data is present. Passwords reuse the committed
-- demo hash for `student123`; they are throwaway local fixtures.
-- ============================================================================

BEGIN;

INSERT INTO institutions (name, county) VALUES
    ('V20 Nairobi Academy',    'Nairobi'),
    ('V20 Kisumu Academy',     'Kisumu'),
    ('V20 No County Academy',  NULL);

-- 1001 platform operator; 1002..1005 guardians; 1006..1008 learners
INSERT INTO users (id, email, password, name, role, institution_id, created_at, updated_at, active) VALUES
    (1001, 'v20.admin@staging.local',              '$2b$10$jTpva6I8xvemm7CiwpbER.pzRiwCcMkCZkVPg4AVtan25OQWaodsm', 'V20 Admin',               'ADMIN',    NULL, now(), now(), true),
    (1002, 'v20.nairobi.guardian@staging.local',   '$2b$10$jTpva6I8xvemm7CiwpbER.pzRiwCcMkCZkVPg4AVtan25OQWaodsm', 'V20 Nairobi Guardian',    'GUARDIAN', NULL, now(), now(), true),
    (1003, 'v20.twocounty.guardian@staging.local', '$2b$10$jTpva6I8xvemm7CiwpbER.pzRiwCcMkCZkVPg4AVtan25OQWaodsm', 'V20 Two County Guardian', 'GUARDIAN', NULL, now(), now(), true),
    (1004, 'v20.revoked.guardian@staging.local',   '$2b$10$jTpva6I8xvemm7CiwpbER.pzRiwCcMkCZkVPg4AVtan25OQWaodsm', 'V20 Revoked Guardian',    'GUARDIAN', NULL, now(), now(), true),
    (1005, 'v20.expired.guardian@staging.local',   '$2b$10$jTpva6I8xvemm7CiwpbER.pzRiwCcMkCZkVPg4AVtan25OQWaodsm', 'V20 Expired Guardian',    'GUARDIAN', NULL, now(), now(), true),
    (1006, 'v20.ward.nairobi@staging.local',       '$2b$10$jTpva6I8xvemm7CiwpbER.pzRiwCcMkCZkVPg4AVtan25OQWaodsm', 'V20 Ward Nairobi',        'STUDENT',  (SELECT id FROM institutions WHERE name = 'V20 Nairobi Academy'),   now(), now(), true),
    (1007, 'v20.ward.kisumu@staging.local',        '$2b$10$jTpva6I8xvemm7CiwpbER.pzRiwCcMkCZkVPg4AVtan25OQWaodsm', 'V20 Ward Kisumu',         'STUDENT',  (SELECT id FROM institutions WHERE name = 'V20 Kisumu Academy'),    now(), now(), true),
    (1008, 'v20.ward.nocounty@staging.local',      '$2b$10$jTpva6I8xvemm7CiwpbER.pzRiwCcMkCZkVPg4AVtan25OQWaodsm', 'V20 Ward No County',      'STUDENT',  (SELECT id FROM institutions WHERE name = 'V20 No County Academy'), now(), now(), true);

SELECT setval(pg_get_serial_sequence('users', 'id'), 1100, true);

INSERT INTO guardian_links (id, guardian_id, learner_id, relationship, is_active, created_at, expires_at, revoked_at) VALUES
    (2001, 1002, 1006, 'PARENT', true, now(), NULL, NULL),
    (2002, 1003, 1006, 'PARENT', true, now(), NULL, NULL),
    (2003, 1003, 1007, 'PARENT', true, now(), NULL, NULL),
    (2004, 1004, 1006, 'PARENT', true, now(), NULL, now() - interval '1 hour'),        -- revoked
    (2005, 1005, 1006, 'PARENT', true, now(), now() - interval '1 hour', NULL);        -- expired

SELECT setval(pg_get_serial_sequence('guardian_links', 'id'), 2100, true);

-- Legacy school dates. No county_code column exists at v19.
INSERT INTO deadlines (id, institution_id, user_id, title, deadline_type, scope, due_at, description, created_by, created_at) VALUES
    (3001, NULL, NULL, 'V20 legacy national',            'SCHOOL_EVENT', 'NATIONAL',    now() + interval '3 days', 'legacy', 1001, now()),
    (3002, NULL, NULL, 'V20 legacy regional uncoded A',  'SCHOOL_EVENT', 'REGIONAL',    now() + interval '3 days', 'legacy', 1001, now()),
    (3003, NULL, NULL, 'V20 legacy regional uncoded B',  'SCHOOL_EVENT', 'REGIONAL',    now() + interval '4 days', 'legacy', 1001, now()),
    (3004, (SELECT id FROM institutions WHERE name = 'V20 Nairobi Academy'), NULL,
          'V20 legacy institution Nairobi',              'SCHOOL_EVENT', 'INSTITUTION', now() + interval '5 days', 'legacy', 1001, now());

SELECT setval(pg_get_serial_sequence('deadlines', 'id'), 3100, true);

COMMIT;
