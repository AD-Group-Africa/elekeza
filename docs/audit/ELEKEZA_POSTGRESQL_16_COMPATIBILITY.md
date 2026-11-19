# ELEKEZA — PostgreSQL 16 Compatibility Verification

**Date:** 15 November 2026
**Branch:** `sprint-3-safe-config` @ `47d17f5` — nothing committed, pushed or deployed.
**Scope:** fresh install, in-place V19→V20 upgrade, application startup, county-visibility contract and the repaired staging gate against a genuine PostgreSQL 16 server.

## Verdict: **CONDITIONAL PASS**

Core compatibility is verified on PostgreSQL 16.16: all 20 migrations apply from empty, V19→V20 upgrades in place without touching existing rows, Hibernate validates against the resulting schema, the application boots and serves, the county contract passes 37/37 on live PostgreSQL 16, and the repaired staging gate passes twice from an absent database.

Conditions attached (§10): the bundled JDBC driver line is not vendor-CI-tested against PostgreSQL 16, Flyway is older than its PostgreSQL 16 certification, the repository's backup script pins PostgreSQL 15 client binaries and **cannot** dump a 16 server, and no scale/performance evidence was produced.

---

## 1. Environment and exact versions

| Component | Version | Notes |
|---|---|---|
| **PostgreSQL server** | **16.16** (x86_64-pc-linux-musl, Alpine build, gcc 15.2.0) | `postgres:16-alpine`, digest `sha256:f377d590e5474681d4d7838635031a2b50647923b7abfa803ce9b5ff35d5c663` |
| Container | `elekeza-pg16`, `--rm` | removed after verification |
| Docker engine | 29.2.1, linux/x86_64 | WSL2 `docker-desktop` distro |
| Extensions | `plpgsql` only | none required by Elekeza |
| Server config | stock image defaults | no tuning, no custom locale |
| Encoding | UTF8 | |
| JDBC driver | **42.6.2** | `BOOT-INF/lib/postgresql-42.6.2.jar` |
| Flyway | **9.22.3** | `flyway-core-9.22.3.jar` (community edition, embedded) |
| Hibernate ORM | **6.4.4.Final** | Spring Boot 3.2.4 |
| HikariCP | 5.0.1 | |
| Java | Temurin 21.0.9 | |
| psql client | 15.17 | connects to a 16 server normally |
| pg_dump / pg_restore | 15.17 **and** 16.16 | see §10.3 — the 15 tools refuse a 16 server |

The shared **PostgreSQL 15 cluster on :5433 was not touched**: it still holds 28 non-template databases, and `cliniq`, `elekeza`, `mwananchi`, `pcea`, `traq`, `trustmark`, `elekeza_v20_upgrade` were verified present before and after.

## 2. Infrastructure and isolation

- Dedicated container from `postgres:16-alpine`, bound to **`127.0.0.1:5434` only** (`-p 127.0.0.1:5434:5432`) — loopback-only, no LAN exposure, and deliberately *not* on the :5433 port used by the shared cluster.
- Three databases created inside it: `elekeza_pg16` (image default), `elekeza_pg16_fresh`, `elekeza_pg16_upgrade`. All synthetic; no real learner, guardian or staff data.
- Application instances used the `prod` profile with `DEMO_SEED_ENABLED=FALSE` and gate-local dummy secrets only.
- Docker Desktop was started for this task and the engine reported 29.2.1 before any database work began.

## 3. Fresh installation results

Database `elekeza_pg16_fresh`, empty schema, boot JAR with `--spring.profiles.active=prod` (Flyway on, `ddl-auto=validate`).

| Check | Result |
|---|---|
| Flyway validation | `Successfully validated 20 migrations` |
| Migrations applied | `Successfully applied 20 migrations to schema "public", now at version v20` (4.747 s) |
| Failed migration rows | **0** |
| Hibernate schema validation | passed (boot completed) |
| Application start | `Started ElekezaApplicationKt in 32.477 seconds` |
| Health | `HTTP 200` |
| `deadlines.county_code` | `character varying`, `NULL`, length **64** |
| `idx_deadline_county` | present (1) |
| Column comment | present |
| Public tables | **59** (identical to the PostgreSQL 15 result) |

