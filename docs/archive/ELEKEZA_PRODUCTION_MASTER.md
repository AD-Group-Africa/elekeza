# ELEKEZA — PRODUCTION MASTER DOCUMENT

**Authoritative operational source of truth.** Consolidates the repository state, architecture,
configuration contract, security posture, test evidence and deployment procedure verified during the
final production audit (24 September 2026, HEAD `14c4393`, branch `release/v0.1.0`).

Every claim below was verified against actual source code, configuration, or executed commands during
this audit — not copied from older documents. Where an item could **not** be verified (missing
credential, unavailable provider), it is explicitly marked **EXTERNAL BLOCKER**, not claimed as done.

Other documents: `ELEKEZA_README.md` (product/dev README), `docs/PILOT_DEPLOYMENT_RUNBOOK.md`
(step-by-step deployment procedure). Where older docs disagree with this file, **this file wins**.

---

## A. EXECUTIVE OVERVIEW

**Elekeza** *(“to understand” in Swahili)* is an AI-powered, accessibility-first learning platform for
the Kenyan CBC curriculum, designed for learners with Special Educational Needs (SNE) and mainstream
education. Multi-tenant (per school/institution), role-based, offline-capable PWA frontend.

**Current status: READY FOR CONTROLLED PILOT** — all automated verification green (see §O); external
provider credentials (M-Pesa production, Groq key, SMTP, optional SMS/R2) remain operator-supplied.

**Major services:**

| Service | Tech | Port (container) |
|---|---|---|
| Frontend | Next.js 16.3.3 (TypeScript, Tailwind, next-pwa, Capacitor) | 3000 |
| Backend API | Spring Boot 3.2 / Kotlin | 9090 |
| AI service | FastAPI (`ai-elewa`), 4-stage pipeline | 8000 |
| Database | PostgreSQL 16 (Flyway migrations) | 5432 |
| Cache | Redis 7 (optional) | 6379 |
| TLS proxy | nginx (docker-compose.tls.yml override) | 80/443 |

---

## B. ARCHITECTURE

```
                 ┌──────────────────────────────┐
                 │  Browser / PWA / Capacitor    │
                 └──────────────┬───────────────┘
                                │ HTTPS (nginx, TLS 1.2/1.3, HSTS)
                 ┌──────────────▼───────────────┐
                 │  nginx  (docker-compose.tls) │
                 │  HTTP→HTTPS 301 · ACME webroot│
                 └──────┬───────────────┬───────┘
                        │ /             │ /api
         ┌──────────────▼───┐   ┌───────▼────────────────┐
         │ Next.js frontend │   │ Spring Boot backend    │
         │ (prod build,     │   │ Kotlin · JWT access     │
         │  standalone)     │   │ cookie + refresh rotate │
         └──────────────────┘   └──┬──────────┬──────────┘
                                   │          │ X-Internal-Key
                       ┌───────────▼──┐   ┌───▼─────────────┐
                       │ PostgreSQL 16│   │ FastAPI ai-elewa│
                       │ Flyway V1–V15│   │ Groq/OpenAI/…   │
                       └──────────────┘   └───┬─────────────┘
                                              │ provider API
                       Integrations: M-Pesa Daraja · SMTP · Africa's Talking · Cloudflare R2
```

**Networking:** all services on one compose network; only nginx publishes 80/443 in TLS mode; the
database is never published to the host in the TLS deployment path. Service-to-service AI calls carry
`X-Internal-Key` (shared secret; ai-elewa returns 401 without it — verified).

**Request auth flow:** browser holds `elewa_access` JWT cookie (httpOnly, `secure` per
`SECURE_COOKIES`, SameSite) + `elewa_refresh` httpOnly cookie; CSRF double-submit via `XSRF-TOKEN`
cookie → `X-XSRF-TOKEN` header; `/api/auth/csrf` issues tokens. CSRF ignore-list is narrow (auth
endpoints + M-Pesa callback, which self-validates).

