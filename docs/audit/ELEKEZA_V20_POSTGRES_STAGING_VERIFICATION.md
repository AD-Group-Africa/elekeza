# ELEKEZA — V20 PostgreSQL Staging Migration Verification

**Date:** 14 November 2026
**Migration:** `V20__deadline_county_scope.sql`
**Branch:** `sprint-3-safe-config` @ `47d17f5` (nothing committed, pushed or deployed)
**Overall verdict:** **MIGRATION PASSED on PostgreSQL 15** — applied in-place through Flyway, application boots against the migrated schema, county-visibility contract verified with 37/37 PostgreSQL-backed assertions.
**Delivery gate:** **BLOCKED** — `scripts/staging-gate.sh` cannot pass for reasons unrelated to V20 (§9.1). No workaround was applied.

---

## 1. Verified environment identity

| Attribute | Value | How established |
|---|---|---|
| Engine | PostgreSQL 15.17 (Visual C++ build 1944, 64-bit) | `select version()` |
| Host / port | `localhost:5433` | `netstat` listener + successful connection |
| Data directory | `C:/Program Files/PostgreSQL/15/data` | `show data_directory` |
| Cluster role | **Shared local developer cluster** — 28 databases belonging to unrelated projects (`cliniq`, `mwananchi`, `traq`, `trustmark`, `pcea`, …) | `pg_database` listing |
| Target database | `elekeza_v20_upgrade` (created for this verification) | created by this run, dropped/created explicitly |
| Database state | Schema built by Flyway from V1 in this session, i.e. no inherited content | `flyway_schema_history` |
| Application | Boot JAR, `--spring.profiles.active=prod`, port 8096 | boot log |
| `elekeza_prod` present? | **No** — the database does not exist on this host | `pg_database` lookup |

**Why this target qualifies as staging evidence and not production:** no production database is reachable from this machine (`elekeza_prod` does not exist, and the `prod` profile takes every connection value from environment variables that are unset in this shell). The database used is one this run created itself, contains only synthetic fixtures, and is disposable. The project has **no remote staging host** — its entire staging procedure is the local gate in `scripts/staging-gate.sh`, which creates its own throwaway database. No credential, connection string or secret is reproduced in this report.

---

## 2. Backup / snapshot evidence

| Item | Value |
|---|---|
| Backup file | `backups/elekeza_v20_upgrade-pre-v20.dump` (custom format `-Fc`, 208 KB) |
| Taken at | **2026-11-14T08:38:35Z** (UTC), before V20 was applied |
| Taken at schema version | **v19** (before-state) |
| Verification | `pg_restore --list` succeeded — 118 table definitions listed; a dump that cannot be read is not counted as a backup |
| Schema snapshots | `docs/audit/evidence-v20-schema-before.sql`, `docs/audit/evidence-v20-schema-after.sql` |

`backups/` is git-ignored, so the dump is not part of the working tree.

---

## 3. Flyway state before and after

**Before** (schema at v19, 4 synthetic legacy deadlines present):

| Rank | Version | Description | Success |
|---|---|---|---|
| 19 | 19 | feature flag overrides | true |

**After:**

| Rank | Version | Description | Success | Checksum | Installed | Exec time |
|---|---|---|---|---|---|---|
| 20 | 20 | deadline county scope | **true** | `-1052899281` | `2026-11-14 11:39:06.125114` | 30 ms |

- `select count(*) from flyway_schema_history where success = false` → **0**.
- Flyway validation on boot: `Successfully validated 20 migrations`.
- V20 was **pending** before the run (no V20 row existed, `county_code` absent) and no conflicting migration existed.
- No `flyway repair` was run, and nothing about Flyway history was edited.

---

## 4. Migration command and outcome

Executed through the project's own mechanism — Flyway embedded in the Spring Boot boot JAR on the `prod` profile — not by hand-running SQL:

```
java -jar backend/build/libs/elekeza-backend-0.0.1-SNAPSHOT.jar \
     --spring.profiles.active=prod --server.port=8096
```
with `DB_URL` / `DB_USER` / `DB_PASSWORD` / `JWT_SECRET` / `AI_INTERNAL_SECRET` / `FRONTEND_URL` / `CORS_ALLOWED_ORIGINS` supplied in the process environment, `DEMO_SEED_ENABLED=FALSE`, `SECURE_COOKIES=false` (local http only).

Flyway log (`docs/audit/evidence-v20-app-boot.log`):

```
Successfully validated 20 migrations (execution time 00:00.079s)
Current version of schema "public": 19
Migrating schema "public" to version "20 - deadline county scope"
Successfully applied 1 migration to schema "public", now at version v20 (execution time 00:00.030s)
Started ElekezaApplicationKt in 26.183 seconds
```

**Exit code:** not applicable in the usual sense — the JVM was intentionally stopped after verification, so the migration's outcome is evidenced by the log line above plus the `flyway_schema_history` row, not by a process exit status. Stated plainly because it is a weaker signal than an exit code.

For completeness: an earlier attempt used `--spring.main.web-application-type=none` to get a clean exit code; the JVM did not terminate after migrating (a non-daemon thread keeps it alive) and the 240 s tool timeout fired. That run applied V1→V19 correctly and the process was discarded; the web-mode run above replaced it.

---

## 5. PostgreSQL schema verification (read-only)

| Check | Result |
|---|---|
| `deadlines.county_code` exists | ✅ `character varying`, length **64**, `is_nullable = YES`, no default |
| Index `idx_deadline_county` | ✅ `CREATE INDEX idx_deadline_county ON public.deadlines USING btree (county_code)` |
| Column comment | ✅ present, matches V20 |
| Schema diff before → after | ✅ exactly three additions: the column, its comment, its index — **nothing else** |
| Public tables before/after | 59 → 59 |
| Existing deadline rows | ✅ 4 → 4, unchanged (1 NATIONAL, 2 REGIONAL, 1 INSTITUTION) |
| Existing REGIONAL rows given an invented county | ✅ **0** — both legacy REGIONAL rows are `NULL` after migration |
| Unrelated tables/rows touched | ✅ none |

```
3001 | NATIONAL    | county_code=<NULL> | V20 legacy national
3002 | REGIONAL    | county_code=<NULL> | V20 legacy regional uncoded A
3003 | REGIONAL    | county_code=<NULL> | V20 legacy regional uncoded B
3004 | INSTITUTION | county_code=<NULL> | V20 legacy institution Nairobi
```

The `\restrict` lines that appear in the raw diff are pg_dump 15 random tokens and carry no schema meaning.

---

## 6. Existing REGIONAL rows requiring manual county assignment

In the verification database: **3** REGIONAL rows with `county_code IS NULL` (ids 3002, 3003 — the synthetic "legacy" rows inserted pre-V20; id 3103 — created deliberately without a county to prove fail-closed behaviour). All are invisible to every guardian, as designed.

**Production:** unknown, and deliberately not guessed. No production database is reachable from this machine. The census must be run there before closing the release:

```sql
SELECT id, title, due_at, created_by
  FROM deadlines
 WHERE scope = 'REGIONAL' AND county_code IS NULL
 ORDER BY due_at;
```

No automated backfill exists, and none should be added — each row needs a county an administrator can actually attest to.

---

## 7. Application startup and integration results

Application started successfully against the migrated schema (`Started ElekezaApplicationKt in 26.183 seconds`), `/actuator/health` → **200**, Hibernate `ddl-auto=validate` passed against the real PostgreSQL schema (so the entity mapping and the migration agree), and Flyway reported no pending or failed migration.

Contract verification (`docs/audit/v20-api-contract-check.sh`, full output in `docs/audit/evidence-v20-api-contract.log`): **37 assertions, 0 failures, exit 0**.

