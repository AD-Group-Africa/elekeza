# ELEKEZA — JDBC and Flyway Compatibility Remediation

**Date:** 15 November 2026
**Branch:** `sprint-3-safe-config` @ `47d17f5` — nothing committed, pushed or deployed.
**Baseline report:** `docs/audit/ELEKEZA_POSTGRESQL_16_COMPATIBILITY.md` (CONDITIONAL PASS).
**Result:** pgJDBC upgraded to 42.7.14 and verified against PostgreSQL 16. Flyway 13.12.2 was evaluated and **rejected on a precise, reproducible incompatibility** with Spring Boot 3.2.4; Flyway 11.20.3 — the newest line that Boot 3.2.4 can drive — was adopted instead and fully verified.

---

## 1. Previous and new versions

| Component | Before | After | Source of the version |
|---|---|---|---|
| `org.postgresql:postgresql` | 42.6.2 | **42.7.14** | was Spring Boot 3.2.4 BOM; now pinned via `extra["postgresql.version"]` |
| `org.flywaydb:flyway-core` | 9.22.3 | **11.20.3** | was Spring Boot BOM; now pinned via `extra["flyway.version"]` |
| `org.flywaydb:flyway-database-postgresql` | **not declared** | **11.20.3** | new module, explicit version |
| `org.springframework.boot` | 3.2.4 | 3.2.4 | **unchanged — no framework upgrade** |
| `org.hibernate.orm:hibernate-core` | 6.4.4.Final | 6.4.4.Final | unchanged |
| `com.h2database:h2` | present (test) | present (test) | unchanged |

Where the versions came from originally: `backend/build.gradle.kts` declared `runtimeOnly("org.postgresql:postgresql")` and `implementation("org.flywaydb:flyway-core")` **without versions**, so both were supplied by the Spring Boot 3.2.4 BOM through the `io.spring.dependency-management` 1.1.4 plugin. Baseline resolution was a single instance of each (`flyway-core -> 9.22.3`, `postgresql -> 42.6.2`) on both `runtimeClasspath` and `testRuntimeClasspath` — no duplicates.

`flyway-database-postgresql` was never declared because Flyway 9 carried PostgreSQL support inside `flyway-core`. From Flyway 10 onward that support moved to a module, so a naive `flyway-core` upgrade would ship a migrator that cannot recognise PostgreSQL at all.

## 2. Official compatibility evidence

**pgJDBC 42.7.14** (published 2026-10-07)
- Vendor compatibility table: the **42.7.x** line is CI-tested on **PostgreSQL 9.1–17** across Java 8/11/17/21/25/26-ea. The 42.6.x line was CI-tested only against **PostgreSQL 8.4–14** — this is exactly the gap the previous report identified.
- 42.7.14 is a **security release**: it fixes `requireAuth` not being enforced when the configured value excluded every authentication method (CVE-2026-107314) and the driver retaining bytes of earlier statements when padding a value shorter than its declared length (CVE-2026-107315). The old 42.6.2 predates both fixes.
- Licence: BSD-2-Clause.
- Java 21: supported (CI covers 21); this host runs Temurin 21.0.9.

**Flyway**
- Redgate's support matrix lists PostgreSQL 12–18 for current Flyway. Flyway 10 introduced the modular database support that this change adopts.
- **13.12.2 does not work with Spring Boot 3.2.4** — see §4.
- Community edition: resolved from Maven Central, no licence key, no licensing error at runtime; the OSS core and the PostgreSQL module are Apache-2.0.

## 3. Dependency management changes

Only `backend/build.gradle.kts` changed:

```kotlin
extra["postgresql.version"] = "42.7.14"
val flywayVersion = "11.20.3"
extra["flyway.version"] = flywayVersion

// …
implementation("org.flywaydb:flyway-core")
implementation("org.flywaydb:flyway-database-postgresql:$flywayVersion")
```

Property overrides are used rather than hard-coded coordinates so the BOM keeps managing every transitive consumer of these libraries; `postgresql` and `flyway-core` stay version-free in the dependency block. The PostgreSQL module takes the same `flywayVersion` value, so the two Flyway modules can never drift apart. `flow-database-postgresql` is not in Boot 3.2.4's BOM, hence the explicit version there.