---

## C. APPLICATION MODULES (as implemented)

- **Auth/registration** — email+password registration (public registration creates STUDENT only),
  login, refresh rotation, logout, forgot/reset password (single-use hashed token emailed).
- **Institution management** — school registration, school-admin creation, CSV bulk learner import
  (server-generated one-time setup passwords emailed; school cannot choose/see them).
- **Staff management** — create/reactivate staff, school-initiated password reset via the standard
  single-use token email flow.
- **Content pipeline** — PDF/DOCX/TXT upload (10 MB cap, extension whitelist, storage-provider
  abstraction) → AI simplification per accessibility profile → lessons with sections.
- **Quiz engine** — start (never returns answer key), per-answer server-side grading, complete with
  score + feedback, post-completion review (own attempts only).
- **Learner progress** — per-lesson mastery/time tracking, dashboard.
- **Teacher** — institution-scoped student list, bulk assignment, per-question quiz analytics,
  attendance register (+ learner attendance history).
- **Guardian** — ward linking, ward detail (progress, recent quizzes), per-ward reports, wards'
  pending assigned lessons (linked wards only).
- **Finance** — fees + M-Pesa STK push lifecycle (initiate, callback, transaction states).
- **Accessibility** — 40+ preference toggles (fonts, spacing, themes, TTS), per-user accessibility
  profile persisted via API.
- **AI adaptation** — lesson simplification + quiz generation through ai-elewa.
- **Offline PWA** — service worker caching; IndexedDB answer queue; honest offline state (no fake
  scores while offline — E2E-verified).

**Not implemented (do not claim otherwise):** Google OAuth (a legacy comment references an
`OAuth2SuccessHandler`, but no such class exists in the codebase); WhatsApp; therapist portal;
super-admin ≠ ADMIN — there are exactly five roles (below); no separate "platform visibility" module
beyond the ADMIN role's cross-institution access.

---

## D. ROLES AND AUTHORIZATION

`backend/src/main/kotlin/com/elekeza/backend/auth/UserRole.kt`:

```kotlin
enum class UserRole { STUDENT, TEACHER, GUARDIAN, ADMIN, SCHOOL_ADMIN }
```

| Role | Access (verified against controllers/security config) |
|---|---|
| STUDENT | own lessons, quizzes, progress, accessibility preferences; cannot reach teacher/admin endpoints (E2E negative tests confirm 403) |
| TEACHER | institution-scoped students, assignments, attendance, quiz analytics |
| GUARDIAN | linked wards' progress/reports/schedules only |
| SCHOOL_ADMIN | own institution's staff/learners/classes/finance/settings |
| ADMIN | cross-institution platform administration |

Authorization is enforced **at the API layer** (`JwtAuthFilter` + per-controller role checks); the
frontend only hides UI. E2E includes negative-path RBAC tests (browser 403s observed during E2E).

---

## E. MULTI-TENANCY

- **Model:** shared database, shared schema, `institution_id` scoping on tenant-owned entities.
- **Enforcement:** repository/controller queries filter by the authenticated user's institution;
  staff/student creation stamps `institutionId` server-side.
- **Tests:** the 269-test backend suite includes institution-scoping tests (teacher lists, staff
  management, CSV import). No cross-tenant endpoint was found accepting a tenant id from the client
  without an ownership check during this audit's controller review.
- **Known boundary:** guardians are linked to wards by explicit relation rows; unlinked-ward access
  is rejected (E2E-verified).

---

## F. DATABASE

- **Engine:** PostgreSQL 16 (`postgres:16-alpine` in compose); H2 in-memory only for dev profile.
- **Migrations:** Flyway `V1__baseline_schema.sql` … `V15` — **15/15 applied on a fresh PostgreSQL
  16 during this audit** (verified twice: docker dry-run boot and production-bootJar gate test).