| Area | Assertions | Result |
|---|---|---|
| Admin login (role `ADMIN`) | 1 | ✅ 200 |
| Create REGIONAL with `"  NAIROBI  County "` | 2 | ✅ 200, persisted `nairobi` |
| Create REGIONAL with `"Kisumu"` | 2 | ✅ 200, persisted `kisumu` |
| Create REGIONAL without county | 2 | ✅ 200, persisted `NULL` (unscoped, hidden) |
| Create NATIONAL / INSTITUTION | 2 | ✅ 200 |
| Blank county rejected | 1 | ✅ 400 |
| County on non-REGIONAL rejected | 1 | ✅ 400 |
| Nairobi guardian: national + own county visible, other county / uncoded / other institution hidden | 12 | ✅ all |
| Two-county guardian: sees both counties + its own institution dates | 5 | ✅ all |
| Revoked link: no ward-linked dates | 3 | ✅ all |
| Expired link: no ward-linked dates | 3 | ✅ all |
| Anonymous 401 / non-guardian 403 | 2 | ✅ both |
| Guardian with a county-less ward gets no regional dates | 1 | ✅ |
| Persisted county codes read back from PostgreSQL | (section 3 of log) | ✅ `nairobi`, `kisumu`, `NULL` exactly as intended |

Both `/api/guardian/schedule` and `/api/deadlines` returned consistent results — they are now driven by the same `DeadlineVisibility` rule.

Fixtures: `docs/audit/v20-staging-fixtures.sql` — synthetic only (`v20.*@staging.local`), three institutions (Nairobi / Kisumu / no county), eight users, five links including one revoked and one expired. **No real learner or guardian data was imported.**

---

## 8. Test results and actual exit codes

| Command | Result |
|---|---|
| `scripts/staging-gate.sh --keep-db` | **exit 1** — see §9.1. Flyway portion succeeded: `Successfully applied 20 migrations … now at version v20` |
| `./gradlew test --tests DeadlineCountyMigrationTest --tests RegionalCountyVisibilityTest --tests GuardianSchoolDatesTest --tests DeadlineAuthorizationTest --tests GuardianDeadlineLinkLifecycleTest --tests GuardianLinkLifecycleTest` | **39 tests, 0 failures, 0 errors, exit 0** (1m 07s) |
| ↳ `RegionalCountyVisibilityTest` | 16 tests, 0 failures |
| ↳ `DeadlineAuthorizationTest` | 11 tests, 0 failures |
| ↳ `GuardianDeadlineLinkLifecycleTest` | 4 tests, 0 failures |
| ↳ `GuardianLinkLifecycleTest` | 4 tests, 0 failures |
| ↳ `GuardianSchoolDatesTest` | 3 tests, 0 failures |
| ↳ `DeadlineCountyMigrationTest` | 1 test, 0 failures |
| `docs/audit/v20-api-contract-check.sh` (live PostgreSQL) | **37 passed, 0 failed, exit 0** |

The full backend suite (385 tests / 58 classes) was **not** re-run in this session: no production source changed here, only additions under `docs/audit/` and the database. Its last result stands as recorded in `ELEKEZA_REGIONAL_SCHOOL_DATES_REGRESSION_REVIEW.md` §13.6.

---

## 9. Remaining blockers and risks

### 9.1 BLOCKER — `scripts/staging-gate.sh` cannot pass (pre-existing, not caused by V20)

The gate sets `DEMO_SEED_ENABLED=true` and boots the `prod` profile. Wave 0's `DemoSeedGuard` now refuses exactly that combination:

```
java.lang.IllegalStateException: Refusing to start: demo seeding is ENABLED
(spring.flyway.placeholders.demoSeedEnabled=true) but the active profiles [prod]
do not include one of [dev, test].
```

So the gate dies at step 4 **after** Flyway has already applied all 20 migrations (`evidence-v20-gate-run1.log`). The gate has not been updated for Wave 0's security change, and repairing it means deciding a product/security question (how a local prod-profile gate obtains a smoke-test account now that demo credentials are forbidden outside dev/test). That decision is out of scope for a migration-verification task and requires approval — it was **not** worked around by weakening the guard or by hand-loading credentials.