Log: `docs/audit/evidence-pg16-fresh-install.log`.

## 4. V19 → V20 upgrade results

Database `elekeza_pg16_upgrade`, staged deliberately at V19 before V20 existed.

| Step | Result |
|---|---|
| Migrate to V19 (`--spring.flyway.target=19`, `ddl-auto=none`) | `Successfully applied 19 migrations … now at version v19` (6.302 s) |
| `county_code` present before upgrade | **no** (verified absent) |
| Legacy fixtures (`docs/audit/v20-staging-fixtures.sql`) | 3 institutions, 8 users, 5 guardian links, **4 deadlines (2 REGIONAL)** |
| Backup | `backups/elekeza_pg16_upgrade-pre-v20.dump`, custom format, **208 KB, 118 table definitions verified**, taken **2026-11-15T06:52:57Z** at v19 |
| Apply V20 | `Migrating schema "public" to version "20 - deadline county scope"` → `Successfully applied 1 migration … now at version v20` (0.186 s) |
| Re-boot at v20 | `Current version of schema "public": 20` → `Schema "public" is up to date. No migration necessary.` |
| Failed migration rows | 0 |
| Legacy REGIONAL rows retaining `NULL` county | **2 of 2** |
| Invented county values | **0** |
| `county_code` type/nullability | `character varying`, `NULL`, 64 |
| `idx_deadline_county` | present |
| Public tables | 59 (unchanged) |

## 5. Schema comparison (before → after)

`pg_dump --schema-only` at v19 versus v20, both taken with the container's own 16.16 tools. The diff contains **exactly** the three intended changes and nothing else:

```sql
county_code character varying(64)                     -- added column, nullable, no default
COMMENT ON COLUMN public.deadlines.county_code IS '…'  -- added comment
CREATE INDEX idx_deadline_county ON public.deadlines USING btree (county_code);
```

No table, constraint, sequence or row was altered. Snapshots: `docs/audit/evidence-pg16-schema-before.sql`, `…-after.sql`.

## 6. Staging gate execution results

The **actual** `scripts/staging-gate.sh` was run, not a substitute. Connection settings are now overridable, so the same script targeted the PostgreSQL 16 container with `GATE_PGPORT=5434 GATE_PGHOST=127.0.0.1`; defaults (5433) are unchanged.

| Run | Start state | Result | Exit | DB after |
|---|---|---|---|---|
| 1 | absent | **PASS** — 20/20 v20, V20 schema verified, register 201, login 200, `/me` 200 STUDENT, `/api/deadlines` 200, anon schedule 401, zero admins | **0** | dropped |
| 2 (first attempt) | absent | failed at `next build`: Node `FATAL ERROR: Zone Allocation failed - process out of memory` **after** `✓ Compiled successfully in 73s` | 1 | never created |
| 2 (retry) | absent | **PASS** — same checks | **0** | dropped |

Run 2's first attempt was environmental, not a PG16 or application defect: the host had only **826 MB free of 8 GB** (Docker VM 1072 MB + browser/editor). Stopping the idle Gradle daemon raised free memory to 1289 MB and the identical run then passed. Teardown behaved correctly in the failure case — "gate database was never created by this run; nothing dropped".

Gate responsibilities exercised on PG16: ownership marker creation/validation, version-aware Flyway assertions, V20 schema assertions, prod-profile boot, app-provisioned STUDENT identity, authenticated smoke, zero-administrator assertion, health check, port-based shutdown, database cleanup, repeat execution.

Logs: `evidence-pg16-gate-run1.log`, `evidence-pg16-gate-run2.log`.

## 7. Regression test results

| Suite | Tests | Failures | Errors | Exit |
|---|---|---|---|---|
| `RegionalCountyVisibilityTest` | 16 | 0 | 0 | — |
| `DeadlineAuthorizationTest` | 11 | 0 | 0 | — |
| `DemoSeedGuardTest` | 8 | 0 | 0 | — |
| `GuardianDeadlineLinkLifecycleTest` | 4 | 0 | 0 | — |
| `GuardianLinkLifecycleTest` | 4 | 0 | 0 | — |
| `GuardianSchoolDatesTest` | 3 | 0 | 0 | — |
| `DeadlineCountyMigrationTest` | 1 | 0 | 0 | — |
| **combined** | **47** | **0** | **0** | **0** |

