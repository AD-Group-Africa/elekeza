# DATABASE RESULTS — Health Report (2026-10-02)

DB: PostgreSQL 15 `elekeza_chain_scratch` @ :5433 · schema at Flyway **V16** · 60 tables.

## Migrations

- V1–V16 all applied cleanly (`flyway_schema_history` 16 rows, all success).
- V2 demo seed gated per-INSERT by `demoSeedEnabled` placeholder (OFF in prod).
- Hibernate `ddl-auto=validate` in prod — schema owned by Flyway only.

## Integrity checks (live queries today)

| Check | Result |
|---|---|
| Orphan guardian_links (user missing) | **0** |
| Orphan quiz_attempts (user missing) | **0** |
| Orphan attendance_records (learner/session missing) | **0** |
| Orphan lesson_progress (user missing) | **0** |
| Orphan content (owner missing) | **0** |
| Duplicate user emails (case-insensitive) | **0** |
| Refresh tokens for deleted users | **0** |
| STUDENT rows without institution (isolation) | **0** |
| Class↔learner institution mismatch | **0** |
| Soft deletion | not used (hard delete + FK constraints); acceptable for pilot scope |
| Timestamps | created_at/updated_at present on core tables (verified across users, content, quiz_attempts, attendance, notifications) |

## Backup & restore

- `scripts/db-backup.sh` → custom-format dump, **verified** (224 KB, 116 table definitions).
- `scripts/db-restore-drill.sh` → **PASSED today**: restored into disposable DB `elekeza_restore_drill`,
  core-table row counts + `flyway_migrations=16` verified, drill DB dropped. Command:
  `PGPASSWORD=... scripts/db-restore-drill.sh backups/<name>.dump`
- Backup retained: `backups/pilot-acceptance-pre-restore.dump` (pre-restore state).

## Pilot-acceptance data created today (scratch DB, throwaway credentials)

Institutions 3–9 ("Pilot Acceptance Academy …"), staff OTP accounts, imported learners
(zawadi.pilot.s*@elekeza.school), guardians with links, AI-generated content ids 14–17,
AI-generated quizzes 7–9 (2–5 questions each), completed attempts + answers, notifications.
All in the scratch DB only — safe to keep or wipe; demo seed data untouched.

## School isolation

Single-source-of-truth verified: institution_id present on users/classes/content paths;
object-level checks enforced in service layer (cross-tenant probes all 403). No duplicate
ERP/Learn data stores exist — one PostgreSQL, one schema.
