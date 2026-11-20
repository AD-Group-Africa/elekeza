# DATABASE BACKUP & RESTORE RUNBOOK

**Scope:** the Elekeza PostgreSQL database used by the Kotlin/Spring backend (Flyway-managed, 21 migrations).
**Owner:** Harrison (infrastructure) with engineering on-call. **Last drill:** 2026-11-20, PostgreSQL 16.16.

This runbook is written so that someone who has never restored Elekeza can do it under pressure. Commands are
literal; substitute only the values in `<>`.

---

## 1. What "recovered" means

A restore is only complete when all five are true:

1. `flyway_schema_history` shows **21 rows, all `success = t`**, and the newest version is 21.
2. Table/constraint/index counts match the source (§5 checklist).
3. A known guardian→learner link survives (`parent@elekeza.app` → `student@elekeza.app` in the demo dataset).
4. The application boots against the restored database and `/actuator/health` is `UP`.
5. A login as a seeded account succeeds — proving the `users` rows and bcrypt hashes are intact.

A dump file that exists is not a restore. Step 5 is the one people skip.

---

## 2. Backup

### 2.1 Manual logical backup (always works)

```bash
export MSYS_NO_PATHCONV=1          # Git Bash on Windows mangles /var/lib/... paths otherwise

pg_dump --format=custom --no-owner --no-privileges \
  --file="backups/<YYYY-MM-DD>-elekeza.pgdump" \
  "<postgresql://USER:PASSWORD@HOST:5432/DBNAME>"

# Prove it is readable before trusting it:
pg_restore --list "backups/<YYYY-MM-DD>-elekeza.pgdump" | head
```

Expected size for the seeded pilot dataset: **~216 KB** (2 s). A dump of 0 bytes or a `pg_restore --list`
failure means the backup did not happen.

### 2.2 Managed-host automated backups

On Render (or any managed provider) enable **daily automated backups + point-in-time recovery** for the
instance. **[A]** Render's paid PostgreSQL plans include daily backups; confirm the retention window in the
dashboard when the instance is created and record it here:

| Provider | Plan | Retention | PITR | Verified on |
|---|---|---|---|---|
| _(to be filled at provisioning)_ | | | | |

**[R]** Before any pilot data exists, take one manual dump *and* restore it (§3) — an untested automated
backup is a hope, not a backup.

### 2.3 What must never be in a backup artifact

Backups contain learner PII. Store them encrypted at rest, never in the git repository, never in a shared
drive, and never attached to a ticket. `.gitignore` already excludes `*.pgdump` and `backups/` is local-only
(**[O]** verify with `git check-ignore -v backups/` before committing anything near it).

---

## 3. Restore — full procedure

### 3.1 Into a clean database (the drill, and the correct production recovery path)

```bash
createdb -h <host> -U <user> elekeza_restore

pg_restore --no-owner --no-privileges --dbname="<postgresql://USER:PASSWORD@HOST:5432/elekeza_restore>" \
  "backups/<date>-elekeza.pgdump"
echo "restore exit=$?"
```

Measured on 2026-11-20: **9–11 s** for the seeded dataset, exit 0.

> **Do not** restore over a live database with `--clean` while the backend is running. Stop the service
> first, or restore into a new database and repoint `DB_URL`.

### 3.2 Bring the schema under Flyway control

A restored dump already contains `flyway_schema_history`, so Flyway must agree with it, not re-apply it:

```bash
java -jar backend/build/libs/elekeza-backend-0.0.1-SNAPSHOT.jar \
  --spring.profiles.active=prod \
  --spring.datasource.url="jdbc:postgresql://<host>:5432/elekeza_restore"
```

On boot Flyway validates (it will refuse to start on a checksum mismatch — that is correct, do not override
`validate-on-migrate`). Successful boot logs:

```
Successfully applied 21 migrations ... 4.774 s      # clean database
Schema "public" is up to date. No migration necessary.   # restored database
```

Measured on 2026-11-20 (clean database): **21/21 migrations in 4.774 s**.

### 3.3 Rebuild a schema from scratch (no dump, migrations only)

Only valid when the data is disposable (staging, demo):

```bash
createdb -h <host> -U <user> elekeza_fresh
# Boot the jar against elekeza_fresh with the prod/dev profile; Flyway creates all 21 versions.
```

The seeding behaviour differs by profile and this matters:

| Profile | Seeding | Learner data? |
|---|---|---|
| `dev` | `DataInitializer` / `AttendanceFinanceSeed` (`@Profile("dev")`) | Synthetic demo users only |
| `prod` + `DEMO_SEED_ENABLED=FALSE` (default) | `V2__seed_demo.sql` runs with `demoSeedEnabled` = FALSE → **0 rows** | None |
| `prod` + `DEMO_SEED_ENABLED=TRUE` | Demo dataset inserted | Synthetic, but **`DemoSeedGuard` refuses to start outside dev/test** — this is intended, not a bug |

