# ELEKEZA — Staging Gate Repair

**Date:** 15 November 2026
**Scope:** `scripts/staging-gate.sh` (one tracked file). No production code, no configuration, no secrets, no migrations touched.
**Branch:** `sprint-3-safe-config` @ `47d17f5` — nothing committed, pushed or deployed.
**Result:** the gate passes end-to-end from a clean disposable PostgreSQL database, three times, without demo seeding.

---

## 1. Root cause

The gate failed at backend startup after Flyway had already applied every migration. Two independent defects, plus one found during the repair:

### 1.1 Primary defect — the gate predates Wave 0's demo-seed guard

`scripts/staging-gate.sh` booted the production profile with `DEMO_SEED_ENABLED=true` so its login smoke had `student@elekeza.app` to authenticate with. Wave 0 added `DemoSeedGuard` (SEC-P0-03), which refuses exactly that combination:

```
java.lang.IllegalStateException: Refusing to start: demo seeding is ENABLED
(spring.flyway.placeholders.demoSeedEnabled=true) but the active profiles [prod]
do not include one of [dev, test].
```

The guard is right: `V2__seed_demo.sql` creates a platform `ADMIN` and a `SCHOOL_ADMIN` whose bcrypt hashes and plaintext passwords are committed to the repository. The gate was never updated for the new policy, so it became impossible to pass — a defect in the gate, not in the guard.

### 1.2 Secondary defect — a hard-coded migration count

```bash
grep -q "Successfully applied 15 migrations" "$BE_LOG" || fail "..."
```

There are 20 migration files. Even with the boot fixed, this assertion would have rejected a correct, fully-migrated database. It was guaranteed to drift on every migration ever added.

### 1.3 Defects found while repairing

| # | Defect | Effect |
|---|---|---|
| a | `DROP DATABASE IF EXISTS elekeza_staging_gate` ran unconditionally on any pre-existing database of that name | could destroy a database the gate did not create |
| b | Servers were stopped with `taskkill //PID $!`, using MSYS/bash PIDs where Windows PIDs are required | the kill silently did nothing (`|| true` masked it), risking orphaned servers |
| c | `cleanup()` ran under `set -e` | a failing command inside the EXIT trap aborted the handler, leaving the database behind with no diagnostic (observed on run 2) |

---

## 2. Architecture decision

**Production-like startup with demo seeding OFF, and identities provisioned by the application itself.**

The gate now registers its own throwaway account through the existing public endpoint `POST /api/auth/register` and signs in with it. `AuthService.register` hard-codes `role = UserRole.STUDENT`, so this path cannot mint an administrator; the email is unique per run (`gate-smoke-<epoch>-<random>@staging-gate.invalid`), so no credential survives a run and the gate is repeatable.

Alternatives considered and rejected:

| Option | Why rejected |
|---|---|
| Add a `gate` profile to `DemoSeedGuard.PERMITTED_PROFILES` | weakens the exact control Wave 0 introduced; the task forbids it |
| Hard-code a bcrypt hash in the gate script for a known password | reintroduces a committed credential — the thing the guard exists to prevent |
| New staging-only `ApplicationRunner` that seeds a user | production code and a new flag added purely for a test convenience; more surface than the problem needs |
| Keep demo seeding but run `dev` | `dev` disables Flyway and uses H2 — it would no longer test the prod artifact path at all |
| **Register through the public API at runtime** | **chosen** — no policy change, no secret, no new production code, exercises the real auth path |

`DemoSeedGuard` is untouched. `DEMO_SEED_ENABLED` is now explicitly `FALSE` in the gate.

---

## 3. Files changed

| File | Change |
|---|---|
| `scripts/staging-gate.sh` | **the only tracked file modified** — repaired end-to-end (see §5) |
| `docs/audit/ELEKEZA_STAGING_GATE_REPAIR.md` | this report |
| `docs/audit/evidence-gate-repair-run{1..5}*.log`, `evidence-gate-repair-tests.log`, `evidence-gate-repair-guard-tests.log` | run evidence |

No backend, frontend, configuration, migration or test source was modified.

