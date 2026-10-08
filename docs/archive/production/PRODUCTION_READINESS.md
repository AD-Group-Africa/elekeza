# Elekeza — Production Readiness

> Status date: 2026-09-06 · Verified from the actual repository (commands + live probes, not prior reports).
> Verdict: **READY WITH EXTERNAL CONFIG** — no code blockers; specific credentials/infrastructure remain external.

## COMPLETE (verified this release)

| Area | Evidence |
| --- | --- |
| Backend build & tests | `./gradlew test` — **128/128 passing** (auth, RBAC, tenant isolation, M-Pesa callback chain, guardian relationships, payments) |
| Frontend typecheck / lint / build | `tsc --noEmit` clean · `eslint` 0 errors · `next build` success (all routes) |
| Database migrations | Flyway **V1–V7**, no duplicates/conflicts; fresh-database path proven |
| Authentication | BCrypt hashing, JWT HttpOnly cookies, refresh-token rotation + revocation, logout kills session & refresh token (live-verified: `/me` → 401 after logout) |
| Authorization | Server-side `@PreAuthorize` + filter rules on every protected surface; roles STUDENT / GUARDIAN / TEACHER / SCHOOL_ADMIN / ADMIN |
| Tenant isolation | Two-institution IDOR probes blocked (403) across roster/profile/adaptation/support (40-check live journey) |
| Guardian model | Role GUARDIAN + relationship (PARENT / CAREGIVER / OLDER_SIBLING / LEGAL_GUARDIAN / OTHER), multi-guardian, multi-learner, server-scoped |
| Payments — M-Pesa | Single ledger (`mpesa_transactions`), state machine INITIATED/PENDING → COMPLETED/FAILED (terminal), callback amount-binding, duplicate/replay rejection, CSRF-exempt server-to-server endpoint — 6 end-to-end tests through the real Spring Security chain |
| Notifications | In-app channel live; ownership-enforced; provider abstraction (mock / SMTP / Africa's Talking) |
| Storage | Provider abstraction (mock / Cloudflare R2); upload authorization enforced |
| AI service | Separate FastAPI service (`ai-elewa/`), fails fast on missing `AI_API_KEY`, deterministic fallback — AI never gates auth/payments/exams |
| Security sweep | No TODO/FIXME markers in either codebase · no hardcoded secrets · `permitAll` limited to intended public endpoints (incl. CSRF-exempt M-Pesa callback) · no fabricated dashboards (competency fabrication & mock AI-tutor response removed) |
| Docker | `docker-compose.yml` (postgres, redis, backend, frontend, ai) + Dockerfiles present |
| Documentation | README (setup/env/deployment), `docs/production/*`, `docs/demo/*` (accounts, script, runbook, troubleshooting) |

## EXTERNAL CREDENTIALS REQUIRED (config-only activation)

These are **not code gaps**. Each feature is implemented behind a provider switch in `.env`.

| Credential | Unlocks | Env |
| --- | --- | --- |
| M-Pesa Daraja (consumer key/secret, passkey, shortcode, public callback URL) | Live STK-Push payments | `MPESA_CONSUMER_KEY`, `MPESA_CONSUMER_SECRET`, `MPESA_PASSKEY`, `MPESA_SHORTCODE`, `MPESA_CALLBACK_URL` |
| Groq API key | Real AI adaptation (deterministic mock is the safe fallback) | `AI_API_KEY` |
| SMTP credentials | Real email delivery | `EMAIL_PROVIDER=javamail` + `MAIL_*` |
| Africa's Talking key | Real SMS delivery | `SMS_PROVIDER=africa_talking` + `AFRICA_TALKING_*` |
| Cloudflare R2 keys | Durable file storage (mock is in-memory only) | `STORAGE_PROVIDER=cloudflare_r2` + `CLOUDFLARE_R2_*` |
| Google OAuth secret | Social login | `GOOGLE_CLIENT_ID/SECRET` |

## MANUAL CONFIGURATION REQUIRED

- Production secrets live in the platform secret store (Fly.io/Netlify), never in git. Template: `.env.example`.
- `NEXT_PUBLIC_API_URL` must be set **at frontend build time** (it is the server-side proxy target); the browser client stays same-origin `/api`.
- Set `CORS_ALLOWED_ORIGINS`, `FRONTEND_URL`, `SECURE_COOKIES=true` for production.
- Safaricom strongly recommends enabling **provider signature verification at the edge** in front of `/api/payments/callback` in production (handler is defensive; edge validation closes the final gap).
- Schedule the M-Pesa **status-query reconciliation job** (`/mpesa/stkpushquery/v1/query`) on a timer for transactions stuck in PENDING >2 min (endpoint verified, cron wiring is deployment-level).
- Database backups per `docs/production/backup-and-recovery.md` (mechanism verified).

## DEFERRED (explicitly out of this release)

- **Exams/CBT module** — the `/exam` route is an honest `Coming Soon` screen; no fake exam logic exists anywhere. Quiz/assessment scoring is server-authoritative today.
- **Card / international payments** — payments are M-Pesa-first with a single ledger; a `PaymentProvider` abstraction should be introduced *when* a card provider is contracted (do not build against air).
- **USD pricing** — deferred until there is international demand; ledger records amounts without currency assumptions (amount only, KES operational).
- **Payroll** — not present in the codebase; deliberately not invented. Belongs to the post-pilot School-ERP expansion (`docs/production/POST_PILOT_ROADMAP.md`).
- **WhatsApp channel** — no integration; not claimed.
- **"Ask Elekeza" natural-language school intelligence** — AI tutor is honest fallback; school-analytics NL layer is future work.

## KNOWN LIMITATIONS

- Browser exam lockdown cannot be absolute (moot until the exams module ships).
- Dev profile uses H2 in-memory (JPA-created schema); production uses PostgreSQL + Flyway `validate`. The duplicate-admin constraint exists in both (entity-level + service-level 409).
- Login rate limiting is in-process (per-instance); horizontal deployments should front it with a shared limiter.
- 22 lint warnings remain (0 errors) — cosmetic `react-hooks/exhaustive-deps` items.

## FINAL PACKAGE COMMANDS

```bash
# Backend
cd backend && ./gradlew clean build            # tests + bootJar

# Frontend (NEXT_PUBLIC_API_URL required at build time)
cd frontend && NEXT_PUBLIC_API_URL=<backend-url> npm ci && npm run build && npm start

# Database (managed Postgres 16) — Flyway V1–V7 applied by backend on boot (validate mode)

# Full stack locally
docker compose up -d --build
```