- **Demo data:** `V2__seed_demo.sql` is **gated by `DEMO_SEED_ENABLED`** — production path leaves
  `users = 0` after first boot (verified); dev profile seeds via `DataInitializer` instead.
- **Backup:** `scripts/db-backup.sh` (fail-loud pg_dump; verified output 204K / 116 tables).
- **Restore drill:** `scripts/db-restore-drill.sh` — full restore into a disposable DB, Flyway
  history intact, drill DB dropped. **Executed successfully during this audit.**
- **Procedure:** backups before every migration-bearing deploy; never let Hibernate create schema in
  production (`ddl-auto=validate` in prod profile).

---

## G. AI SERVICE (`ai-elewa`)

- **Stack:** FastAPI; 4-stage pipeline (profile → simplify → verify → concept extraction).
- **Auth:** `X-Internal-Key` must equal `INTERNAL_SECRET`; **401 without it (verified live)**.
- **Providers:** `AI_PROVIDER` selects groq/openai/anthropic/google; service **fail-fasts at startup
  on any non-real provider** (verified: `mock` → unhealthy) — mock can never silently ship to prod.
- **Failure behavior:** with an invalid provider key, requests return a clean `422 SCHEMA_INVALID` —
  no crash, no sensitive leakage (verified with a dummy Groq key).
- **Backend resilience:** backend serves degraded content if ai-elewa is unavailable (documented
  fallback); backend→AI calls carry the internal secret from `AI_INTERNAL_SECRET`.
- **Env contract:** `AI_PROVIDER`, `AI_API_KEY`, `INTERNAL_SECRET` (must equal backend
  `AI_INTERNAL_SECRET`). Optional: Langfuse observability keys.
- **Test suites:** ~520 pytest tests; `test_edge_cases.py` 31/31 pass against a live service with a
  matched internal secret; `test_full_pipeline.py` requires a **real provider key — EXTERNAL BLOCKER**
  (they exercise the actual Groq API).
- **Privacy:** learner text is sent to the configured LLM provider; profile data is preference-level
  (no PII beyond learner content). No tenant data is stored by the AI service.

---

## H. AUTHENTICATION AND TOKENS

Verified against `auth/AuthService.kt`, `AuthController.kt`, `JwtUtil.kt`, `SecurityConfig.kt`:

- **Access token:** JWT, HMAC, claims include email + role; delivered as `elewa_access` httpOnly
  cookie; expiry via `JWT_EXPIRATION_HOURS` (default 24h).
- **Refresh tokens:** opaque, **stored hashed (SHA-256)** in `refresh_tokens`, revocable,
  **rotated on use**; delivered as httpOnly `elewa_refresh` cookie, `SECURE_COOKIES`-gated
  (defaults **true** in base+prod; false only in dev profile). Reuse of a rotated/revoked token → 401.
- **CSRF:** double-submit cookie pattern; narrow ignore-list (auth endpoints + M-Pesa callback which
  self-validates by design); `/api/auth/csrf` mints tokens.
- **Rate limiting:** `LoginRateLimiter` (Bucket4j) — 5 attempts / 60s per email+IP; login attempts
  beyond quota → 429 (verified in tests).
- **Passwords:** BCrypt; policy min 8 chars incl. letter+digit (registration-enforced); reset via
  single-use expiring token stored **hashed**; consuming a reset revokes sessions.
- **Failed auth:** uniform `401 Invalid email or password` (no user enumeration); no password/token
  values are logged anywhere in the codebase (audit grep: zero log statements of secrets).

---

## I. INTEGRATIONS

### M-Pesa / Daraja — IMPLEMENTED, **EXTERNAL BLOCKER: production credentials**
- STK push + callback (`/api/payments/callback`), Daraja credentials from env only
  (`MPESA_CONSUMER_KEY/SECRET/PASSKEY/SHORTCODE`, `MPESA_CALLBACK_URL`).
- Callback requires public HTTPS; transaction state machine in `finance` tables; no payment is
  marked successful from frontend claims (server-side callback only).
