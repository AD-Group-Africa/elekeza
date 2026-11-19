# ELEKEZA DEPLOYMENT READINESS

**Date:** 5 Nov 2026 · **Re-verified:** 8 Nov 2026 · Source: repo inspection + build/test evidence
**Rule applied:** "runs locally" ≠ "staging deployed" ≠ "production configured" ≠ "verified".

## 1. Honest status ladder

| Level | Status | Evidence |
|---|---|---|
| Runs locally | **YES** | backend dev profile boots from built JAR (:8085/:8090 used by E2E); frontend prod build compiles (67 routes); ai-elewa runs on :8001 with real provider |
| Staging deployed | **NO** | no host, DNS or TLS configured; no environment published |
| Production configured | **NO** | `.env` contract exists; no production secrets injected anywhere |
| Production deployed | **NO** | — |
| Production verified | **NO** | — |

## 2. What exists (verified in repo)

- `docker-compose.yml` — postgres 16, redis, backend, ai-service, frontend, nginx; healthchecks; `.env.example` contract (48 vars).
- `docker-compose.tls.yml` + `infrastructure/nginx/templates/nginx.conf.template` (envsubst) — TLS via Let's Encrypt.
- Flyway owns schema, V1–V19; Hibernate `ddl-auto: validate` in prod; fresh-PG staging gate script (`scripts/staging-gate.sh`) exists (not run this session).
- Backup/restore scripts (`scripts/db-backup.sh`, `scripts/db-restore-drill.sh`) with a prior executed drill recorded in docs.
- CI: `.github/workflows/ci.yml` backend/frontend/E2E/ai jobs; GitLab CI mirror with trivy security scan.
- Prod fail-fast guards: `NEXT_PUBLIC_API_URL` required for prod build (verified — build refuses without it), `CORS_ALLOWED_ORIGINS` required, `SECURE_COOKIES`, demo seed OFF for prod/docker profiles.

## 3. Blockers to any deployment (ranked)

| # | Blocker | Owner | Unlock |
|---|---|---|---|
| 1 | Host + domain + DNS decision (low-cost recommendation: single small VPS running Docker Compose; alternatives: Railway for backend + Vercel/Netlify for frontend) | Harrison | purchase/selection approval |
| 2 | TLS certificates + nginx domain (`NGINX_DOMAIN`, certbot) | Engineering after #1 | domain |
| 3 | Production secrets: `JWT_SECRET`, `AI_INTERNAL_SECRET`, DB password, Groq key, M-Pesa prod consumer/passkey/callback, SMS key, SMTP, R2 keys | Harrison | credential issuance |
| 4 | M-Pesa public HTTPS callback URL | Engineering after #1–#3 | Daraja production account |
| 5 | Off-site backup target | Harrison | storage decision |
| 6 | Monitoring: Sentry DSN optional; none configured | either | account |
| 7 | Data-protection artefacts before real learner data (privacy policy, DPIA, consent) | Harrison + legal | external advice |

## 4. Recommended low-cost staging shape

- One VPS (2 vCPU / 4 GB, ~US$12–24/mo) running the existing Compose file (postgres + backend + ai-service + frontend + nginx) with Let's Encrypt TLS.
- `DEMO_SEED_ENABLED=true` only on a **private** demo instance; production keeps it off.
- Separate `.env.staging`; staging database never receives real learner data without the DPIA.
- CI deployment gate: run staging-gate script on push to a `staging` branch, then compose up.

## 5. Pre-flight checklist (production)

1. Fresh DB → Flyway V1–V19 → `/actuator/health` UP (staging gate).
2. Boot JAR with `prod` profile; Hibernate validate passes.
3. `next build` with production `NEXT_PUBLIC_API_URL`; `next start` behind nginx.
4. CSRF round-trip: GET `/api/auth/csrf` → POST with `X-XSRF-TOKEN` → 200; without → 403.
5. Login all demo/seed-disabled accounts (seed OFF check: demo creds must fail on prod).
6. M-Pesa sandbox STK completes callback; duplicate callback idempotent.
7. ai-elewa `/health` 200; backend→AI `X-Internal-Key` accepted; rejection returns 401 envelope.
8. `pg_dump` scheduled; restore drill into disposable DB.
9. Rollback: previous image tag / previous commit; documented in `docs/deployment/ROLLBACK_PROCEDURE.md` (to be created with deployment docs).
10. Secrets only via environment/secret manager — never commit.

## 6. Verdict

**Not deployable today** — purely external gating (host/domain/secrets), not code. Code-side deployment prerequisites verified: production frontend build succeeds (67 routes), backend JAR builds, 357 backend tests green, AI live path works.

**8 Nov 2026 re-verification (code gate):** the full Playwright suite now reports **38/38 passed, 0 failed, 0 flaky, 19.4m, exit 0** against a freshly rebuilt JAR (log `frontend/e2e-full-2-2026-11-08.log`). The previously reported messaging failure is closed: it was an icon-only send button without an accessible name plus a spec that swallowed errors, **not** a seed-data or auth problem. None of this changes the deployment verdict — the blockers above are external (host, TLS, secrets, DPIA). Note for staging operators: on an 8 GB host the `globalSetup` Gradle daemon must be stopped after it runs, or the suite hits 240 s timeouts from memory pressure.