These run on **H2**, as the suite is configured; they are regression evidence, **not** PostgreSQL evidence. The PostgreSQL 16 integration evidence is separate:

**Live county-visibility contract against PostgreSQL 16.16** — `docs/audit/v20-api-contract-check.sh` (connection parameterised, same assertions) with `PG_PORT=5434 PG_DB=elekeza_pg16_upgrade`:

```
SUMMARY: pass=37 fail=0        CONTRACT_EXIT=0
```

Covering: admin creation normalising `"  NAIROBI  County "` → `nairobi` persisted in PostgreSQL, blank/wrong-scope county rejected 400, national visible across counties, own-county regional visible, other-county hidden, uncoded regional hidden and legacy uncoded rows hidden, two-county guardian sees both, institution dates institution-scoped, revoked and expired links expose nothing, anonymous 401, non-guardian 403, and both endpoints agreeing.

A first contract attempt reported 29 pass / 8 fail; the cause was my orchestration error — a stale application instance still held port 8096, so the new process applied V20 and then died with `Web server failed to start. Port 8096 was already in use`, leaving the contract talking to the old JVM. After stopping the stale process the clean run returned 37/37. Recorded here because the failed run is in the logs.

## 8. Database cleanup evidence

| Item | State |
|---|---|
| Databases inside the container before removal | `elekeza_pg16`, `elekeza_pg16_fresh`, `elekeza_pg16_upgrade`, `postgres` |
| Container | `docker stop` + `docker rm -f` → container absent, port **5434 free** |
| Databases after removal | gone with the container (ephemeral, no volume) |
| Host evidence retained | both schema snapshots, the pre-upgrade custom-format dump (verified), all logs |
| Shared PostgreSQL 15 cluster | **28 non-template databases, unchanged**; unrelated project databases all intact |
| Working tree | HEAD `47d17f5`, 4 stashes, no commit/push/deploy |

## 9. PostgreSQL 15 versus 16

| Behaviour | PostgreSQL 15.17 | PostgreSQL 16.16 |
|---|---|---|
| Migrations applied from empty | 20/20 → v20 | 20/20 → v20 |
| V19 → V20 in place | 1 migration, 30 ms | 1 migration, 186 ms |
| `county_code` definition | `character varying(64)`, nullable | identical |
| `idx_deadline_county` | present | present |
| Column comment | present | present |
| Public tables | 59 | 59 |
| Hibernate `validate` | passed | passed |
| Health endpoint | 200 | 200 |
| County contract (live) | 37/37 | 37/37 |
| Staging gate | PASS (×3) | PASS (×2) |
| Schema diff before → after | column + comment + index | column + comment + index |

The two servers agree on every observable outcome.

## 10. Remaining compatibility risks

### 10.1 Confirmable, needs action — JDBC driver is not certified for PostgreSQL 16
The bundled driver is 42.6.2. pgJDBC's own compatibility table lists the **42.6.x** line as CI-tested against **PostgreSQL 8.4–14**; PostgreSQL 16 was only added to CI in **42.7.4**. It worked here for DDL validation, DML, prepared statements and reads, but "works in this test" is not vendor certification. **Recommendation:** move to the current 42.7.x patch line, which CI-tests 9.1–17.

### 10.2 Confirmable, needs action — Flyway 9.22.3 predates PostgreSQL 16 certification
All 20 migrations applied cleanly on 16.16, but Redgate's support matrix that names PostgreSQL 16 covers current Flyway (v10+), not 9.22.3. No failure was observed; the certification gap is real. **Recommendation:** plan a Flyway upgrade before the pilot host moves to 16, or accept the tested-but-uncertified status explicitly.

### 10.3 Confirmable operational defect — backup tooling cannot dump PostgreSQL 16
`scripts/db-backup.sh` hard-codes `PG_BIN="/c/Program Files/PostgreSQL/15/bin"`. Against the 16.16 server this failed immediately:

```
pg_dump: error: aborting because of server version mismatch
pg_dump: detail: server version: 16.16; pg_dump version: 15.17
```

`pg_dump` requires a client at or above the server's major version. All dumps in this report were therefore taken with the container's 16.16 binaries. On the pilot host this must be fixed — use matching-major client tools (install PostgreSQL 16 client tools, or dump with `docker exec` from a 16 image). **Not changed in this task**, because the fix belongs with the deployment topology decision.

### 10.4 Theoretical, not observed
- **Collation/ICU differences**: the Alpine/musl image uses a different libc and default collation from the Debian-based `postgres:16` image or a Windows-installed server. Every query in this codebase compares exact, lower-cased strings and identifiers; none is collation-sensitive. Not exercised adversarially.
- **Locking at scale**: `CREATE INDEX` inside Flyway's transaction takes a `SHARE` lock on `deadlines`. The dataset here was 4 rows. On a large table, plan a maintenance window; `CREATE INDEX CONCURRENTLY` cannot run inside Flyway's transaction.
- **No performance evidence**: no benchmarking, no connection-pool saturation, no long-running transaction behaviour. Host had 8 GB RAM and Docker used ~1 GB.
- **Frontend build fragility**: the gate rebuilds the frontend each run and failed once with Node out-of-memory at 826 MB free. Unrelated to PostgreSQL, but the gate is sensitive to host memory pressure.
- **JDBC 42.6.2 vs Java 21**: the driver's CI for that line covers Java 8/11/17; the JVM here is 21. It ran without error.

### 10.5 Not tested
No pg_upgrade path (15 → 16 data directory migration) was attempted — out of scope; the deployment uses a fresh container with Flyway from V1. Multi-connection concurrency, replication and failover were not exercised.

---

## Appendix — commands and artifacts

```bash
docker pull postgres:16-alpine
docker run -d --rm --name elekeza-pg16 -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=elekeza_pg16 -p 127.0.0.1:5434:5432 postgres:16-alpine

# fresh install
java -jar backend/build/libs/elekeza-backend-0.0.1-SNAPSHOT.jar \
  --spring.profiles.active=prod --server.port=8096        # DB_URL → :5434/elekeza_pg16_fresh

# upgrade: stage v19, load legacy rows, dump, then let JV20 run
java -jar … --spring.jpa.hibernate.ddl-auto=none --spring.flyway.target=19
docker exec -u postgres elekeza-pg16 pg_dump -U postgres -d elekeza_pg16_upgrade -F c -b > backups/…dump
java -jar … --spring.profiles.active=prod --server.port=8096

# contract + gate against PG16
PG_PORT=5434 PG_DB=elekeza_pg16_upgrade bash docs/audit/v20-api-contract-check.sh
GATE_PGPORT=5434 GATE_PGHOST=127.0.0.1 bash scripts/staging-gate.sh
```

| Artifact | Path |
|---|---|
| Fresh install log | `docs/audit/evidence-pg16-fresh-install.log` |
| V19 staging log | `docs/audit/evidence-pg16-migrate-to-v19.log` |
| V20 upgrade log | `docs/audit/evidence-pg16-v20-upgrade.log` |
| Clean boot at v20 | `docs/audit/evidence-pg16-upgrade-boot-clean.log` |
| Contract logs (failed then clean) | `evidence-pg16-contract.log`, `evidence-pg16-contract-clean.log` |
| Gate runs | `evidence-pg16-gate-run1.log`, `evidence-pg16-gate-run2.log` |
| Regression tests | `evidence-pg16-regression-tests.log` |
| Schema snapshots | `evidence-pg16-schema-before.sql`, `…-after.sql` |
| Pre-upgrade backup (git-ignored) | `backups/elekeza_pg16_upgrade-pre-v20.dump` |

**Files changed in this task:** `scripts/staging-gate.sh` (connection settings made overridable via `GATE_PGHOST/GATE_PGPORT/GATE_PGUSER/GATE_PGPASSWORD/GATE_PSQL`, defaults unchanged) and `docs/audit/v20-api-contract-check.sh` (same parameterisation for `PG_HOST/PG_PORT/PG_DB`). No production code, configuration, migration or test was modified; no defect was found that required a code change.