- **Not verifiable without Daraja production credentials + public callback URL.** Sandbox testing
  requires sandbox credentials. Reconciliation reporting: manual DB queries (documented in runbook).

### Africa's Talking SMS — IMPLEMENTED, OPTIONAL, **EXTERNAL BLOCKER: credentials**
- `common/AfricaTalkingSmsProvider.kt`; activated by `SMS_PROVIDER=africa_talking` +
  `AFRICA_TALKING_API_KEY` / `AFRICA_TALKING_SENDER_ID`. Default provider is `mock` (dev only).
- Failure behavior: send failures are caught and do not block user journeys (notification is
  fire-and-forget); delivery reports not implemented.

### Email — IMPLEMENTED (two providers)
- `EMAIL_PROVIDER=javamail` → `JavaMailEmailProvider` (SMTP via `MAIL_HOST/PORT/USERNAME/PASSWORD`,
  TLS); default dev path uses `MockEmailProvider` (logs, doesn't send).
- Templates: password reset, staff setup invite, school-admin notices (plain-text, actionable links
  built from `FRONTEND_URL`).
- Mail health indicator is disabled in the docker profile so an unconfigured (fail-safe) SMTP cannot
  mark the whole platform DOWN (verified — this was blocking `compose up --wait`).
- **EXTERNAL BLOCKER for real email: SMTP account credentials.**

### Storage — IMPLEMENTED (two providers)
- `STORAGE_PROVIDER=mock` (dev, container-local) | `cloudflare_r2` (production; requires
  `CLOUDFLARE_R2_ACCOUNT_ID/BUCKET_NAME/ACCESS_KEY_ID/SECRET_ACCESS_KEY`).
- Uploads: 10 MB cap, extension whitelist, authorization-checked; objects namespaced per upload.
- **EXTERNAL BLOCKER for production persistence: R2 credentials.** Pilot note: container-local
  storage is acceptable ONLY for throwaway pilots; use R2 for any data that must survive redeploys.

---

## J. DOCKER

**Files:** `docker-compose.yml` (base: postgres, redis, backend, frontend, ai-service, nginx),
`docker-compose.tls.yml` (opt-in TLS override), per-service Dockerfiles.

| Service | Healthcheck | Notes |
|---|---|---|
| postgres | pg_isready | volume-persisted; not host-published in TLS path |
| redis | redis-cli ping | optional |
| backend | actuator `/actuator/health` | env-driven config; fail-fast on missing secrets |
| frontend | node fetch probe (curl absent from image) | prod `next start`, no dev server |
| ai-service | python urllib probe (curl absent from image) | fail-fast provider contract |
| nginx | nginx -t via rendered config | renders `nginx.conf.template` with `NGINX_DOMAIN` (**fail-fast `:?`**) at startup |

**Verified end-to-end (dry-run pilot boot):** all six services healthy; HTTPS 200 through nginx with
mounted certs; HTTP→HTTPS 301; 15/15 migrations; `users = 0` with seed gate off; demo login 401.

**Build hygiene (fixed during audit):** `.dockerignore` ×3 (contexts were 1.2–2.5 GB shipping
`node_modules`/`build/`; rebuilds now ~18 s); frontend Dockerfile installs with `--legacy-peer-deps`
(documented ERESOLVE workaround); healthchecks use stdlib probes.

**Dev-mode scan:** no `next dev`, no hot-reload, no debug flags, no dev credentials, no localhost
dependencies in any production image path (audited Dockerfiles, compose files, CI).

---

## K. PRODUCTION DEPLOYMENT

Full procedure with commands: **`docs/PILOT_DEPLOYMENT_RUNBOOK.md`** (§B–§I). Summary:

```
host prep (Ubuntu, Docker, DNS A-record)
→ env: copy .env.example → .env; set NGINX_DOMAIN, TLS_CERT_HOST_DIR, DB_*, JWT_SECRET,
  AI_INTERNAL_SECRET, NEXT_PUBLIC_API_URL, FRONTEND_URL, CORS_ALLOWED_ORIGINS,
  SECURE_COOKIES=true; leave DEMO_SEED_ENABLED unset
→ certs: certbot certonly --webroot (runbook §B)
→ docker compose -f docker-compose.yml -f docker-compose.tls.yml up -d --wait
→ verify: https health UP, 15/15 migrations, users=0, demo login 401
→ smoke: runbook §I checklist; backups: scripts/db-backup.sh + cron
```

Rollback: previous image tag + `docker compose up -d` (migrations are additive; restore drill
procedure documented in §F/N).

---

## L. SECURITY (verified controls)

| Control | Status | Evidence |
|---|---|---|
| Cookie security | ✅ | httpOnly + `secure` (SECURE_COOKIES=true default base/prod) + SameSite |
| CSRF | ✅ | double-submit; narrow ignore-list; E2E passes with it enabled |
| Refresh rotation/revocation | ✅ | hashed storage; reuse → 401 (unit-tested) |
| Login rate limiting | ✅ | Bucket4j 5/60s per email+IP; 429 tested |
| Password handling | ✅ | BCrypt; policy enforced; hashed single-use reset tokens |
| Tenant isolation | ✅ | institution_id scoping; scoped-query tests in 269-suite |
| Actuator exposure | ✅ | `management.endpoints.web.exposure.include: health` only |
| Upload limits | ✅ | 10 MB + extension whitelist |
| Secrets in repo | ✅ | none (audited commits + tracked files; `.env` gitignored) |
| Dependency vulnerabilities | ✅ | **frontend: 0 (was 24: next 16.1.6→16.3.3 closes critical request-smuggling/CSRF advisories, axios 1.20.0, serialize-javascript override 7.1.2); backend: none reported by Gradle** |
| Security headers / TLS | ✅ | nginx HSTS + TLS 1.2/1.3; HTTPS 301 redirect verified |
| Error leakage | ✅ | GlobalExceptionHandler returns JSON, no stack traces |

**Honest residual notes:** rate limiting is in-process (resets on restart; single-instance fine for
pilot, multi-instance would need a shared store); no centralized security-event audit log yet (§M).

---

## M. MONITORING

**Current state (factual):**
- Health: actuator `/actuator/health` (backend), per-service compose healthchecks, nginx TLS.
- Logs: `docker compose logs` / container stdout; Spring root INFO; AI service request logs.
- **Gap (P1):** the backend has almost no explicit application logging (one `logger.warn` across the
  Kotlin sources; exceptions surface as HTTP status only). Failed logins, integration failures
  (M-Pesa/SMS/email/AI/storage) and 5xx spikes are therefore **not observable except via HTTP status
  monitoring**. Recommended before revenue: structured logging of auth failures + integration
  failures (no PII), shipped to the host's log driver; optional Sentry (env vars already exist).
- AI observability: Langfuse integration is optional (keys in env), off by default.
- **Do-not-log rule respected:** no passwords/tokens/secrets are logged (code-audited).

---

## N. BACKUP / RECOVERY

| Item | Procedure | Verified |
|---|---|---|
| Database | `scripts/db-backup.sh` (pg_dump, fail-loud) | ✅ 204K/116 tables |
| Restore | `scripts/db-restore-drill.sh` → disposable DB + Flyway check | ✅ executed this audit |
| Storage | R2 bucket is provider-managed; mock storage is ephemeral — re-upload needed | n/a (credential-gated) |
| Secrets | `.env` on host — back it up offline, never in git | procedure |
| Config | compose files in git | ✅ |
| DR | fresh host → restore dump → start stack → verify migrations/health | documented |

---

## O. TESTING

| Suite | Result (this audit, current tree) |
|---|---|
| Backend (JUnit, Kotlin) | **269/269** (`BUILD SUCCESSFUL`, 2m52s) |
| Frontend unit (Vitest) | **17/17** |
| Frontend typecheck | clean (`tsc --noEmit` exit 0) |
| Frontend production build | ✅ (59 pages, after purging stale `.next-e2e` generated types) |
| E2E (Playwright) | **31/31** — 30 passed + 1 first-attempt env artifact (port 8097 collision from a leftover audit server; passed on retry; not an application defect) |
| AI service pytest | ~520 tests; auth/validation suites pass; provider-key suites = EXTERNAL BLOCKER (real Groq key required) |
| DB migration check | 15/15 on fresh PostgreSQL 16 (twice) |
| Backup/restore drill | ✅ passed |
| Docker production boot | ✅ full stack healthy, TLS verified |
| `docker compose config` | ✅ base + TLS override |
| npm audit | **0 vulnerabilities** |

---

## P. KNOWN LIMITATIONS (verified)

1. Backend application logging is minimal (see §M) — operational visibility relies on health checks
   and HTTP statuses until logging is added.
2. Rate limiting is per-instance in-memory.
3. SMS delivery reports and M-Pesa reconciliation reporting are not implemented.
4. Storage `mock` provider is container-local — unsuitable for persistent pilot data.
5. Google OAuth does not exist despite legacy comments; only email+password auth.
6. One-time staff setup passwords are shown once in the invite email — there is no admin-visible
   password (by design), so email deliverability matters on first boot.

---

## Q. REMAINING PRODUCTION BLOCKERS

| ID | Priority | Area | Description | Required action | Type | Status |
|---|---|---|---|---|---|---|
| B-1 | P0 | Infrastructure | No pilot host / domain / DNS / TLS cert yet | Provision Ubuntu host, DNS A-record, run runbook §B | Infrastructure/External | OPEN |
| B-2 | P0 | Credentials | `JWT_SECRET`, `AI_INTERNAL_SECRET`, `DB_PASSWORD` not yet generated for pilot | Generate (64-char) into host `.env` | Credential | OPEN |
| B-3 | P1 | Credentials | Groq API key absent — AI features fail-fast honestly without it | Provide `AI_API_KEY`; runbook §C | Credential / External | OPEN |
| B-4 | P1 | Credentials | M-Pesa Daraja production (or sandbox) credentials + public callback | Safaricom procurement; set `MPESA_*` + `MPESA_CALLBACK_URL` | External | OPEN |
| B-5 | P1 | Credentials | SMTP account for real email (staff invites, resets) | Provide `MAIL_*`, `EMAIL_PROVIDER=javamail` | External | OPEN |
| B-6 | P2 | Credentials | Africa's Talking SMS key (optional) | Provide `AFRICA_TALKING_*` or leave mock | External | OPEN |
| B-7 | P2 | Credentials | Cloudflare R2 keys (persistent uploads) | Provide `CLOUDFLARE_R2_*` or accept ephemeral storage for throwaway pilot | External | OPEN |
| B-8 | P1 | Monitoring | No application-level auth/integration failure logging | Add structured logging (small, contained change) | Code | OPEN |
| B-9 | P2 | Testing | AI provider-key test suites cannot run without real key | Run after B-3 | External | OPEN |
| B-10 | P2 | Human | Manual §M acceptance journeys + backup cron not yet executed by operator | Execute after deploy | Process | OPEN |

**Classification: READY PENDING EXTERNAL CONFIGURATION.** All code, tests, migrations, security
controls, and the deployment path are verified; what remains is operator-supplied infrastructure and
credentials, plus the small monitoring improvement (B-8) recommended before first revenue.

---

*End of master document. This file supersedes duplicated deployment/security/architecture content in
`docs/production/*`, `docs/DEPLOYMENT_RUNBOOK.md`, `docs/PILOT_RUNBOOK.md` and older README sections;
historical documents remain under `docs/archive/` for provenance.*