### 3.1 What the repaired script does differently

1. **Preconditions** — verifies PostgreSQL reachability and that ports 8096/3105 are free; the gate refuses to start rather than killing a process it did not create.
2. **Gate database ownership** — a `gate_meta.ownership` marker is created the moment the gate provisions its database. On a later run, the database is dropped **only** if that marker is present; otherwise the gate refuses and names the reason. The marker lives outside `public` so Flyway still sees an empty schema (`baseline-on-migrate` would otherwise baseline a non-empty schema and skip V1).
3. **Version-aware Flyway verification** — expected count and version are derived from `db/migration` (`V*__*.sql`), then confirmed three ways: the Flyway log line, `flyway_schema_history` (latest successful version), and `count(*) where success = false` = 0.
4. **V20 schema assertions** — `deadlines.county_code` must be `character varying|YES|64`, `idx_deadline_county` must exist, and a fresh gate database must contain no county-scoped REGIONAL rows.
5. **App-provisioned smoke identity** — register (expects 201) → login (200) → `/api/auth/me` (200, identity matches, role `STUDENT`) → `/api/deadlines` (200) → anonymous `/api/guardian/schedule` (401).
6. **No administrator may exist** — the gate asserts `count(*)=0` for `role IN ('ADMIN','SCHOOL_ADMIN')`, making the "no demo admins" decision testable rather than aspirational.
7. **Robust teardown** — `set +e` inside the trap, servers stopped by the PID that owns the port we reserved (verified free beforehand), a short settle delay, then `DROP` with a `WITH (FORCE)` fallback and a printed outcome either way. The database is dropped only if this run created it.

---

## 4. Security implications

| Concern | Position |
|---|---|
| Demo administrators | never created; gate asserts zero admin rows |
| Committed credentials | none used by the gate; the registered account is generated per run and destroyed with the database |
| Profile allowlist | unchanged — `DemoSeedGuard` still permits seeding only on `dev`/`test` |
| Authorization exercised | registration always yields `STUDENT`; the smoke proves anonymous access to `/api/guardian/schedule` is 401 |
| Dropping databases | now gated on positive ownership (marker), never on name alone |
| Killing processes | only after proving the port was free before startup, so the listener is necessarily ours |
| `SECURE_COOKIES=false` | **deliberate local-only deviation** — the gate serves plaintext HTTP on localhost, where a `Secure` cookie cannot be exercised. Production default stays `true`; a TLS staging host must not copy this. |
| Secrets | none read, printed or modified; gate-local dummy values only |

---

## 5. Before / after behaviour

| Aspect | Before | After |
|---|---|---|
| Boot profile | `prod`, `DEMO_SEED_ENABLED=true` | `prod`, `DEMO_SEED_ENABLED=FALSE` |
| Smoke identity | demo `student@elekeza.app` (committed password) | freshly registered `gate-smoke-…@staging-gate.invalid` |
| Boot outcome | **always fails** (`DemoSeedGuard`) | succeeds |
| Migration assertion | `"Successfully applied 15 migrations"` | derived count + version, cross-checked against `flyway_schema_history` |
| Schema assertions | none | V20 column/index/absence-of-leakage |
| Database drop | unconditional, by name | only with a verified ownership marker |
| Server shutdown | `taskkill` on MSYS PIDs (ineffective) | kill the PID owning the reserved port, then confirm the port is free |
| Teardown on failure | aborted silently under `set -e` | runs to completion and reports the outcome |
| Repeatability | not established | proven, two paths (§7) |
| Admin accounts in gate DB | one `ADMIN` + one `SCHOOL_ADMIN` from the demo seed | zero, asserted |

---

## 6. Exact commands executed

