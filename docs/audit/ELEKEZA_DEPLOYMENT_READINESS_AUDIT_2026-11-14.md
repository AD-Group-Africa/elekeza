# ELEKEZA — DEPLOYMENT READINESS (DATED AUDIT ADDENDUM)

**Date:** 14 Nov 2026 · **Branch:** `sprint-3-safe-config` @ `47d17f5`
**Status:** **NOT READY to deploy.** Infrastructure is largely written; nothing is configured, and four defects would ship with it.

> **Preservation note.** The canonical document remains `docs/audit/ELEKEZA_DEPLOYMENT_READINESS.md` (5 Nov, re-verified 8 Nov). It was **not modified**. This file is the dated 14 Nov addendum: it records what changed, what is newly found, and what a deployment checklist must contain. Where the two disagree, treat this one as newer but verify against the repo.

---

## 1. Honest status ladder

| Level | Status | Evidence |
|---|---|---|
| Runs locally | **YES** | backend builds and its 357 tests pass (this session); frontend type-checks clean; AI service code runs |
| Staging deployed | **NO** | no host, no DNS, no TLS, no environment |
| Production configured | **NO** | `.env` contract exists; no production secrets supplied |
| Production deployed | **NO** | — |
| Production verified | **NO** | — |

Nothing in this session changed any of those. No deployment, no push, no environment was touched.

---

## 2. What exists (verified in repo, not deployed)

- `docker-compose.yml` — postgres 16, redis 7, backend, ai-service, frontend, nginx; healthchecks on all services; resource limits; log rotation; **no inline secret defaults** (good).
- `docker-compose.tls.yml` + `infrastructure/nginx/templates/nginx.conf.template`.
- `infrastructure/nginx/nginx.conf` — HTTP→HTTPS redirect, TLS 1.2/1.3, HSTS, `X-Frame-Options`, `nosniff`, `Referrer-Policy`, gzip, 120 s API timeout, immutable `/_next/static`, no-cache `/sw.js`.
- Flyway owns the schema: `V1`–`V19`, with `ddl-auto: validate` in prod (correct — schema is migration-owned, not Hibernate-owned).
- `scripts/db-backup.sh`, `scripts/db-restore-drill.sh`, `scripts/staging-gate.sh`, `scripts/reset-preview.sh`.
- CI: `.github/workflows/ci.yml` (backend/frontend/E2E/AI jobs) and a GitLab CI mirror with Trivy.
- Fail-fast guards described in the canonical doc: required `NEXT_PUBLIC_API_URL` for prod build, required `CORS_ALLOWED_ORIGINS`, `SECURE_COOKIES`, demo seed off for prod/docker.
- `V19__feature_flag_overrides.sql` — a feature-flag table exists, which is the right place to hide `/government` and `/marketplace` in a pilot build.

---

## 3. New findings this session

### DEP-P0-01 — The demo-seed default is inverted on the base profile
`application.yaml` sets `demoSeedEnabled: "TRUE"`; `prod` and `docker` override to `FALSE`. Any run that does not activate one of those two profiles creates a platform super-admin whose password is committed in `V2__seed_demo.sql`. See `ELEKEZA_SECURITY_AUDIT.md` SEC-P0-03 for reproduction and fix.

**Deployment consequence:** a misconfigured `SPRING_PROFILES_ACTIVE` is not a degraded start — it is an open platform administrator account.

### DEP-P1-01 — nginx drops security headers on exactly the responses that matter
`add_header` is not inherited when a `location` block declares its own. `/sw.js` and `/_next/static/` each set `Cache-Control`, so those responses lose HSTS, `X-Frame-Options`, `nosniff` and `Referrer-Policy`. Fix with a shared `include security-headers.conf` repeated in each location, or by removing per-location `add_header` in favour of `expires`/proxy headers that do not reset the set.

### DEP-P1-02 — No monitoring, no error tracking, no alerting
`SENTRY_DSN` is optional and unset; there is no uptime check, no log aggregation, no alert on 5xx rate, no alert on the M-Pesa callback failing, no alert on AI provider latency. `actuator/health` exists and is proxied — that is the entire observability surface.

**For a pilot with real children's data, "we will notice if it breaks because someone tells us" is not adequate.** Minimum: uptime probe on `/actuator/health`, Sentry (or equivalent) on backend + frontend + AI, one alert per critical path (login, tutor, payment callback), and a named on-call person for pilot hours.

### DEP-P1-03 — No real-PostgreSQL verification of migrations
Backend tests use H2 in PostgreSQL mode. `V2` warns that its checksum changed. `backend/flyway-validation/` exists but is untracked and un-reviewed. Deploying to a Postgres 16 container that has never run these migrations is an unverified step. Add a staging gate that boots postgres:16, runs Flyway from scratch, and runs the suite against it.

