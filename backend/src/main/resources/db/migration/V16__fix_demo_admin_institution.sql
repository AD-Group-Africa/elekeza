-- ============================================================================
-- ELEKEZA — V16: give the demo admin users an institution
-- ----------------------------------------------------------------------------
-- Audit EL-F-001: the V2 demo seed created SCHOOL_ADMIN/ADMIN users with
-- institution_id = NULL, so every institution-scoped admin surface (staff,
-- finance, billing, devices) was unusable for the demo tenant — the admin
-- journey blocked at the first data surface.
--
-- Fresh seeds: V2 could also be fixed, but editing an applied migration
-- changes its Flyway checksum and breaks existing databases (see the note in
-- V2 itself), so this standalone migration repairs all environments that
-- already ran V2. Guarded by the same demoSeedEnabled gate as the V2 seed so
-- production databases (seed off) are untouched.
-- ============================================================================
UPDATE users
SET institution_id = (SELECT id FROM institutions WHERE id = 1)
WHERE email IN ('admin@elekeza.app', 'superadmin@elekeza.app')
  AND institution_id IS NULL
  AND UPPER('${demoSeedEnabled}') = 'TRUE';
