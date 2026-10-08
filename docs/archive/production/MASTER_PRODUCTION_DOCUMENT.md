# Elekeza — Master Production Document

**Status date:** 2026-09-30 · **Release baseline:** `v0.1.0-pilot-r2` (commit `b139b8e`) · **AI provider:** Groq (`qwen/qwen3.8-27b`, Gates A–H GREEN)

This is the canonical operations document. It supersedes the scattered legacy
reports in `docs/production/` and `docs/acceptance/` (notably
`FINAL_ACCEPTANCE_GATE.md`, whose "25 pass / 18 context failures" baseline is
stale). Point-in-time acceptance evidence lives in
[`ELEKEZA_COMPLETION_STATUS.md`](../../ELEKEZA_COMPLETION_STATUS.md) at the repo root.

Classification used throughout: **GREEN** = verified with evidence ·
**YELLOW** = works, needs external/manual verification ·
**RED** = broken/blocking · **GREY** = not implemented.

---

## 1. System architecture (verified)

| Component | Stack | Entry point |
|---|---|---|
| Backend | Kotlin / Spring Boot 3.2.4, Java 17, Flyway V1–V15, PostgreSQL | `backend/build/libs/elekeza-backend-0.0.1-SNAPSHOT.jar` |
| AI service | Python FastAPI, Groq via `ai_client.py` | `ai-elewa/main.py` (port 8000, `X-Internal-Key` auth) |
| Frontend | Next.js 16.3.3 / React 19 / PWA (webpack build) | `frontend/` (`npm run build` → `npm run start`) |
| Edge | nginx (TLS via `docker-compose.tls.yml`) | `infrastructure/nginx` |
| Orchestration | `docker-compose.yml` (backend/ai-service/frontend/postgres:16/redis/nginx) | root |

## 2. Verified state per subsystem (2026-09-30 audit)

### 2.1 Backend test baseline — GREEN
40 test classes, **278 tests, 0 failures, 0 errors** (`./gradlew.bat test`,
full suite, fresh run after the email/SMS fixes). 63 of these are dedicated
security/authorization tests (multi-tenant isolation, RBAC, IDOR negatives,
input security, content upload security).

### 2.2 M-Pesa / Daraja — GREEN code, YELLOW activation
- Real integration exists: `payments/MpesaService.kt` (OAuth, STK push, query), defensive callback state machine (`INITIATED → COMPLETED|FAILED`, terminal-no-reopen, duplicate-callback idempotency, amount-mismatch rejection, unknown-id rejection), finance mapping via `MpesaPaymentListener` (idempotent, reference `ELEKEZA-FEES-<learnerId>`).
- Mode selection: `fees.mpesa-mode` mock|live (`finance/MpesaGateway.kt`); live+missing creds → honest 503.
- Tests: 24 payment/finance tests green (6 end-to-end callback, 6 callback unit, 12 finance API).
- **YELLOW (human):** real Daraja credentials, public callback URL, sandbox→production STK test. Live callback signature verification at the edge must be enabled at the proxy (documented in code).

