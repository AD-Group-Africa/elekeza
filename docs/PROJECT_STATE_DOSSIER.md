# Elekeza Project State Dossier

_Generated 2026-10-08 by read-only reconnaissance. Worktree = `release/v0.1.0` @ `3220010`, clean._

> ⚠️ **HEADLINE**: The production-closure/reconciliation work is **NOT in this worktree**. It lives in `stash@{0}` (299 files, +9,049/−1,708, staged index preserved) and branch `reconciliation-recovery-b139b8e` (9 commits ahead of release). This checkout is the pre-reconciliation release baseline. Anything marked **[stash]** below exists only in those refs.

## 1. Repo identity

- Remote: `origin https://github.com/AD-Group-Africa/elekeza.git` (fetch+push)
- Branch: `release/v0.1.0` @ `3220010` ("audit: production master document and zero-vulnerability frontend deps"), also pointed at by `backup/pre-staging-reconciliation-20260926`
- Other local branches: `Ai`, `develop`, `main`, `staging`, `integration/staging-reconciliation` (where reconciliation was staged), `feature/auth-onboarding-quiz`, `feature/frontend-integration`, 3 `freebuff/*` deploy branches
- Tags: `v0.1.0-pilot`, `v0.1.0-pilot-r2` (both on reconciliation line), 3 `freebuff-snapshot/*`
- Stashes: 4 total. `stash@{0}` = reconciliation WIP (2026-10-08). `stash@{1}` filter-branch rewrite, `stash@{2}`/`stash@{3}` old staging WIP (Apr–Jun 2026)
- Ancestry: `git merge-base --is-ancestor release/v0.1.0 reconciliation-recovery-b139b8e` → exit **0** (release is strict ancestor; 0 ahead / 9 behind)
- The 9 reconciliation-only commits: `f735e2d` checkpoint reconcile, `797346c` kotlin improvements, `5255b41` tutor chat endpoint, `7651aad` AI Gate 0 (provider retry), `39f0583` Gate 1 (deterministic directive), `305ca5f` Gate 2 (system-owned directive), `035d449` Gate 3 (Stage 2 JSON bound), `b2da56e` ai-elewa v0.1.0-pilot prep, `b139b8e` Groq model IDs (tag `v0.1.0-pilot-r2`)
- Committed diff release→recovery: 148 files, +8,099/−434, 0 binaries, 0 mode changes
- Worktree vs HEAD: empty. Index vs HEAD: empty.

## 2. Worktree / stash