> Restoring a demo dataset by hand requires the Flyway placeholder to be substituted, e.g.
> `sed -e 's/${demoSeedEnabled}/TRUE/g' V2__seed_demo.sql | psql`. Without it you get **0 rows** and a
> "why is the app empty" hour.

---

## 4. Verification checklist (run after every restore)

```sql
-- 1. migrations
SELECT count(*) AS versions, max(version) AS newest FROM flyway_schema_history WHERE success;
-- expect: 21 | 21

-- 2. structural parity (compare source vs restore; all four must match)
SELECT count(*) FROM information_schema.tables      WHERE table_schema='public';   -- 62
SELECT count(*) FROM information_schema.table_constraints WHERE constraint_schema='public'; -- 592
SELECT count(*) FROM information_schema.referential_constraints;                   -- 93
SELECT count(*) FROM pg_indexes WHERE schemaname='public';                         -- 183

-- 3. data presence (expect 1 | 5 | 1 for the demo dataset)
SELECT (SELECT count(*) FROM institutions), (SELECT count(*) FROM users), (SELECT count(*) FROM guardian_links);

-- 4. the relationship that proves tenant wiring survived
SELECT g.email AS guardian, l.email AS learner
FROM guardian_links gl
JOIN users g ON g.id = gl.guardian_user_id
JOIN users l ON l.id = gl.learner_user_id;
-- expect: parent@elekeza.app | student@elekeza.app
```

Measured 2026-11-20: **62 tables / 592 constraints / 93 FKs / 183 indexes**, rows **1 / 5 / 1**, link intact.

Then the application-level check:

```bash
curl -fsS https://<host>/actuator/health          # {"status":"UP"}
# and one real login through the UI or:
curl -fsS -X POST https://<host>/api/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"<seeded-user>","password":"<seeded-password>"}' -c cookies.txt
```

---

## 5. Tenant isolation after recovery

Restoring must not weaken isolation. Two checks, both cheap:

1. **Scoping survives data movement.** Log in as the SCHOOL_ADMIN of institution A and request a
   learner/class/attendance record belonging to institution B → expect **403/404**, never 200 with data.
   Covered automatically by `MultiTenantAuthorizationTest` and the role-guard E2E specs, but re-run one
   manual check against the *restored* database, because RLS/application scoping depends on `institution_id`
   values that a partial restore can null out.
2. **Orphan scan.** `SELECT count(*) FROM users WHERE institution_id IS NULL AND role <> 'ADMIN';`
   A non-zero count after a restore means institution rows were lost — investigate before serving traffic.

---

## 6. Recovery time / recovery point

| Metric | Measured / assumed | Note |
|---|---|---|
| Dump time (seeded dataset) | ~2 s | grows with data |
| Restore time (seeded dataset) | 9–11 s | grows with data |
| Migration time (clean DB) | 4.774 s | 21 migrations |
| Practical RTO for pilot scale | **< 30 min** | dominated by host provisioning, not data |
| RPO with daily backups | up to 24 h | unacceptable for a live pilot with fees — enable PITR |
| RPO with PITR | minutes | required before real learner/fee data |

**[R]** Do not run a pilot with real fee records on daily-backup-only RPO.

---

## 7. Failure drills

| Scenario | Expected behaviour | How to verify |
|---|---|---|
| Database unreachable at boot | App fails fast; `/actuator/health` never returns UP | Stop the container, boot the jar, read the Hikari/Flyway error |
| Database dies while running | Requests fail with 5xx; `GlobalExceptionHandler` returns a generic body (no stack trace) | `docker stop` the DB mid-suite; confirm no stack trace in the HTTP body |
| Wrong password / revoked user | Restore into a fresh DB, rotate the credential, repoint `DB_URL` | — |
| Accidental data mutation | PITR to a timestamp before the mutation, verify with §4 | — |
| Flyway checksum mismatch | Startup aborts (by design) | Restore the matching dump; never set `validate-on-migrate: false` |

---

## 8. Drill record

| Date | PostgreSQL | Migrations | Dump | Restore | Schema parity | Row parity | Result |
|---|---|---|---|---|---|---|---|
| 2026-11-20 | 16.16 | 21/21 in 4.774 s | 216 KB, 2 s | 9–11 s, exit 0 | 62/592/93/183 | 1/5/1 | **PASS** |

Artifacts: `backups/consolidation-2026-11-19/drill-backup.pgdump`,
`drill-backup-seeded.pgdump`, script `scripts/db-restore-drill.sh`. **[O]** The script's `flywayMigrate`
Gradle branch does not exist in this project and falls back to `psql`; the drill above was executed by booting
the built jar, which is the path that mirrors production.