## 4. Why not Flyway 13.12.2 — precise cause

13.12.2 **exists** (`flyway-core-13.12.2.pom`, `flyway-database-postgresql-13.12.2.pom`, published 2026-11-12) and was compiled and run against PostgreSQL 16.16. Startup aborted:

```
java.lang.NoSuchMethodError:
  'org.flywaydb.core.api.configuration.FluentConfiguration
   org.flywaydb.core.api.configuration.FluentConfiguration.cleanOnValidationError(boolean)'
    at org.springframework.boot.autoconfigure.flyway.FlywayAutoConfiguration$FlywayConfiguration
        .lambda$configureProperties$26(FlywayAutoConfiguration.java:281)
```

Spring Boot 3.2.4's `FlywayAutoConfiguration.configureProperties` calls `cleanOnValidationError(boolean)` **unconditionally** — it is not guarded by a property check — so no configuration can avoid it. Flyway removed that method.

Bisecting by binary inspection of `FluentConfiguration.class`:

| Flyway | `cleanOnValidationError` |
|---|---|
| 9.22.3 | present |
| 10.0.0 | present |
| 10.22.0 | present |
| 11.0.0 | present |
| 12.0.0 | **absent** |
| 13.12.2 | **absent** |

The removal happened in **12.0.0**. Flyway 10+ therefore *is* usable with Boot 3.2.4, but 12+ is not.

**Smallest supported compatible alternative:** the latest 11.x release, **11.20.3**, which still exposes the method, supports PostgreSQL 16, and ships a matching `flyway-database-postgresql` 11.20.3. Spring Boot was **not** upgraded. A 12/13 upgrade is only possible after Spring Boot reaches a version whose Flyway autoconfiguration targets Flyway 12+; that is recorded as a follow-up, not attempted here.

## 5. Resolved dependency trees

`runtimeClasspath` (unchanged shape, new versions):

```
+--- org.flywaydb:flyway-core -> 11.20.3
+--- org.flywaydb:flyway-database-postgresql:11.20.3
+--- org.postgresql:postgresql -> 42.7.14
```

`dependencyInsight`:
- `org.postgresql:postgresql:42.7.14 (selected by rule)` — one version, no conflict resolution, no other driver.
- `org.flywaydb:flyway-core:11.20.3 (selected by rule)`, reached both directly and via `flyway-database-postgresql:11.20.3`.
- `org.flywaydb:flyway-database-postgresql:11.20.3 (selected by rule)`.

