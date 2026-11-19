# ELEKEZA — Database and Staging Readiness (Consolidated)

**Date:** 15 November 2026 · **Branch:** `sprint-3-safe-config` @ `47d17f5` · nothing committed, pushed or deployed.

This is the single authoritative record of Elekeza's database and staging readiness. It consolidates earlier reports **without rewriting them**; each claim carries its own evidence label.

Labels: **VERIFIED** (directly tested, evidence exists) · **PARTIALLY VERIFIED** (some requirements pass, others untested) · **NOT VERIFIED** (untested) · **BLOCKED** (dependency prevents progress) · **FAILED** (reproducible failure).

> **H2 vs PostgreSQL.** The backend unit suite runs on H2. H2 results are regression evidence only and are labelled `[H2]` below. Every claim about PostgreSQL is backed by a live PostgreSQL run.

---

## 1. PostgreSQL compatibility

| Item | Status | Evidence |
|---|---|---|
| PostgreSQL 15.17 — fresh V1→V20 | VERIFIED | `evidence-gate-repair-run3/4.log`, earlier V20 report |
| PostgreSQL 15.17 — V19→V20 in place, legacy rows preserved | VERIFIED | `ELEKEZA_V20_POSTGRES_STAGING_VERIFICATION.md` |
| PostgreSQL 16.16 — fresh V1→V20 | VERIFIED | `evidence-pg16-fresh-install.log`, `evidence-upgrade-fresh-pg16-flyway11.log` |
| PostgreSQL 16.16 — V19→V20 in place | VERIFIED | `evidence-upgrade-v19-stage.log`, `evidence-upgrade-v20-verify.log` |
| V20 schema assertions (`county_code varchar(64) NULL`, `idx_deadline_county`) on both majors | VERIFIED | same logs; 59 tables, 505 columns, 176 indexes, 93 FKs |
| Legacy REGIONAL deadlines keep `NULL` county (no invented values) | VERIFIED | 2/2 both majors |
| Migration checksums identical across Flyway 9.22.3/PG15 and Flyway 11.20.3/PG16 | VERIFIED | 20/20 rows identical; V20 `-1052899281` |
| Hibernate `validate` against migrated schema | VERIFIED | clean boots on both majors |
| Database isolation and cleanup | VERIFIED | shared PG15 cluster stayed at 28 databases; PG16 container removed, port free |

**Not verified:** PostgreSQL 17/18; pg_upgrade migration between majors; replication or failover.

## 2. Migrations and dependency stack

| Item | Status | Evidence |
|---|---|---|
| 20 migrations V1–V20 execute on a clean database | VERIFIED | both majors, `20/20 … now at version v20, 0 failed` |
| No failed migration rows, no silent baseline/repair | VERIFIED | `Schema "public" is empty; baseline operation skipped` + 0 failed rows |
| pgJDBC 42.7.14 | VERIFIED | resolves as a single driver; vendor CI covers PostgreSQL 9.1–17 |
| Flyway 11.20.3 + `flyway-database-postgresql` 11.20.3 | VERIFIED | modules match; Flyway 12+ blocked by Spring Boot 3.2.4 (`NoSuchMethodError` on `cleanOnValidationError`) — see `ELEKEZA_JDBC_FLYWAY_UPGRADE.md` |
| Spring Boot 3.2.4 / Hibernate 6.4.4 unchanged | VERIFIED | no framework upgrade performed |

## 3. Staging gate

| Item | Status | Evidence |
|---|---|---|
| `scripts/staging-gate.sh` runs end-to-end on PG15 | VERIFIED | 3 passes, `ELEKEZA_STAGING_GATE_REPAIR.md` |
| Same script on PG16 (via `GATE_PGPORT`) | VERIFIED | `evidence-upgrade-gate-run1/2.log`, PASS ×2, exit 0 |
| Ownership marker prevents dropping a non-gate database | VERIFIED | run 1 refusal, exit 1 |
| Fresh database provisioning, 20/20 migrations, V20 assertions | VERIFIED | gate logs |
| Synthetic identity provisioned through the public API (STUDENT only) | VERIFIED | register 201, login 200, `/me` 200 |
| Zero demo administrators in the gate database | VERIFIED | asserted `count(*)=0` |
| DemoSeedGuard intact | VERIFIED | 8/8 tests; guard unmodified |
| Health checks, teardown, database cleanup, repeat execution | VERIFIED | both majors, `gate database dropped` |

**Not verified:** the gate has not run against the docker-compose stack (nginx/TLS/redis), only against a native frontend+backend pair.

## 4. Backup and recovery

| Item | Status | Evidence |
|---|---|---|
| Backup on PG15 (native client discovery) | VERIFIED | exit 0, 208 KB, 118 table definitions |
| Backup on PG16 (container client) | VERIFIED | exit 0 |
| Incompatible/missing client fails safely | VERIFIED | exit 3, no artifact |
| Interrupted backup leaves no artifact | VERIFIED | 2.1 MB partial removed, non-zero exit |
| Restore into a separate database (PG15 + PG16) | VERIFIED | exit 0 both; schema/data/checksums identical to source |
| Application runs against restored data | VERIFIED | validate passed, health 200, login 200, `/me` 200, `/api/deadlines` 200 |
| Restore failure paths (invalid archive, unsafe target) | VERIFIED | exit 2 refusals |
| Restore failure path (unreachable server, exit 4) | NOT VERIFIED | local PG15 accepts any password (trust auth); no native PG16 client on this host |
| Off-site/encrypted backups | **BLOCKED** | no destination authorised; see limitations |
| Scheduled backups | NOT STARTED | belongs with hosted staging |

## 5. Application-level evidence that touches the database

| Item | Status | Notes |
|---|---|---|
| County-visibility contract, live PostgreSQL 16 | VERIFIED | **37 pass / 0 fail**, `evidence-upgrade-contract.log` |
| County/lifecycle/auth regression suite `[H2]` | VERIFIED (as H2) | 47/47, exit 0 |
| Guardian isolation, revoked/expired links | VERIFIED | contract sections 5–8 |
| Cross-school isolation at the database level | PARTIALLY VERIFIED | enforced in queries and proven by the contract for guardian/deadline paths; no exhaustive multi-tenant test |

## 6. Hosted staging

| Item | Status |
|---|---|
| Architecture recommendation, configuration templates, deployment and rollback procedures | VERIFIED (documents) — `docs/operations/ELEKEZA_HOSTED_STAGING_ARCHITECTURE.md` |
| Actual hosted environment (compute, database, TLS, DNS) | **BLOCKED** — no authorised provider account, no approval for paid resources or DNS changes |
| HTTPS access, cross-role isolation, backup/restore on the host, rollback drill | NOT STARTED — depend on the above |

## 7. What changed in this programme

- `scripts/lib/pg-client.sh` (new), `scripts/db-backup.sh` and `scripts/db-restore-drill.sh` repaired and proven on two PostgreSQL majors.
- No application code, migration, dependency or security control was modified.
- All pre-existing working-tree changes and 4 stashes preserved.

## 8. Honest summary

The **database layer is in good shape**: migrations, upgrades, schema contracts, isolation contracts, backup and — for the first time — **restoration** are all backed by live evidence on both PostgreSQL majors.

The **operational layer is not yet in place**: everything that makes a database recoverable in practice (scheduled backups, off-site copies, encryption, a hosted environment, a restore rehearsal on real infrastructure) is either blocked or not started. Elekeza can recover a database from a dump it created itself on a developer machine; it cannot yet survive losing that machine.