### 2.3 SMS — GREEN code, YELLOW activation
- `SmsProvider` + mock default; `AfricaTalkingSmsProvider` real HTTP (fail-fast on blank key — fixed 2026-09-30; previously faked a mock message ID).
- `NotificationService` dispatches on guardian quiz-complete / teacher support-flag / student assignment; per-recipient failure isolation (fixed 2026-09-30 — one guardian's provider error no longer aborts the rest).
- No retry queue (provider retries are the provider's responsibility — documented); rate limiting is provider-side.
- **YELLOW (human):** Africa's Talking API key + sender ID; real handset test.

### 2.4 Email — GREEN code, YELLOW activation
- `JavaMailEmailProvider.send()` now transports real SMTP mail (plain text, fail-honest: invalid address → `false` without touching the server; transport failure → logged (exception class + trimmed message, recipient masked) → `false`). Previously logged-only and returned `true` — **fixed + 4 unit tests** 2026-09-30.
- Callers: password reset (`AuthService.forgotPassword` → 500 on failure, no enumeration), staff invitations ×2.
- **YELLOW (human):** SMTP credentials (`MAIL_HOST/PORT/USERNAME/PASSWORD`), inbox receipt test for all six flows.

### 2.5 Storage — GREY (dead abstraction), local-disk path GREEN
- **`StorageProvider` has zero consumers** — `CloudflareR2Provider` (all seven operations no-op even when "configured") is dead code; no AWS SDK dependency. Adding an SDK to wire dead code was deliberately rejected (smallest-change discipline).
- The real upload path is local disk under `uploads/` with role gating (TEACHER/SCHOOL_ADMIN/ADMIN), 10 MB cap, extension allowlist, traversal-safe UUID+flat-name storage.
- **Decision required (Harry):** wire R2 with the AWS SDK *and* give it a consumer, or delete the abstraction and keep local-disk + volume backups. **Blocker for multi-instance deploys either way** (local disk is not shared).

### 2.6 Backup / restore — GREEN (drilled)
- `scripts/db-backup.sh`: custom-format dump + `pg_restore --list` verification + 7-copy retention. **Ran for real:** `backups/drill/elekeza_pilot_gate_wp6.dump` (148 KB, 86 table definitions).
- `scripts/db-restore-drill.sh`: **PASSED** — restored to disposable DB, counts matched source exactly (institutions=1, users=5, flyway=12), drill DB dropped.
- Finding: a dump from an older migration vintage fails Flyway checksum validation when restored into a newer build → run `flyway repair` (or restore-into-fresh + replay data) when migration files changed after the backup. Now documented; drill scripts unchanged.

### 2.7 Security & tenant isolation — GREEN (63 tests + live probes)
Live probes on 2026-09-30 (fresh-built jar, fresh PostgreSQL DB, prod-path env):
- Unauthenticated API → 403; forged JWT → 403; unknown user vs wrong password → identical 401 (no enumeration).
- CSRF: cookie-token design; `GET /api/auth/csrf` materializes the token; POST without token → 403, with token → 200.
- Rate limiting live-verified: 5×401 then **429** on further login attempts (config: 5/60s).
- `actuator/env`, `actuator/metrics` → 403 (no secret/config leak); actuator exposure limited to `health`; `show-details: never`.
- Error hygiene: `GlobalExceptionHandler` maps all known failure classes to safe 4xx bodies; catch-all 500 returns a generic message (no stack traces).
- Audit logging verified end-to-end: `BILLING_SUBSCRIPTION_STARTED user=5 [BILLING] institution=1 plan=STARTER` written to `audit_logs`; scheduled purge in place.
- Institution-scoped endpoints enforce ownership: SCHOOL_ADMIN without `institution_id` correctly denied (`403 Not authorized for this institution`).
- Gaps (non-blocking, noted): logins are not audit-logged; `INTERNAL_SECRET` in `ai-elewa/security.py` defaults to `""` (fail-open if unset) — set it explicitly in every environment.

### 2.8 E2E journeys — GREEN
Playwright, 1 worker, production-path (built boot JAR + Next dev proxy): **31/31 passed in 10.6 min**, including learner journey (home → lesson → read → quiz → score → progress), teacher learners/support/progress, guardian ward access **and IDOR negative** ("a guardian cannot open another guardian's ward"), forgot-password enumeration protection, a11y (skip link/landmarks), offline, and teacher/guardian route crawls. Run: `cd frontend && E2E_BACKEND_PORT=8095 E2E_FRONTEND_PORT=3100 npx playwright test`.

### 2.9 Deployment readiness — GREEN (gated)
`scripts/staging-gate.sh` (fixed 2026-09-30: robust `npm run start`, working CSRF fetch, gate-only `DEMO_SEED_ENABLED=true`): **GATE PASSED** — bootJar → production frontend build (59 routes) → fresh PG DB → prod-profile backend ("Successfully applied 15 migrations", Hibernate validate OK, health 200) → prod frontend 200 → **login round-trip 200** → teardown.
Compose deployment path: `docker compose config` VALID; backend healthcheck now installable (`curl` added to the JRE image); all provider selectors + Daraja credentials + `DEMO_SEED_ENABLED` are now passed into the backend container (they were silently missing — a compose deploy would have run mock SMS/email and mock fee payments regardless of `.env`). Operators must create root `.env` from `.env.example`.

### 2.10 Monitoring/observability — GREY/YELLOW
- Present: actuator health (details hidden), structured logging dep (unused logback config), audit_logs with purge, PWA/FastRefresh noise isolated in dev.
- Missing: metrics endpoint (no Micrometer registry dep), error tracking (Sentry DSN plumbed in compose but no SDK wired), alerting, access/log aggregation. Frontend behavior is observable only via server logs.

## 3. Deployment procedure (summary)

1. Provision host with Docker + Docker Compose; DNS/TLS per `docker-compose.tls.yml`.
2. `cp .env.example .env` and fill **all** values (JWT_SECRET ≥32 chars, AI_INTERNAL_SECRET, DB_*, CORS_ALLOWED_ORIGINS, FRONTEND_URL, provider creds as activated). **Never** set `DEMO_SEED_ENABLED=true` on an internet-facing host.
3. `docker compose build && docker compose up -d`; verify `docker compose ps` (all healthy) and backend log line `Successfully applied 15 migrations`.
4. Smoke: `GET /health` (ai-service), `GET /actuator/health` (backend), frontend `/login` 200, login round-trip.
5. Backups: cron `scripts/db-backup.sh` (PGPASSWORD required); quarterly `scripts/db-restore-drill.sh`.

## 4. Human checkpoints (all require Harry — none fabricated)

| # | Item | Unblocks |
|---|---|---|
| 1 | Push tag `v0.1.0-pilot-r2` + branch to origin (currently local-only) | Release publication |
| 2 | Daraja consumer key/secret/passkey/shortcode + public callback URL + one real STK payment | M-Pesa live |
| 3 | Africa's Talking API key + sender ID + one real SMS | SMS live |
| 4 | SMTP credentials + inbox receipt test | Email live |
| 5 | R2 decision (wire-with-SDK vs delete-abstraction) + bucket/keys | Storage direction |
| 6 | Domain/DNS/TLS ownership | Go-live |
| 7 | Sentry DSN (backend + AI + frontend) and monitoring choice | Observability |
| 8 | Legal/business: data protection (Kenya DPA 2019), provider contracts | Pilot launch |
| 9 | Manual UI acceptance pass on real devices | Pilot launch |

## 5. Known non-blocking gaps

- Quiz completion / login events are not audit-logged (domain actions are).
- No metrics/alerting stack (§2.10).
- Adaptive AI latency observed at ~1.17 s vs 800 ms target (r2 evidence).
- Groq 429 quota strategy is retry-and-fail-open-to-learner-fallback (structured envelope); no queue.
- Compose `mpesa_transactions` rows carry no `institution_id` (revenue endpoint is platform-ADMIN-only, so no tenant leak today — tag by institution when multi-tenant billing lands).
