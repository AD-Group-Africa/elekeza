# PILOT RUNBOOK — Elekeza

Operational guide for running the controlled pilot. Companion docs:
`PILOT_READINESS.md` (verdict), `PILOT_PLAN.md` (scope), `DEPLOYMENT_RUNBOOK.md` (hosting).

## 1. Deployment shape

```
Pilot school users (browser / tablet / phone)
        │  HTTPS
        ▼
Next.js frontend (static build, `next start`)
        │  same-origin /api/* (rewrite)
        ▼
Spring Boot backend (prod profile, boot JAR)
        │  Flyway-managed
        ▼
PostgreSQL 15 (verified V1–V12 from empty DB)
```

The production artifact path is exercised end-to-end by `scripts/staging-gate.sh`
(prod build → fresh PG migrations → boot JAR with fail-fast env → `next start` →
smoke checks). Verified green 2026-09-17.

## 2. Required environment (prod profile — fail-fast if missing)

| Variable | Notes |
| --- | --- |
| `DB_URL` / `DB_USER` / `DB_PASSWORD` | PostgreSQL JDBC URL + credentials |
| `JWT_SECRET` | 32+ random chars (`openssl rand -base64 48`) |
| `AI_INTERNAL_SECRET` | shared with AI service (mock AI still needs it) |
| `CORS_ALLOWED_ORIGINS` | exact frontend origin(s), no wildcard |
| `FRONTEND_URL` | absolute frontend origin |
| `NEXT_PUBLIC_API_URL` | backend origin, baked in at `next build` time |
| `MPESA_ENVIRONMENT` + `MPESA_CONSUMER_KEY/SECRET` | only if enabling sandbox; else omit → mock mode with honest UI flag |

## 3. Daily operations

**Boot order:** PostgreSQL → backend JAR → frontend. Health check:
`GET /actuator/health` on the backend (200 expected; disk-space indicator may report
DOWN on constrained hosts — DB and web remain healthy).

**Seeding:** dev profile seeds demo data automatically (deterministic, idempotent).
Prod profile seeds only the V2 Flyway demo accounts (5 users incl.
`superadmin@elekeza.app`). For a pilot school, create real users via admin onboarding
(`/school/onboarding` → creates SCHOOL_ADMIN → enroll learners).

**Backups:** nightly `pg_dump` before any migration day; test one restore before
launch (pre-launch gate #3 in `PILOT_READINESS.md`).

**Logs:** backend logs to stdout (capture with the service manager); audit trail rows
in `audit_log` (admin-readable, `AuditLogService`).

## 4. Pilot-week escalation map

| Symptom | First check | Escalation |
| --- | --- | --- |
| Login 429 | rate limiter (5/min/IP) — expected under shared NAT; wait or allowlist | infra |
| "M-Pesa is not configured" | expected in mock mode; do not "fix" by adding prod keys without checklist | owner |
| Page blank after deploy | hard refresh (stale chunk); verify `NEXT_PUBLIC_API_URL` baked into build | release eng |
| Slow first route load | Next dev on-demand compile — use the production build for pilots | infra |
| Data looks wrong | check institution boundary of the logged-in account first (tenant scoping) | eng |

## 5. Known honest limitations during pilot

- M-Pesa mock mode (no real money) — labelled in UI
- Assignment submissions are text-only (file upload on backlog)
- SMS/email providers are mock unless real credentials supplied
- AI is the deterministic mock client unless a valid provider key is configured

## 6. Rollback

Backend: keep the previous boot JAR; Flyway migrations are forward-only —
never downgrade the DB. Frontend: keep the previous `.next` build directory and
restart. Document every rollback in the pilot log.