```bash
bash scripts/staging-gate.sh                                   # run 1 — ownership refusal (exit 1)
# ownership of the leftover DB established, then dropped manually
psql -d elekeza_staging_gate -tAc "select string_agg(description,', ' order by installed_rank) ..."
psql -c "DROP DATABASE IF EXISTS elekeza_staging_gate;"
bash scripts/staging-gate.sh                                   # run 2 — failed on a bug in my own new assertion (exit 1)
# fixed: psql helper no longer strips spaces from values
bash scripts/staging-gate.sh                                   # run 3 — PASS (exit 0), database existed with marker
bash scripts/staging-gate.sh                                   # run 4 — PASS, database absent at start
bash -n scripts/staging-gate.sh                                # syntax check
bash scripts/staging-gate.sh                                   # run 5 — PASS with hardened teardown
```

```bash
cd backend && ./gradlew test --console=plain \
  --tests com.elekeza.backend.guardian.RegionalCountyVisibilityTest \
  --tests com.elekeza.backend.guardian.GuardianSchoolDatesTest \
  --tests com.elekeza.backend.calendar.DeadlineAuthorizationTest \
  --tests com.elekeza.backend.guardian.GuardianDeadlineLinkLifecycleTest \
  --tests com.elekeza.backend.guardian.GuardianLinkLifecycleTest \
  --tests com.elekeza.backend.calendar.DeadlineCountyMigrationTest \
  --tests com.elekeza.backend.auth.JwtTokenTypeTest
# exit 0 — 42 tests, 0 failures

cd backend && ./gradlew test --console=plain --tests com.elekeza.backend.config.seed.DemoSeedGuardTest
# exit 0 — 8 tests, 0 failures
```

---

## 7. Test counts, exit codes and database lifecycle evidence

### 7.1 Gate runs

| Run | Starting DB state | Outcome | Exit code | Database after |
|---|---|---|---|---|
| 1 | leftover DB, **no ownership marker** | refused: "carries no 'gate_meta.ownership' marker — refusing to drop a database this gate cannot prove it owns" | **1** (observed) | untouched |
| 2 | absent (after justified manual drop) | created + marked; failed on my own assertion bug (`charactervarying`) | **1** (observed) | **left behind** — teardown aborted silently (defect §1.3c, later hardened) |
| 3 | existing DB **with marker** | `existing gate database verified by marker; recreating` → **PASS** | **0** (observed) | dropped |
| 4 | absent | created + marked → **PASS** | log shows PASSED; the exit echo was lost when the machine disconnected | dropped |
| 5 | absent | created + marked → **PASS** (hardened teardown) | log shows PASSED, no `GATE FAILED` anywhere | dropped |

Run 3 is the strongest evidence: it exercised the marker-verified recreation path on a database that already existed, and its exit code was captured directly as 0. Runs 4 and 5 prove repeatability from a cold start; for those two the exit status is inferred from the log and the clean, complete teardown, because the wrapper's `echo $?` was lost to connectivity interruptions.

### 7.2 Database lifecycle