### DEP-P2-01 — Backup target and restore drill are scripted but not scheduled
Scripts exist; nothing in the repo schedules them, and there is no off-site target (the canonical doc lists this as blocker #5). A backup on the same host as the database is not a backup.

### DEP-P2-02 — Single-host compose has no zero-downtime story and no rollback artefact
`IMAGE_TAG` supports pinned images (good), but there is no documented rollback runbook beyond "redeploy the previous tag", no `flyway` reverse-migration policy, and no smoke test to run after either.

### DEP-P2-03 — Deployment is not reproducible from a clean clone on Windows
`next.config.ts` in the working tree currently carries a UTF-8 BOM and mojibake from a Windows encoding round-trip, and `application-dev.yaml` has local-LAN edits plus a `.bak` file beside it. These indicate hand-editing directly in deployment config. Commit normalised UTF-8 and keep environment specifics in `.env`, not in tracked config.

---

## 4. Recommended domain architecture

Do **not** purchase anything without approval; this is the shape to approve.

| Host | Purpose | Notes |
|---|---|---|
| `elekeza.app` | Public marketing/website (Phase Thirteen) | Static or Next, separate from the app |
| `app.elekeza.app` | The learning application | Learner + guardian + teacher in one origin; role is server-derived |
| `api.elekeza.app` | Backend API | Only if the frontend is not served from the same origin |
| `admin.elekeza.app` | Optional separate admin origin | **Recommended** once the admin role split lands: a distinct origin lets you apply a stricter CSP, MFA session policy and IP allowlist without weakening the learner surface |
| — | AI service | **Remain internal.** No public DNS; reachable only on the compose network with `X-Internal-Key` (already fail-closed). Do not expose it. |

**Same-origin recommendation:** serve the app and `/api` from one origin for the pilot (compose already does this behind nginx). It removes CORS and cookie-domain complexity, and it is the configuration that has actually been tested.

---

## 5. Deployment checklist

### Staging (first target — not public)
1. Provision one VPS (2 vCPU / 4 GB is realistic for compose + Postgres + AI in mock mode).
2. DNS A/AAAA for `staging.elekeza.app`; do not point production names yet.
3. Obtain TLS via certbot for the staging name only.
4. Generate fresh secrets: `JWT_SECRET` (≥32 random bytes), `AI_INTERNAL_SECRET`, `DB_PASSWORD`, `REDIS_PASSWORD`. None may be reused from dev.
5. `DEMO_SEED_ENABLED=false` and `SPRING_PROFILES_ACTIVE=docker` **explicitly**, and verify the boot log shows seeding disabled.
6. Run `scripts/staging-gate.sh`: fresh Postgres 16, Flyway from zero, backend suite against it.
7. Smoke: health, login, learner journey, guardian messaging, teacher attendance, admin staff list.
8. Confirm HSTS/nosniff present on `/sw.js` and `/_next/static/` responses (DEP-P1-01).
9. Wire Sentry + uptime probe; confirm an induced 500 appears in the tracker.

### Pilot (controlled — named schools only, no real child data until the DPIA exists)
10. Only after `ELEKEZA_SECURITY_AUDIT.md` SEC-P0-01/02 are closed, or with a written decision to pilot using synthetic learner data.
11. Real TLS for the pilot hostname; HSTS with a short max-age first.
12. Backups: off-site target, nightly, restore drill executed once and recorded with timings.
13. Rate limits confirmed behind nginx (see SEC-P1-03 — `remoteAddr` is the proxy).
14. Incident runbook: who is called, how a learner account is frozen, how data is exported for a school.
15. Rollback rehearsed: redeploy previous `IMAGE_TAG`, confirm schema compatibility.

### Production
16. Only after the pilot exit criteria in `ELEKEZA_PILOT_READINESS_SCORECARD.md` are met.
17. MFA for `SUPER_ADMIN`; provisioning procedure documented and audited (role matrix §6).
18. DPA artefacts published; ODPC registration complete; processor agreements signed.
19. Monitoring, alerting, on-call roster, and a tested breach-notification path.

---

## 6. Blockers, ranked (unchanged where still true)

| # | Blocker | Owner | Unlock |
|---|---|---|---|
| 1 | Demo-seed default inverted (DEP-P0-01) | Engineering | code change, no external dependency |
| 2 | Host + domain + DNS decision | Harrison | purchase/selection approval |
| 3 | TLS certificates | Engineering | #2 |
| 4 | Production secrets (JWT, AI, DB, Redis, Groq, M-Pesa, SMS, SMTP, R2) | Harrison | credential issuance |
| 5 | M-Pesa public HTTPS callback | Engineering | #2–#4 |
| 6 | Monitoring + alerting | either | account |
| 7 | Off-site backup target | Harrison | storage decision |
| 8 | Data-protection artefacts (privacy policy, DPIA, consent) | Harrison + legal | external advice |

**Items 1 and 6 are entirely within engineering's control and should not wait for the domain decision.**
