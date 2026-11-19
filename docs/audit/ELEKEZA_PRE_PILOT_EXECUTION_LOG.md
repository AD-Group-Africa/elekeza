# ELEKEZA — Pre-Pilot Programme Execution Log

**Started:** 15 November 2026
**Branch:** `sprint-3-safe-config` @ `47d17f5` (no commits, pushes or deployments)
**Purpose:** live register of whatwas done, what was proven, and what is blocked.

Status vocabulary: NOT STARTED · IN PROGRESS · VERIFIED · BLOCKED · FAILED · DEFERRED

| ID | Task | Depends on | Status | Evidence | Next action |
|---|---|---|---|---|---|
| W0-1 | Repository, environment and script baseline captured | — | VERIFIED | this log, §Baseline | — |
| W1-1 | Backup tooling repaired (client discovery by server major) | W0-1 | VERIFIED | `docs/operations/ELEKEZA_DATABASE_BACKUP_AND_RESTORE.md` §8 | — |
| W1-2 | Backup works on PostgreSQL 15 | W1-1 | VERIFIED | exit 0, 208 KB, 118 table defs | — |
| W1-3 | Backup works on PostgreSQL 16 | W1-1 | VERIFIED | `--docker` mode, exit 0 | — |
| W1-4 | Incompatible / missing client fails safely | W1-1 | VERIFIED | exit 3, no artifact | — |
| W1-5 | Interrupted backup leaves no artifact | W1-1 | VERIFIED | partial at 2.1 MB removed | — |
| W2-1 | Restore into separate database (PG15) | W1-2 | VERIFIED | exit 0, schema+data+checksums identical | — |
| W2-2 | Restore into separate database (PG16) | W1-3 | VERIFIED | exit 0, schema+data identical | — |
| W2-3 | Application runs against restored database | W2-1, W2-2 | VERIFIED | health 200, login 200, `/me` 200, `/api/deadlines` 200 | — |
| W2-4 | Restore failure paths | W2-1 | PARTIALLY VERIFIED | invalid archive exit 2, unsafe target exit 2; exit 4/5 branches not reachable here | trigger on hosted staging |
| W2-5 | Off-site backup destination | W2-1 | BLOCKED | none authorised | decide provider in W4 |
| W3-1 | Consolidated readiness report | W1, W2 | VERIFIED | `docs/audit/ELEKEZA_DATABASE_AND_STAGING_READINESS.md` | — |
| W3-2 | Executive register | W1, W2 | VERIFIED | `docs/audit/ELEKEZA_READINESS_REGISTER.md` | — |
| W4-1 | Hosting architecture recommendation | W3 | VERIFIED | `docs/operations/ELEKEZA_HOSTED_STAGING_ARCHITECTURE.md` | — |
| W4-2 | Staging configuration templates (no secrets) | W4-1 | VERIFIED | `docs/operations/ELEKEZA_STAGING_ENV_TEMPLATE.env` | — |
| W4-3 | Provision hosted staging (compute, DB, TLS, DNS) | W4-2 + authorization + paid account | **BLOCKED** | no provider credentials, no approval to create paid resources or change DNS | obtain approval, then execute §Provisioning of the architecture doc |
| W4-4 | Hosted staging acceptance tests | W4-3 | NOT STARTED | — | after W4-3 |
| W5-1 | Product and scope audit | W3 | VERIFIED | `docs/audit/ELEKEZA_PRE_PILOT_AUDIT.md` | — |
| W5-2 | Role and authorization audit | W3 | PARTIALLY VERIFIED | code + tests + PG16 contract; no hosted environment | re-run on staging |
| W5-3 | Accessibility audit | W3 | PARTIALLY VERIFIED | features present in code; no WCAG/assistive-technology assessment | schedule specialist assessment |
| W5-4 | Security and privacy audit | W3 | PARTIALLY VERIFIED | code review + existing reports; no penetration test; no legal review | commission both before real learner data |
| W5-5 | Performance and reliability | W3 | PARTIALLY VERIFIED | startup/latency on developer hardware only; no load test | measure on staging with realistic data |
| W5-6 | Integration readiness | W3 | PARTIALLY VERIFIED | mock providers confirmed in code; sandbox calls not executed (no credentials) | sandbox verification |
| W5-7 | Pilot readiness matrix | W5 | VERIFIED | `docs/audit/ELEKEZA_PILOT_READINESS_MATRIX.md` | — |
| W6-1 | Validation materials and plans | W5 | VERIFIED | `docs/pilot/*` | — |
| W6-2 | School contact and discovery sessions | W6-1 + explicit authorization | **NOT STARTED (not authorized)** | — | requires founder approval and a named school |
| W6-3 | Guardian validation sessions | W6-2 | **NOT STARTED (not authorized)** | — | follows W6-2 |
| W6-4 | Learner testing | W6-3 + consent + safeguarding | **NOT STARTED (not authorized)** | — | follows approvals |
| W7-1 | Controlled pilot proposal | W5, W6-1 | VERIFIED (document) | `docs/pilot/ELEKEZA_CONTROLLED_PILOT_PROPOSAL.md` | approval needed to execute |
| W7-2 | Pilot readiness decision | all | VERIFIED | `docs/audit/ELEKEZA_END_TO_END_PRE_PILOT_READINESS.md` | — |

---

## Baseline captured at W0-1

- Repository: `C:\Users\thrillerpark\Desktop\Flagship Projects\Elekeza`, branch `sprint-3-safe-config`, HEAD `47d17f5`.
- Working tree: 22 modified, 2 staged, 21 untracked — **all pre-existing user work, preserved untouched**.
- 4 stashes intact.
- Recent commits: `47d17f5 fix(elekeza): make guardian messaging accessible and verify delivery` … `c56df6b`, `60265f5`, `c311ce6`, `cca0706`.
- Scripts present: `db-backup.sh`, `db-restore-drill.sh`, `staging-gate.sh`, `reset-preview.sh`.
- No `docs/operations/` or `docs/pilot/` existed before this programme.
- Local databases: PostgreSQL 15.17 on `localhost:5433` (shared cluster, 28 databases) plus a disposable PostgreSQL 16.16 container on `127.0.0.1:5434` created for verification and removed afterwards.
- Deployment target per `docker-compose.yml`: `postgres:16-alpine`, plus redis, backend (Spring Boot), ai-service (FastAPI), frontend (Next.js), nginx with optional TLS override.

## Changes made (this programme)

| File | Change |
|---|---|
| `scripts/lib/pg-client.sh` | **new** — server-version-aware client discovery |
| `scripts/db-backup.sh` | repaired: discovery, preflight, partial-file safety, exit codes, `--docker` mode |
| `scripts/db-restore-drill.sh` | repaired: same, plus archive pre-check, target-name guard, stronger verification |
| `docs/operations/*`, `docs/audit/*`, `docs/pilot/*` | new documents listed above |

No application source, migration, security control, dependency or configuration was modified in this programme.

## Cross-cutting blockers

1. **Hosted staging (W4-3)** — needs an account, payment method, DNS control and explicit approval. Not assumed.
2. **School/guardian contact (W6-2, W6-3)** — needs founder authorisation and a named partner school. Not assumed; no messages were sent.
3. **Child-data legal review** — Kenya Data Protection Act obligations for minors' data need a qualified reviewer. A technical audit is not legal certification.
4. **Accessibility certification** — requires a specialist assessment with assistive technology; not performed.