- Cluster non-template databases: **28 before the repair, 28 after** — unchanged.
- `elekeza_staging_gate` after the final run: **absent** (dropped by the gate's own teardown).
- Unrelated databases verified present throughout: `cliniq`, `elekeza`, `mwananchi`, `pcea`, `traq`, `trustmark`.
- `elekeza_v20_upgrade` (from the previous V20 verification) retained untouched for review.
- Ownership of the one leftover database was established positively before it was dropped: Flyway history described Elekeza's own migrations (`baseline schema`, `support interventions deadlines`, `devices regions billing`, `feature flag overrides`, `deadline county scope`) and six Elekeza core tables were present.

### 7.3 Tests

| Suite | Tests | Failures | Errors | Exit |
|---|---|---|---|---|
| `RegionalCountyVisibilityTest` | 16 | 0 | 0 | — |
| `DeadlineAuthorizationTest` | 11 | 0 | 0 | — |
| `GuardianDeadlineLinkLifecycleTest` | 4 | 0 | 0 | — |
| `GuardianLinkLifecycleTest` | 4 | 0 | 0 | — |
| `GuardianSchoolDatesTest` | 3 | 0 | 0 | — |
| `DeadlineCountyMigrationTest` | 1 | 0 | 0 | — |
| `JwtTokenTypeTest` | 3 | 0 | 0 | — |
| **combined run** | **42** | **0** | **0** | **0** |
| `DemoSeedGuardTest` (security guard) | **8** | 0 | 0 | **0** |

The guard's own tests pass unchanged — the fix removed the gate's dependence on demo seeding instead of relaxing the guard.

---

## 8. Previously verified V20 results (unchanged by this work)

From `docs/audit/ELEKEZA_V20_POSTGRES_STAGING_VERIFICATION.md`, and re-confirmed here by every gate run:

- V20 applied in place from v19 through Flyway on PostgreSQL 15.17, checksum `-1052899281`, 0 failed history rows, 30 ms.
- Schema verified: `county_code varchar(64) NULL`, `idx_deadline_county` btree, no other schema change.
- No backfill: legacy REGIONAL rows kept `NULL`.
- County-visibility contract: 37/37 assertions on live PostgreSQL.
- Each gate run re-verified the V20 schema assertions on a genuinely fresh database (20/20 migrations, v20, 0 failed).

No V20 file, entity, service or test was modified during this repair.

---

## 9. Newly verified staging-gate results

- The gate now runs to completion on a clean disposable database: build → fresh DB → Flyway 20/20 → prod-profile boot → health 200 → frontend `next start` → register 201 → login 200 → session 200 (`STUDENT`) → `/api/deadlines` 200 → anonymous `/api/guardian/schedule` 401 → zero admin rows → teardown drops the database.
- It is idempotent in both directions: re-running over its own marked database recreates it (run 3), and running with no database creates one (runs 4, 5).
- It never touches a database it cannot prove it owns (run 1).
- `DemoSeedGuard` is intact and its 8 tests pass.

---

## 10. Outstanding blockers and remaining limitations

1. **PostgreSQL 15 only.** The pilot target is PostgreSQL 16 (`docker-compose.yml`). No PG16 instance was available, so PG16 compatibility is **not** claimed. The gate's SQL is ordinary `ALTER/CREATE INDEX/COMMENT` plus information-schema reads, but that is reasoning, not evidence.
2. **`SECURE_COOKIES=false` is a local-gate deviation.** A TLS staging host must run with the production default and re-verify the cookie path there.
3. **The gate's smoke identity is a `STUDENT`.** There is no admin or guardian journey in the gate — deliberate, since the gate must not create administrators. The county contract is covered by `RegionalCountyVisibilityTest` and the PostgreSQL contract script, not by the gate.
4. **Failure-path teardown hardening is defensive, not root-caused.** The silent abort in run 2 was not reproducible on demand; the trap is now `set +e`-protected and always reports its outcome, but I cannot claim to have proven the original trigger.
5. **Exit codes for runs 4 and 5 were lost** to machine disconnects. Their success rests on the logs (all steps present, `GATE PASSED`, no failure marker) and on the verified end state (ports free, database dropped). Run 3's exit 0 was observed directly.
6. **Pre-existing constraints kept as-is:** fixed ports 8096/3105, local `postgres/postgres` credentials on port 5433, and a gate that rebuilds the frontend on every run (~1–2 min).
7. **Still open from earlier reviews:** REG-05 (security + visibility bundled in one working-tree diff) and REG-06 (`ZoneId.systemDefault()` date filtering).

---

## Appendix — evidence

| Artifact | Path |
|---|---|
| Run 1 — ownership refusal | `docs/audit/evidence-gate-repair-run1-refusal.log` |
| Run 2 — my assertion bug | `docs/audit/evidence-gate-repair-run2-pass.log` |
| Run 3 — pass, existing marked DB | `docs/audit/evidence-gate-repair-run3-pass.log` |
| Run 4 — pass, absent DB | `docs/audit/evidence-gate-repair-run4-repeat.log` |
| Run 5 — pass, hardened teardown | `docs/audit/evidence-gate-repair-run5-final.log` |
| County/security test output | `docs/audit/evidence-gate-repair-tests.log`, `evidence-gate-repair-guard-tests.log` |
| V20 verification (previous task) | `docs/audit/ELEKEZA_V20_POSTGRES_STAGING_VERIFICATION.md` |