Packaged artifact (`BOOT-INF/lib`):
```
flyway-core-11.20.3.jar
flyway-database-postgresql-11.20.3.jar
postgresql-42.7.14.jar
```
No 9.22.3, no 42.6.2, and no `flyway-database-cockroachdb` (the 13.12.2 PostgreSQL module pulled that in transitively; 11.20.3's does not). Total runtime jars: 134.

## 6. Spring Boot integration results

| Check | Result |
|---|---|
| Autoconfiguration loads | yes — no `NoSuchMethodError` / `NoClassDefFoundError` |
| `FlywayProperties` mapping (`locations`, `baseline-on-migrate`, `validate-on-migrate`, `placeholders`) | all accepted and honoured |
| `spring.flyway.target` | honoured (used to stage at V19) |
| Placeholder `demoSeedEnabled` | honoured (V2 correctly no-op with `FALSE`) |
| Migration discovery | 20/20 files found under `classpath:db/migration` |
| Baseline / repair side effects | none — Flyway logged *"All configured schemas are empty; baseline operation skipped"* and migrated from V1 |

## 7. PostgreSQL 16 migration results

Dedicated `postgres:16-alpine` container (**PostgreSQL 16.16**), loopback `127.0.0.1:5434`, removed afterwards.

**Fresh install** (`elekeza_pg16_v2fresh`):
- `Successfully validated 20 migrations`
- `Successfully applied 20 migrations to schema "public", now at version v20` (7.658 s)
- 0 failed history rows, 20 history rows, Hibernate `validate` passed, `Started ElekezaApplicationKt`, health **200**

**Checksum equality** — the strongest guarantee that nothing changed under the migrations:

```
version:checksum for all 20 rows, flyway 9.22.3 @PG15  vs  flyway 11.20.3 @PG16
v9_rows=20 v11_rows=20
CHECKSUMS_IDENTICAL=yes
```

No migration was silently ignored, rewritten or re-versioned, and no repair was needed.

**In-place upgrade** (`elekeza_pg16_upgrade2`):
- staged at V19 (19 applied, 7.809 s); `county_code` absent
- legacy fixtures: 4 deadlines (2 REGIONAL), 8 users, 3 institutions, 5 guardian links
- backup taken at V19: custom format, **118 table definitions verified**, 2026-11-15T07:47:48Z
- `Migrating schema "public" to version "20 - deadline county scope"` → `Successfully applied 1 migration … now at version v20` (0.151 s)
- clean re-boot: `Current version of schema "public": 20` / `Schema "public" is up to date. No migration necessary.`; health 200
- `county_code` = `character varying`, nullable, length 64; `idx_deadline_county` present; both legacy REGIONAL rows still `NULL`; **59** public tables; 0 failed migrations

## 8. Staging gate results

The actual `scripts/staging-gate.sh`, targeted at PG16 with `GATE_PGPORT=5434 GATE_PGHOST=127.0.0.1`:

| Run | Result | Exit |
|---|---|---|
| 1 | PASS — 20/20 v20, V20 schema verified, frontend 200, register 201, login 200, `/me` 200 STUDENT, `/api/deadlines` 200, anon schedule 401, zero admins, DB dropped | **0** |
| 2 | PASS — same checks, DB dropped | **0** |

Authenticated smoke runs through the production frontend origin, i.e. the real proxy + cookie path, not a direct backend call.

## 9. Regression results

| Suite | Tests | Failures | Exit |
|---|---|---|---|
| `RegionalCountyVisibilityTest` | 16 | 0 | — |
| `DeadlineAuthorizationTest` | 11 | 0 | — |
| `DemoSeedGuardTest` | 8 | 0 | — |
| `GuardianDeadlineLinkLifecycleTest` | 4 | 0 | — |
| `GuardianLinkLifecycleTest` | 4 | 0 | — |
| `GuardianSchoolDatesTest` | 3 | 0 | — |
| `DeadlineCountyMigrationTest` | 1 | 0 | — |
| **total** | **47** | **0** | **0** |

(`DemoSeedGuard` untouched — its 8 tests pass on the upgraded stack.) The suite runs on H2; the PostgreSQL 16 evidence is the **live county contract: 37 pass / 0 fail, exit 0** against the upgraded stack.

## 10. Security findings

| Finding | Status |
|---|---|
| pgJDBC 42.6.2 exposed to CVE-2026-107314 (auth methods silently not enforced) and CVE-2026-107315 (stale statement bytes) | **closed** by 42.7.14 |
| Duplicate JDBC drivers | none — one `postgresql` on runtime and test classpaths |
| Duplicate Flyway engines | none — one `flyway-core`, one PostgreSQL module, same version |
| Unexpected transitive additions | only `flyway-database-postgresql` (intended); no cockroachdb module |
| Spring Boot overridden against the BOM | only `postgresql.version` and `flyway.version`, both deliberate and documented in the build file |
| Framework upgrade | none — Boot 3.2.4, Hibernate 6.4.4, Kotlin 1.9.23 unchanged |
| Flyway 11.20.3 is not the newest line | **open** — 12.x/13.x fixes cannot be adopted until Spring Boot is upgraded (see §12) |
| Secrets | none read, printed or modified; synthetic gate-local values only |

## 11. Separate operational defect — backup tooling

**Not changed.** `scripts/db-backup.sh` pins the client binaries:

```bash
PG_BIN="/c/Program Files/PostgreSQL/15/bin"
```

`pg_dump` requires a client at or above the server's major version, so against PostgreSQL 16 it fails outright:

```
pg_dump: error: aborting because of server version mismatch
pg_dump: detail: server version: 16.16; pg_dump version: 15.17
```

Every dump in this task was therefore taken with the container's own 16.16 binaries.

**Remediation proposal (for approval, not applied):**
1. Resolve the client directory from the *server* major version at runtime — query `server_version_num`, map to an installed `PostgreSQL/<major>/bin`, and fail with a clear message naming the missing client if it is not installed.
2. Where the database runs in a container, prefer `docker exec <container> pg_dump …` so the tooling always matches the server major version by construction.
3. Add a pre-flight check that compares `pg_dump --version` with `server_version_num` before the dump rather than after it fails.

This is blocked on the intended deployment topology (native PostgreSQL on the pilot host vs container), which has not been decided, so the script is deliberately left untouched.

## 12. Remaining limitations

1. **Flyway 12/13 remain unreachable on Boot 3.2.4** — precise cause in §4. Revisit only with a Spring Boot upgrade (Boot 3.3+ targets Flyway 10+, and a Boot line that targets Flyway 12+ is needed for 13.x).
2. **Flyway 11.20.3 is the newest 11.x, not the newest release.** It supports PostgreSQL 16 and is a large step up from 9.22.3, but later security fixes in 12/13 are out of reach until (1) is resolved.
3. **Backup tooling still mismatched** for a PostgreSQL 16 server (§11) — open operational defect, proposal only.
4. **No scale or performance evidence.** All runs used a 4-row `deadlines` table, one JVM, and 8 GB of host RAM; Docker used ~1 GB. Startup was noticeably slower on this stack (88–103 s vs ~35 s earlier) but that is a cold-start measurement on a loaded host, not a benchmark, and no before/after comparison was run.
5. **Frontend build remains memory-sensitive** — an earlier gate attempt died with a Node out-of-memory error at 826 MB free. Environmental, unrelated to these libraries, but it makes the gate brittle on a loaded machine.
6. **H2-suite parity**: the 47 regression tests exercise H2, not PostgreSQL; the PostgreSQL 16 contract (37/37) and the two gate runs are the database-specific evidence.

---

## 13. Final acceptance

| Item | Status |
|---|---|
| **1. JDBC compatibility gap** | **CLOSED** — 42.7.14 is CI-tested against PostgreSQL 9.1–17, is the current security patch, resolves as a single driver, and was exercised on PG16 (fresh install, upgrade, contract, gate ×2) |
| **2. Flyway compatibility gap** | **CLOSED for PostgreSQL 16** at 11.20.3 (the newest line Boot 3.2.4 can drive); **not closed at 13.12.2**, which is arithmetically blocked by `cleanOnValidationError` and requires a Spring Boot upgrade — recorded as open follow-up |
| **3. PostgreSQL 16 verification** | **PASS** — 20/20 fresh, V19→V20 in place, checksums byte-identical to the Flyway 9 baseline, contract 37/37, gate PASS ×2, 47/47 tests |
| **4. Backup tooling issue** | **OPEN** — documented with a three-option proposal in §11; deliberately not changed pending the deployment-topology decision |
| **5. Files changed** | `backend/build.gradle.kts` (this task). Still-uncommitted from the previous task: `scripts/staging-gate.sh`, `docs/audit/v20-api-contract-check.sh` |
| **6. Repository state** | HEAD `47d17f5`, branch `sprint-3-safe-config`, **4 stashes intact**, no commit, no push, no deploy. Shared PostgreSQL 15 cluster untouched at 28 databases. PG16 container removed, port 5434 free. |

### Evidence

| Artifact | Path |
|---|---|
| Failed Flyway 13 boot (NoSuchMethodError) | `docs/audit/evidence-upgrade-fresh-pg16.log` |
| Flyway 11 build | `evidence-upgrade-build-flyway11.log` |
| Fresh install on PG16 | `evidence-upgrade-fresh-pg16-flyway11.log` |
| V19 staging + fixtures | `evidence-upgrade-v19-stage.log` |
| V20 application | `evidence-upgrade-v20-apply.log` |
| Clean boot + contract + schema | `evidence-upgrade-v20-verify.log`, `evidence-upgrade-contract.log` |
| Gate runs | `evidence-upgrade-gate-run1.log`, `evidence-upgrade-gate-run2.log` |
| Regression tests | `evidence-upgrade-regression-tests.log` |
| Pre-upgrade backup (git-ignored) | `backups/elekeza_pg16_upgrade2-pre-v20.dump` |