### 9.2 The gate's migration assertion is stale

`grep -q "Successfully applied 15 migrations"` is hard-coded to a count that changed as migrations were added; the repository now has **20** migration files. Once the boot is unblocked, this assertion fails on any migration addition. It should assert the applied version (e.g. `now at version v20`) rather than a total, otherwise every future migration breaks the gate for the wrong reason.

### 9.3 No remote staging environment exists

The only PostgreSQL available is a shared local developer cluster. Everything in this report is local-Cluster evidence. A hosted staging host — ideally PostgreSQL 16, matching `docker-compose.yml` — has never been exercised for V20.

### 9.4 Target version mismatch

V20 was verified on **PostgreSQL 15.17**; `docker-compose.yml` and the pilot deployment target **PostgreSQL 16 (alpine)**. V20 uses only `ALTER TABLE … ADD COLUMN`, `COMMENT ON COLUMN` and `CREATE INDEX`, which are stable across both, but PG16 is unverified.

### 9.5 Placeholder/checksum coupling (informational)

`V2` and `V16` embed the `demoSeedEnabled` placeholder. A database migrated with the seed placeholder `TRUE` and later validated with `FALSE` may fail checksum validation. This did not affect this verification (the database was created and migrated consistently with `FALSE`), but it matters if the gate's seeded database is ever re-validated under a different seed setting.

### 9.6 Untested by design

The migration's behaviour on a table with **millions** of deadlines was not measured: `ALTER TABLE … ADD COLUMN` without a default plus one btree index is fast but takes a `SHARE`/`SHARE ROW EXCLUSIVE` lock at scale. The verification database held 4 rows.

### 9.7 _Pre-existing, still open_

REG-05 (security + visibility bundled in one working-tree diff) and REG-06 (`ZoneId.systemDefault()` date filtering) remain as recorded in the regression review.

---

## 10. Explicit verdict

**V20 migration: PASS on PostgreSQL 15.** Applied in-place from v19 with Flyway, checksum recorded, no failed history rows, no backfill, no unexpected schema change, existing rows untouched, application booting and passing Hibernate validation against the migrated schema, and the county-visibility contract verified with 37/37 live-PostgreSQL assertions.

**Staging delivery gate: NOT PASSED.** The gate script itself is blocked by a pre-existing Wave 0 conflict (§9.1) and a stale assertion (§9.2), neither of which V20 caused. This is reported rather than bypassed.

**What is still required before production:**

1. Decide and implement the gate's replacement for demo-seeded smoke accounts; then re-run `scripts/staging-gate.sh` to a clean pass.
2. Run V20 once on a real hosted staging database, ideally PostgreSQL 16.
3. Run the §6 census against production and have an administrator assign the correct count for every REGIONAL row found.

---

## Appendix — artifacts

| Artifact | Path |
|---|---|
| Flyway apply log (app boot, v19 → v20) | `docs/audit/evidence-v20-app-boot.log` |
| First gate attempt (Flyway 20/20, then guard refusal) | `docs/audit/evidence-v20-gate-run1.log` |
| V1→V19 build log | `docs/audit/evidence-v20-migrate-to-v19.log` |
| Schema before / after | `docs/audit/evidence-v20-schema-before.sql`, `…-after.sql` |
| API contract script + output | `docs/audit/v20-api-contract-check.sh`, `evidence-v20-api-contract.log` |
| Targeted test output | `docs/audit/evidence-v20-targeted-tests.log` |
| Synthetic fixtures | `docs/audit/v20-staging-fixtures.sql` |
| Backup (git-ignored) | `backups/elekeza_v20_upgrade-pre-v20.dump` |

**Databases left on the cluster** (both disposable, neither dropped automatically): `elekeza_v20_upgrade` (migrated, kept for review) and `elekeza_staging_gate` (kept by the failed gate's `--keep-db`).