- `git status --porcelain=v2`: only 2 untracked dirs — `ai-elewa/.venv/` (Python 3.12 venv) and `backups/` (local DB dumps incl. `backups/drill/*.dump`, `pilot-acceptance-pre-restore.dump`). **Neither is ignored by `.gitignore` on this branch. Never `git add .` here.**
- `stash@{0}`: 299 files — e2e-evidence 127, docs 92, release-evidence 25, frontend 25, backend 18, ai-elewa 6, scripts 1, + docker-compose.yml, README.md, ELEKEZA_README.md, ARCHITECTURE.md. Stat: +9,049/−1,708. Index (staged state) preserved inside the stash.
- **[stash]** contains: the canonical 15-doc set (`docs/ELEKEZA_MASTER.md`, PRODUCT, ARCHITECTURE, DOMAIN_MODEL, UX_AND_DESIGN_SYSTEM, ACCESSIBILITY, AI_ARCHITECTURE, API, INTEGRATIONS, SECURITY, TESTING, DEPLOYMENT, PILOT, PRODUCTION_READINESS, CHANGELOG), 67 old docs moved to `docs/archive/` (git saw 67 renames + 2 deletes), hardened `ai-elewa/security.py`, migrations V13–V16, `e2e-evidence/` + `release-evidence/`, 5 new ai-elewa test files, `docs/DEPLOYMENT.md`, `backend/restart-local.sh`, `scripts/staging-gate.sh` update.
- `.gitignore` (release): covers `node_modules/ .next/ build/ .gradle/ venv/ __pycache__/ .env .env.local *.log *.keystore *.jks .freebuff/ backend/uploads/ frontend/android/* …`. Gaps: `.venv/`, `backups/`, `ai-elewa/config.py.before-qwen.ps1` (untracked secret-bearing backup; lives in stash's untracked parent).
- Stray root logs (`backend-*.log`, `ai-elewa-*.log`, `staging-gate-run*.log`, `hs_err_pid*.log` in backend/) exist on disk but are ignored via `*.log`.

## 3. Structure

Key dirs: `backend/` (Spring Boot + Gradle), `frontend/` (Next.js), `ai-elewa/` (FastAPI), `docs/` (legacy tree on release: acceptance/, demo/, production/, security/, strategy/, etc. — consolidated set only **[stash]**), `infrastructure/nginx/`, `scripts/` (staging-gate.sh, reset-preview.sh), `e2e-evidence/` + `release-evidence/` **[stash]**, `backups/` (local, untracked), `.github/workflows/`.

## 4. Build / test

**Backend** — Gradle (`backend/build.gradle.kts`, `gradlew`, Java 17 per GitLab CI image `eclipse-temurin:17-jdk`):
- Test: `cd backend && ./gradlew test` (re-downloads deps if `GRADLE_USER_HOME` cache absent)
- Build: `./gradlew bootJar`
- Prior-session evidence (recorded in closure reports, in-repo history): 278/278 backend tests ×2.

**Frontend** — `frontend/package.json`: next **16.3.3** (`--webpack` scripts), react 19.2.3, typescript ^5, vitest ^5, axios 1.20.0, @tanstack/react-query, @capacitor/android ^8.4.1, @netlify/plugin-nextjs, mermaid, lucide-react.
- `npm run dev` (`next dev --webpack`), `npm run build`, `npm run type-check` (`tsc --noEmit`), `npm run test` (vitest run), `npm run test:e2e` (playwright test)

**AI** — `ai-elewa/requirements.txt`: fastapi 0.115.0, uvicorn 0.30.6, groq 0.11.0, anthropic 0.34.0, openai 1.45.0, google-generativeai 0.8.1, pydantic 2.8.2, pytesseract, Pillow, langfuse, pdfplumber/PyPDF2/python-docx, textstat (setuptools<81 pin), pytest 8.3.3.
- Test: `cd ai-elewa && .venv/Scripts/python.exe -m pytest tests -q` (15 test files on release; **[stash]** adds conftest + test_adaptive_endpoint, test_compute_directive, test_live_smoke, test_stage2_json → 606-test suite incl. 3 live-smoke with `AI_TEST_BASE_URL=http://localhost:8001`)

**CI**: `.github/workflows/ci.yml` — 3 jobs on `main`/`release/**`: backend (`./gradlew test`, `bootJar`), frontend (tsc, lint, vitest, build), e2e (playwright, chromium, "journeys + exam + offline + a11y + route crawl"). `.gitlab-ci.yml` — stages test/security/build: `test-ai-service` (python 3.11), `test-backend`, `lint-frontend` (node 20), `security-scan` (trivy), `build-backend`/`build-ai-service` (docker dind). No evidence of a recent remote CI run found in-repo.
- Test-path matches repo-wide: 724 (inflated by build artifacts `frontend/.next`, `frontend/out`, `backend/build`); authoritative counts: ai-elewa/tests = 15 `.py` (release), `frontend/e2e/` specs incl. `a11y.spec.ts`, backend `src/test/` exists (exact count UNKNOWN — need `find backend/src/test -name '*Test*.kt' | wc -l`).

## 5. Deployment

**`docker-compose.yml`** services: `postgres` (postgres:16-alpine), `redis` (redis:7-alpine), `backend` (image `${BACKEND_IMAGE:-elekeza/backend}:${IMAGE_TAG:-local}`; healthcheck `curl -f http://localhost:8080/actuator/health`), `ai-service` (`${AI_IMAGE:-elekeza/ai}`; healthcheck `urllib.request.urlopen('http://localhost:8000/health')`), `frontend`, `nginx` (nginx:1.27-alpine, ports 80/443, depends_on all). Volumes: `postgres_data`, `redis_data`, `certbot_data`. ~32 `${VAR}` placeholders (see §6).

**TLS**: `docker-compose.tls.yml` — opt-in override; nginx gets `NGINX_DOMAIN: ${NGINX_DOMAIN:?...}` and mounts `${TLS_CERT_HOST_DIR:-/etc/letsencrypt}`; template rendered via `envsubst` from `infrastructure/nginx/templates/nginx.conf.template` (server_name `${NGINX_DOMAIN} www.${NGINX_DOMAIN}`; proxy_pass → `backend` / `frontend`). Comments document one-shot certbot issuance + renew cron. Static `infrastructure/nginx/nginx.conf` references `elekeza.app www.elekeza.app`. **TLS dry-run evidence: not found in worktree** (UNKNOWN — may exist in stash `release-evidence/`).

**Dockerfiles**: `backend/Dockerfile`, `frontend/Dockerfile`. **Scripts**: `scripts/staging-gate.sh`, `scripts/reset-preview.sh`. Deployment docs: `docs/production/deployment.md`, `DEPLOYMENT-CHECKLIST.md` (22-item smoke, actuator hardening: only `/actuator/health` exposed), `pilot-launch.md`; canonical **[stash]** `docs/DEPLOYMENT.md` + `docs/PILOT.md`.

**Health endpoints**: BE `GET /actuator/health` (compose :8080; docs mention :8082 direct) — aggregate UP/DOWN incl. DB; AI `GET /health` (`ai-elewa/main.py:81`) returns `{"status":"ok"}`; FE none (HTTP 200 via nginx).

## 6. Env catalog (keys only — values redacted)

**`.env.example` (root, 48 keys)**:
- DB: `DB_NAME`, `DB_USER`, `DB_PASSWORD` (also `DB_URL` in Spring refs)
- Cache: `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`
- Auth: `JWT_SECRET`, `SECURE_COOKIES`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
- AI: `AI_INTERNAL_SECRET`, `AI_PROVIDER`, `AI_API_KEY`, `AI_SERVICE_URL`, `AI_CLIENT_TYPE`, `SENTRY_DSN_AI`
- Frontend/CORS: `NEXT_PUBLIC_API_URL`, `FRONTEND_URL`, `CORS_ALLOWED_ORIGINS`, `NEXT_PUBLIC_SENTRY_DSN`
- Email/SMTP: `EMAIL_PROVIDER`, `MAIL_HOST`, `MAIL_PORT`, `MAIL_USERNAME`, `MAIL_PASSWORD`
- SMS: `SMS_PROVIDER`, `AFRICA_TALKING_API_KEY`, `AFRICA_TALKING_SENDER_ID`
- M-Pesa: `MPESA_ENVIRONMENT`, `MPESA_CONSUMER_KEY`, `MPESA_CONSUMER_SECRET`, `MPESA_PASSKEY`, `MPESA_SHORTCODE`, `MPESA_CALLBACK_URL`
- Storage R2: `STORAGE_PROVIDER`, `CLOUDFLARE_R2_ACCOUNT_ID`, `CLOUDFLARE_R2_BUCKET_NAME`, `CLOUDFLARE_R2_ACCESS_KEY_ID`, `CLOUDFLARE_R2_SECRET_ACCESS_KEY`, `R2_ENDPOINT`
- Monitoring: `SENTRY_DSN_BACKEND`, `LANGFUSE_HOST`, `LANGFUSE_PUBLIC_KEY`, `LANGFUSE_SECRET_KEY`
- Ops/seed/compose: `DEMO_SEED_ENABLED`, `BACKEND_IMAGE`, `AI_IMAGE`, `FRONTEND_IMAGE`, `IMAGE_TAG`, `NGINX_DOMAIN`, `TLS_CERT_HOST_DIR`

**`ai-elewa/.env.example` (7 keys)**: `AI_PROVIDER`, `AI_API_KEY`, `INTERNAL_SECRET`, `LANGFUSE_PUBLIC_KEY`, `LANGFUSE_SECRET_KEY`, `LANGFUSE_HOST`, `TESSERACT_CMD`.

**Spring refs (`backend/src/main/resources/application*.yml`)**: `AI_CLIENT_TYPE:real`, `AI_INTERNAL_SECRET`, `AI_SERVICE_URL:http://ai-service:8000`, `AI_TIMEOUT_SECONDS:120`, `CORS_ALLOWED_ORIGINS:http://localhost:3000`, `DB_PASSWORD:password`, `DB_URL:jdbc:postgresql://postgres:5432/accessibledocs`, `DB_USER/DB_USERNAME:postgres`, `DEMO_SEED_ENABLED:FALSE`, `FRONTEND_URL`, `JWT_SECRET`. ⚠️ `JWT_SECRET` carries an insecure default string ("change-me-32-char-minimum-secret-key") — deployment must override.

**Actual secret files present locally (never print/commit)**: `backend/.env`, `ai-elewa/.env` (gitignored; keys incl. `DB_USER`, `DB_PASSWORD`, `SECURITY_JWT_SECRET`, `AI_INTERNAL_SECRET` per prior sessions — names only confirmed, values untouched).

## 7. Integrations

| Integration | Real adapter | Mock adapter | Selector | Required keys | State |
|---|---|---|---|---|---|
| AI (Groq et al.) | `backend/.../common/ai/RealAiClient.kt` + `AiWebClientConfig.kt` ↔ `ai-elewa` FastAPI (providers groq/openai/anthropic/google, `config.py:12` SUPPORTED_PROVIDERS) | `MockAiClient.kt` | `AI_CLIENT_TYPE=real` | `AI_SERVICE_URL`, `AI_INTERNAL_SECRET`, `AI_API_KEY` | Code verified; live needs Groq key (B4) |
| M-Pesa/Daraja | `backend/.../finance/MpesaGateway.kt`, `MpesaPaymentListener.kt`, `FinanceService.kt` | mock path in FinanceService | `MPESA_ENVIRONMENT` | `MPESA_CONSUMER_KEY/SECRET/PASSKEY/SHORTCODE/CALLBACK_URL` | Code hardened + negative-probed; live blocked on Daraja creds (B5); pilot conditional "honest mock" |
| Email/SMTP | `JavaMailEmailProvider.kt` | `MockEmailProvider.kt` | `EMAIL_PROVIDER` | `MAIL_HOST/PORT/USERNAME/PASSWORD` | Live blocked on SMTP account (B6) |
| SMS (Africa's Talking) | `AfricaTalkingSmsProvider.kt` ("wired-inert" per [stash] INTEGRATIONS.md) | `MockSmsProvider.kt` | `SMS_PROVIDER=mock` | `AFRICA_TALKING_API_KEY`, `AFRICA_TALKING_SENDER_ID` | **NOT CONFIGURED**; in-app notifications ✅, delivery ❌ |
| Storage | `CloudflareR2Provider.kt` | `MockStorageProvider.kt` | `STORAGE_PROVIDER` | 6× `CLOUDFLARE_R2_*`/`R2_ENDPOINT` | Provider present; keys unprovisioned |
| Monitoring | Sentry DSNs + Langfuse (`ai-elewa/langfuse_client.py`) | — | DSN keys | `SENTRY_DSN_*`, `LANGFUSE_*` | Slots exist; activation external |

Known defects/gaps tracked: EL-NEW-02 (messaging, §11), SMS/M-Pesa/SMTP credentials, callback URLs documented in `docs/production/external-integrations.md`. TODO/FIXME markers in first-party code: **805** (counted over `backend/src`, `frontend/src`, `ai-elewa` excluding venv/node_modules).

## 8. AI service (`ai-elewa/`)

- Entrypoint `ai-elewa/main.py` (FastAPI, uvicorn :8000). Routers: `endpoints/process.py`, `endpoints/simplify.py`, `endpoints/quiz.py`. Pipeline: `pipeline/stage1_profile.py` → `stage2_simplify.py` → `stage3_verify.py` → `stage4_concepts.py`. Health: `GET /health` (`main.py:81`).
- Auth: `security.py` dependency checking `INTERNAL_SECRET` header. **Two versions exist**:
  - Release worktree (`security.py:27`): `key_valid = hmac.compare_digest(...)` — compares against `INTERNAL_SECRET` (empty default, line 12). Weaker form.
  - **[stash]** (`security.py:31`): `key_valid = bool(INTERNAL_SECRET) and hmac.compare_digest(...)` — hardened **fail-closed** (empty secret ⇒ always reject). This is the P0 fix awaiting "AI r3 release" ship.
- Groq: `config.py` — `AI_PROVIDER` selects provider; per-provider model map (`STAGE2_MODEL`/`STAGE3_MODEL`); `AI_API_KEY` used; fails fast on missing key.
- Tests: 15 files (release) / 20 (reconciliation) — see §4. **[stash]** `test_live_smoke.py` hits live service via `AI_TEST_BASE_URL`.
- **r3 status**: [stash] `docs/PRODUCTION_READINESS.md` B1 — "ai-elewa INTERNAL_SECRET fail-open (P0) — FIXED in repo this closure (fail-closed verified live, both directions); remaining: r3 release authorization to ship it. Owner: Harry (AI r3)." AI Gates 0–3 shipped on recovery branch commits. Verdict impact: NO-GO for public production until r3 ships.

## 9. Security / Auth / RBAC

- `backend/.../config/SecurityConfig.kt`: CORS from `app.cors.allowed-origins` with explicit no-wildcard guard (`line 101: require(origins.none { it == "*" })`); CSRF via `XSRF-TOKEN` cookie echo; cookie security keyed off `SECURE_COOKIES`; JWT auth (secret `JWT_SECRET`).
- Roles (Spring `hasAnyRole` matrix): `STUDENT`, `GUARDIAN`, `TEACHER`, `SCHOOL_ADMIN`, `ADMIN`. `@PreAuthorize` on protected controllers (per [stash] API.md/RELEASE-REPORT.md).
- Fail-closed AI internal-secret: hardened version **[stash] `ai-elewa/security.py:31`**; release worktree still has the pre-hardening form (§8).
- Isolation/abuse tests (prior-session evidence, recorded in [stash] docs + closure reports): 401 matrix (no-cookie/garbage/alg-none/unsigned), refresh-rotation-reuse → 401, forgot-password no-enumeration, tenant-isolation 403 matrix, CSRF + 429 verified, tenant-scoped analytics.
- Known docs: [stash] `docs/SECURITY.md`; release has `docs/security/*` (OWASP ASVS verification, threat model, control matrix).

## 10. Database

- PostgreSQL. Release migrations (`backend/src/main/resources/db/migration/`): **V1__baseline_schema, V2__seed_demo, V3__quiz_answers, V4__support_interventions_deadlines, V5__content_raw_text, V6__notification_links, V7__personalization, V8__exams, V9__exam_marking, V10__attendance, V11__school_fees, V12__assignments** (12 files). **[stash] adds V13–V16 (16 total)** — content not inspected (read-only scope).
- `ddl-auto: validate` in `application-docker.yml`; `validate-on-migrate: true` + `ddl-auto: none` in `application-test.yml`.
- Migration-from-zero proof (reconciliation session): Flyway V1–V16 = 16/16 on empty DB + validate PASS + health UP; log on disk at `backend/migration-probe.log` (gitignored, preserved).
- Backup/restore: `docs/production/backup-and-recovery.md`, `docs/reliability/BACKUP_AND_RESTORE.md`; local dump artifacts in `backups/` (untracked — **never commit**: contains DB dumps). Prior drill: PASSED (closure evidence).
- Env keys: `DB_URL`/`DB_NAME`, `DB_USER`, `DB_PASSWORD`. Compose default DB name in Spring ref: `accessibledocs`; prior sessions used `elekeza_chain_scratch` on :5433.

## 11. Remaining app work (from [stash] canonical docs — authoritative ledger)

- **EL-NEW-02 (defect, open)**: guardian/teacher messages stored **sender-only** — `MessageController` saves `Notification(userId=sender)`, recipient never receives. Cited: [stash] `docs/API.md:87`, `docs/ELEKEZA_MASTER.md:97`, `docs/INTEGRATIONS.md:31`, `docs/CHANGELOG.md:36`. Fix tracked, not implemented.
- **EL-F-007 (blocked, decision pending)**: class creation — no API/UI; classes exist only via seed. Cited: [stash] `docs/API.md:35`, `ELEKEZA_MASTER.md:98,124`, `PILOT.md:82`. Owner: Harry (scope decision).
- **AI r3 release authorization** (B1): fix in-repo + live-verified; shipping = signature. Owner: Harry.
- **B2–B6 (external)**: pilot host/domain/DNS/TLS; pilot secrets generation; Groq production key; Daraja creds + public callback; SMTP account.
- **B8**: Safiri build-or-descope (out of repo by design).
- Implemented vs pending per [stash] ELEKEZA_MASTER §4 status ledger: core journeys (learner/teacher/guardian/admin), attendance, exams, quiz, fees, notifications (with EL-NEW-02 gap), personalization, accessibility — IV/PM; class creation + Safiri — explicitly blocked/absent.
- Standing gate verdict ([stash] PRODUCTION_READINESS.md:13,46,79): **GO for a single controlled pilot; NO-GO for public production**. Completion: overall ~88%, core MVP ~90%, integrations ~70%, deploy/ops ~60%.

## 12. Frontend

- Next.js 16.3.3 (`next dev/build --webpack`), React 19.2.3, TypeScript 5, Tailwind, axios + @tanstack/react-query, Capacitor Android shell, Netlify plugin present (`.netlify/`, `.vercel/` dirs exist).
- ~37 route groups (`frontend/src/app/`): admin, analytics, assignments, attendance, dashboard, document, exam, finance, forgot-password, government, guardian, learner, lesson, login, marketplace, notifications, onboarding, progress, quiz, register, school, student-ai-tutor, student-exams, student-home, student-lessons, student-quizzes, super-admin, teacher, teacher-assignments, therapist, upload, waitlist.
- API access: `frontend/src/lib/api.ts` — browser calls `/api/*` (rewritten server-side to backend); optional absolute base `NEXT_PUBLIC_API_URL`.
- Accessibility: Playwright spec `frontend/e2e/a11y.spec.ts` (in CI e2e job); assistive UI fixes (Assist/sidebar geometry) **[stash]**. Real-user AT validation still outstanding.

## 13. Backend

- Spring Boot (Kotlin), Gradle, Java 17. Entrypoint `ElekezaApplication.kt`. 24 domain packages: analytics, assignments, attendance, auth, calendar, common (adapters: AI/SMS/Email/Storage + CircuitBreaker, FeatureFlags, AuditLogService, HealthController), config (SecurityConfig, seed initializers), content, exam, finance, guardian, institution, learner, mastery, notification, payments, personalization, quiz, security, support, teacher, tutor, waitlist.
- 34 controllers mapped under `/api` (`@RequestMapping("/api…")`). Health: only `/actuator/health` exposed (per docs/production/monitoring.md). Compose port 8080; docs reference :8082 direct. Local dev has run on :8097 (via [stash] `backend/restart-local.sh`, prod profile, log `backend/chain-backend2.log`).

## 14. Evidence and artifacts

- **[stash]** `e2e-evidence/`: **127 files** (~41 MB) — journey screenshots per role + `07-video/*.webm`. **[stash]** `release-evidence/`: **25 files** (~26 MB) — `database-results.md`, `deployment-checklist.md`, `e2e-results.md`, `integration-matrix.md`, `pilot-acceptance.md`, `runbook.md`, `security-results.md`, `system-map.md`, `screenshots/*.png` (13), `recordings/*.webm` (6).
- Largest: `release-evidence/recordings/learner-journey.webm` 7.31 MB; `e2e-evidence/07-video/learner-journey.webm` 5.54 MB.
- **No Git LFS** (`.gitattributes` absent). **Recommended**: before committing the stash, move `*.webm`/large `*.png` to LFS or a trimmed evidence set — 67 MB of media in one commit is heavy.
- Other on-disk (gitignored) evidence: `backend/migration-probe.log`, `frontend/e2e-run.log`-equivalents, root `staging-gate-run*.log`, `backend/chain-backend2.log`.

## 15. GREEN / YELLOW / RED readiness (repo evidence only)

| Area | Status | Evidence |
|---|---|---|
| Domain | 🟡 | `NGINX_DOMAIN` parameterized template + `elekeza.app` in nginx.conf; no DNS/deploy evidence in repo |
| Host | 🟡 | Compose + Dockerfiles complete; no deployed-host evidence; B2 external |
| TLS | 🟡 | `docker-compose.tls.yml` + certbot webroot runbook comments; dry-run evidence not found (UNKNOWN — check [stash] release-evidence) |
| DB | 🟢 (local) / 🟡 (pilot) | 12 (release) → 16 [stash] migrations, validate-on-migrate, backup docs + drill dumps; probe log proves V1–V16 from zero |
| Secrets | 🟡 | Full `.env.example` catalog; `JWT_SECRET` insecure default in application.yml must be overridden; B3 external |
| AI | 🟢 code / 🟡 ship | Fail-closed fix + Gates 0–3 + tests in [stash]/recovery branch; **r3 authorization pending (B1)**; Groq key B4 |
| Storage (R2) | 🟡 | `CloudflareR2Provider.kt` exists; keys unprovisioned |
| M-Pesa | 🟡 | Gateway hardened + mock-verified; live blocked on Daraja (B5); honest-mock acceptable for pilot |
| SMS | 🔴 (live) / 🟢 (arch) | `AfricaTalkingSmsProvider` wired-inert; `SMS_PROVIDER=mock`; needs key + sender ID |
| Email | 🟡 | `JavaMailEmailProvider` ready; needs SMTP account (B6) |
| Monitoring | 🟡 | Sentry DSN slots + Langfuse wired; activation external |
| CI/CD | 🟢 workflows / 🟡 run | GH Actions (3 jobs incl. a11y e2e) + GitLab CI (incl. trivy); no recent remote-run evidence in repo |
| Accessibility | 🟢 automated / 🟡 human | `frontend/e2e/a11y.spec.ts` in CI; real-user AT validation outstanding |
| EL-NEW-02 | 🔴 | Open defect — recipient never receives messages ([stash] API.md:87) |
| EL-F-007 | 🔴 | Class creation absent, decision pending (B7) |

**Overall standing verdict**: GO for controlled pilot / NO-GO for public production — but only after the [stash]/recovery-branch work is brought onto the release line.

## 16. Exact next commands

```bash
# 1. Bring reconciliation commits onto release (clean fast-forward)
git switch release/v0.1.0
git merge --ff-only reconciliation-recovery-b139b8e

# 2. Re-apply the staged reconciliation changeset (preserves staged index)
git stash apply --index 'stash@{0}'

# 3. Verify, then run checks
cd backend && GRADLE_USER_HOME="$(pwd)/.gradle-user" ./gradlew test
cd ../ai-elewa && AI_TEST_BASE_URL=http://localhost:8001 .venv/Scripts/python.exe -m pytest tests -q
cd ../frontend && npm run type-check && npm run test && npm run test:e2e

# 4. Hygiene before any commit
git add .gitignore && printf '\n.venv/\nbackups/\nai-elewa/config.py.before-qwen.ps1\n' >> .gitignore
# consider: git lfs track "*.webm" (or trim evidence media) before staging e2e-evidence/

# 5. Local stack (canonical)
cd backend && bash restart-local.sh          # [stash] script; BE :8097, log backend/chain-backend2.log
cd ai-elewa && uvicorn main:app --port 8001  # AI
cd frontend && npx next dev --webpack -p 3100
curl -s http://localhost:8097/actuator/health; curl -s http://localhost:8001/health

# Open questions needing a human/command
find backend/src/test -name '*Test*.kt' | wc -l      # exact backend test count
git grep -n "dry" 'stash@{0}' -- release-evidence/   # TLS dry-run evidence hunt
```

_Skipped sections: none (full 16-section coverage within timebox). Sections marked UNKNOWN: backend exact test count, TLS dry-run evidence location._
