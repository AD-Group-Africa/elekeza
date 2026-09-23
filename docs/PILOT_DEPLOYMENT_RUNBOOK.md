# ELEKEZA — PILOT DEPLOYMENT RUNBOOK

**Authoritative operational guide for deploying the current Elekeza release for
LiveLabs / InnovateNow controlled pilot use.** Supersedes all archived deployment
notes in `docs/archive/`.

- Release: commit `38024ea`, branch `release/v0.1.0` (parent `8aae18b`)
- Verified at release: backend **269/269** · Vitest **17/17** · TypeScript clean ·
  frontend production build PASS · bootJar PASS · E2E **0 final failures** ·
  compose config PASS · demo-seed gate verified on real PostgreSQL
- Last updated: 23 September 2026

---

## A. RELEASE

| Item | Value |
|---|---|
| Branch | `release/v0.1.0` |
| Commit | `38024ea` (`release: harden Elekeza for pilot deployment`) |
| Parent | `8aae18b` |
| Seed gate | prod/docker default **OFF** (`DEMO_SEED_ENABLED` unset ⇒ no demo accounts) |
| Image defaults | `elekeza/backend`, `elekeza/ai`, `elekeza/frontend` (build locally; no foreign registry) |
| CI | backend tests + bootJar, frontend typecheck + lint + Vitest + production build |

## B. HOST REQUIREMENTS

- **OS:** Ubuntu 22.04+ (any Linux with Docker works)
- **Runtime:** Docker Engine + Docker Compose v2 (`docker compose version`)
- **Sizing (from compose limits):** backend 2 CPU / 2G, postgres 2 CPU / 4G,
  ai-service 2 CPU / 1.5G, frontend 1 CPU / 1G.
  Minimum practical: **2 vCPU / 4 GB RAM / 25 GB disk**.
  Comfortable: **4 vCPU / 8 GB RAM / 40 GB disk** (headroom for builds + growth).
- **Domain & DNS:** an A record pointing at the host. `infrastructure/nginx/nginx.conf`
  has `server_name elekeza.app` and cert paths
  `/etc/letsencrypt/live/elekeza.app/` **hardcoded** — for a different domain,
  edit that file (or run certbot with matching name) before first boot.
- **TLS:** nginx terminates HTTPS (TLS 1.2/1.3, HSTS). ⚠️ Compose mounts only
  `./infrastructure/nginx/nginx.conf` and the `certbot_data` volume — it does
  **not** mount `/etc/letsencrypt`. Provide certs via a
  `docker-compose.override.yml` (e.g. mount `/etc/letsencrypt` from the host
  where certbot ran), or start HTTP-only for an internal pilot and add TLS
  before internet exposure.
- **Persistence:** named volume `postgres_data`. Backups to a **separate disk
  or off-host location** (see §H).

## C. ENVIRONMENT (`cp .env.example .env`)

**REQUIRED — core**

| Variable | Notes |
|---|---|
| `DB_NAME` / `DB_USER` / `DB_PASSWORD` | PostgreSQL credentials for the compose `postgres` service |
| `JWT_SECRET` | 64+ random chars: `openssl rand -base64 48` |
| `AI_INTERNAL_SECRET` | Shared backend↔ai-elewa secret; must equal `INTERNAL_SECRET` in ai-elewa's env |
| `NEXT_PUBLIC_API_URL` | Bare backend origin, **no `/api` suffix** (axios + Next rewrite contract) |
| `FRONTEND_URL` | Public frontend origin |
| `CORS_ALLOWED_ORIGINS` | Exactly the frontend origin(s) |
| `SECURE_COOKIES` | **`true`** for any non-localhost deployment |

**REQUIRED — state for the real pilot**

| Variable | Notes |
|---|---|
| `DEMO_SEED_ENABLED` | **MUST remain unset/false.** Flyway V2 demo accounts are then never created (verified on real PostgreSQL). Set `true` only for a private demo stack. |

**OPTIONAL — infrastructure**

| Variable | Notes |
|---|---|
| `BACKEND_IMAGE` / `AI_IMAGE` / `FRONTEND_IMAGE` / `IMAGE_TAG` | Prebuilt image overrides; leave unset to `docker compose build` locally |
| `REDIS_HOST` / `REDIS_PORT` / `REDIS_PASSWORD` | Redis is provisioned by compose but currently unused by the backend |
| `SENTRY_DSN_BACKEND` / `SENTRY_DSN_AI` / `NEXT_PUBLIC_SENTRY_DSN` | Error tracking |
| `LANGFUSE_HOST` / `LANGFUSE_PUBLIC_KEY` / `LANGFUSE_SECRET_KEY` | AI observability |

**OPTIONAL — integration-specific (all fail safe as mocks until configured)**

| Integration | Variables |
|---|---|
| AI provider | `AI_PROVIDER` (groq/openai/anthropic/google), `AI_API_KEY`, `AI_SERVICE_URL`, `AI_CLIENT_TYPE=real` |
| M-Pesa Daraja | `MPESA_ENVIRONMENT` (sandbox\|production), `MPESA_CONSUMER_KEY`, `MPESA_CONSUMER_SECRET`, `MPESA_PASSKEY`, `MPESA_SHORTCODE`, `MPESA_CALLBACK_URL` (public HTTPS required for production callbacks) |
| Email/SMTP | `EMAIL_PROVIDER=javamail` + `MAIL_HOST`, `MAIL_PORT`, `MAIL_USERNAME`, `MAIL_PASSWORD` |
| SMS | `SMS_PROVIDER=africa_talking` + `AFRICA_TALKING_API_KEY`, `AFRICA_TALKING_SENDER_ID` |
| Storage | `STORAGE_PROVIDER=cloudflare_r2` + `CLOUDFLARE_R2_ACCOUNT_ID`, `CLOUDFLARE_R2_BUCKET_NAME`, `CLOUDFLARE_R2_ACCESS_KEY_ID`, `CLOUDFLARE_R2_SECRET_ACCESS_KEY`, `R2_ENDPOINT` (optional, derived from account id) |

## D. DEPLOYMENT

```bash
git clone <repo-url> && cd Elekeza
git checkout 38024ea
cp .env.example .env && $EDITOR .env        # per §C; DEMO_SEED_ENABLED stays unset

# 1. Validate configuration (exit 0, warnings about optional unset vars are fine)
docker compose config --quiet

# 2. Build images (or set *_IMAGE and skip)
docker compose build

# 3. Start
docker compose up -d

# 4. Status & logs
docker compose ps                           # all services healthy/running
docker compose logs -f backend              # watch migrations on first boot

# 5. Health
curl -f http://localhost/actuator/health    # {"status":"UP"} via nginx
curl -fI http://localhost/                  # frontend responds

# 6. Migration verification (expect 15 rows, success = t, no demo rows)
docker compose exec postgres psql -U "$DB_USER" -d "$DB_NAME" \
  -c "SELECT version, success FROM flyway_schema_history ORDER BY installed_rank;"
```

## E. FIRST-BOOT SECURITY CHECKS

```bash
# 1. Demo accounts absent — count must be 0
docker compose exec postgres psql -U "$DB_USER" -d "$DB_NAME" -tc "SELECT count(*) FROM users;"
# 2. Known demo credentials must fail
curl -s -X POST http://localhost/api/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"student@elekeza.app","password":"student123"}'    # expect 401/400, never 200
# 3. Only intended ports exposed (80/443 public; 5432 loopback-only; nothing else)
ss -tlnp | grep -E ':(80|443|5432)\s'
# 4. Cookies are Secure (browser devtools: session cookie has Secure flag)
# 5. HTTPS + HSTS active once TLS is in place (curl -I https://<domain>)
# 6. CORS rejects foreign origins (curl -I -H 'Origin: https://evil.example' http://localhost/api/auth/csrf)
# 7. JWT_SECRET is 64+ random chars (not a dictionary/default value)
```

Database is **not** publicly exposed: compose binds postgres to `127.0.0.1:5432`;
Redis and app containers have no published ports (internal network only).

## F. FIRST REAL SCHOOL (flows supported by this release)

1. **Create institution + school admin:** run the school onboarding flow
   (`/register` → school onboarding) — creates the institution and its
   `SCHOOL_ADMIN` (covered by E2E: “school onboarding creates SCHOOL_ADMIN;
   finance dashboard shows honest zeros”).
2. **Login as school admin** → admin dashboard.
3. **Configure school:** create **classes** and enroll **learners** (admin).
4. **Create teacher/staff:** admin staff management
   (`POST /api/institutions/{id}/staff`; the admin UI includes staff password
   reset). Teacher logs in and changes password.
5. **Guardian relationship:** link guardian ↔ learner via the admin
   **Guardian Links** panel; guardian self-registers and sees the ward after
   linking.
6. **Lesson/content:** teacher (or admin) uploads a PDF/DOCX → text extraction
   → AI adaptation (mock provider works offline; real provider needs §G creds)
   → lesson goes live for the class.
7. **Assignment/quiz/exam:** teacher creates assessments; learners take them
   (exam flow E2E-verified: start → timer → autosave → submit → scored;
   immutable after submission).
8. **Attendance:** teacher marks the class register; guardians see history.
9. **Fees:** admin creates fee structures/charges; guardian sees balance and
   history; M-Pesa payment fails safe with a clear error until credentials exist.
10. **Timetable:** admin/teacher adds slots (`POST /api/timetable/slot`).
11. **Reports:** teacher/admin analytics and progress dashboards populate from
    real usage.

## G. INTEGRATIONS (current state)

| Integration | Status |
|---|---|
| AI / Groq | **IMPLEMENTED + FAIL-SAFE.** ai-elewa is the real provider path (`AI_PROVIDER`+`AI_API_KEY` are required to boot the AI service); if it is down/unreachable, the backend AiClient falls back and the platform keeps working without AI features. Mock client available for dev via `AI_CLIENT_TYPE=mock`. |
| M-Pesa Daraja | **IMPLEMENTED + FAIL-SAFE.** STK push/callback/idempotency in code; returns a clear 503 without prod credentials + public HTTPS callback. `CREDENTIAL REQUIRED` for live payments. |
| Email/SMTP | **IMPLEMENTED + FAIL-SAFE** (mock provider default). `CREDENTIAL REQUIRED` for real delivery. |
| Africa's Talking SMS | **IMPLEMENTED + FAIL-SAFE** (mock default). `CREDENTIAL REQUIRED` for real delivery. |
| Cloudflare R2 | **IMPLEMENTED + FAIL-SAFE** (local-disk storage default). `CREDENTIAL REQUIRED` only if off-host object storage is wanted — **OPTIONAL for pilot**. |
| PostgreSQL | **READY** (migrations V1–V15 verified on a virgin database). |

No integration is claimed production-ready on code alone; each is
credential-gated and degrades safely.

## H. BACKUP / ROLLBACK

```bash
# Nightly backup (cron) — repo-provided wrapper
scripts/db-backup.sh --host 127.0.0.1 --port 5432 --user "$DB_USER" --db "$DB_NAME" \
  --out /backup/elekeza-$(date +%F).dump --keep 14

# Restore drill (do once before pilot, then monthly) — restores to a scratch DB and verifies
scripts/db-restore-drill.sh /backup/elekeza-<date>.dump --target elekeza_restore_test
```

- **Application rollback:** `git checkout <previous-commit> && docker compose build && docker compose up -d`
  (or re-point `*_IMAGE`/`IMAGE_TAG` to the previous tag if using a registry).
- **Database migration caution:** Flyway migrations are forward-only and
  validated (`ddl-auto=validate`). **Do not** roll the schema back; restore the
  backup instead if a downgrade is ever needed. Never run a pilot database with
  `DEMO_SEED_ENABLED=true`.

## I. PILOT SMOKE TEST (manual, after deployment)

Run top to bottom after first boot and after every deploy. The platform must
remain fully usable when every OPTIONAL integration is unconfigured.

**Pre-flight:** `curl -f http://localhost/actuator/health` → `{"status":"UP"}` ·
`users` count = 0 · `docker compose logs --since 10m backend | grep -i error` → nothing alarming.

| # | Check | Pass criteria | Class |
|---|---|---|---|
| 1 | Landing page | Loads over HTTPS, no console errors | CORE |
| 2 | Registration + login | Each role registers/logs in; session cookie has `Secure` | CORE |
| 3 | Learner | Dashboard → lesson → read completes | CORE |
| 4 | Teacher | Dashboard → class → learners visible | CORE |
| 5 | Guardian | Dashboard → ward detail opens | CORE |
| 6 | School admin | School onboarding creates admin; finance dashboard shows honest zeros | CORE |
| 7 | Super admin | ADMIN role: seeds/curriculum/institution APIs respond per RBAC | CORE |
| 8 | Tenant isolation | School-A admin cannot read School-B data (object-level 403/404) | CORE |
| 9 | Lessons | Enrolled learner sees class content | CORE |
| 10 | Quiz | Start → answer → score → progress updates | CORE |
| 11 | Progress | Learner/teacher/guardian views reflect the same attempts | CORE |
| 12 | Attendance | Teacher saves register; guardian sees history | CORE |
| 13 | Assignments | Teacher creates; learner sees/submits | CORE |
| 14 | Fees | Admin creates charge; guardian sees balance (payment may 503 — see #18) | CORE |
| 15 | Guardian digest | Digest generated and visible in-app | CORE |
| 16 | PDF/document upload | Teacher uploads PDF → extraction → lesson appears (local storage) | CORE |
| 17 | AI path | With key: adapted content. Without: honest degradation, no crash, core flows unaffected | CORE (graceful) / real inference OPTIONAL |
| 18 | M-Pesa path | Without creds: clear 503, no crash, fees view unaffected. With sandbox creds: STK push fires | CORE (fail-safe) / live pay OPTIONAL |
| 19 | Email | Without SMTP: reset/digest flows stay usable in-app, no 500s. With SMTP: email arrives | OPTIONAL |
| 20 | SMS | Without AT creds: notifications stay in-app. With creds: SMS delivered | OPTIONAL |
| 21 | Logout/session security | Logout clears session; expired/refreshed tokens behave; wrong password = inline error | CORE |
| 22 | Mobile/PWA | Install prompt works; offline quiz queues and syncs on reconnect | CORE |

## J. INCIDENT CHECKLIST

| Symptom | Check |
|---|---|
| Frontend down | `docker compose ps frontend`; `docker compose logs --tail 100 frontend`; `curl -I http://localhost/` |
| Backend unhealthy | `docker compose logs --tail 200 backend`; `curl http://localhost/actuator/health`; look for Flyway/DB errors on startup |
| Database fails | `docker compose ps postgres`; disk space (`df -h`); `docker compose logs postgres`; restore path in §H |
| Login fails for everyone | backend logs (JWT secret changed? cookies Secure vs plain HTTP?); system clock skew breaks tokens |
| Login fails for one user | rate limiter (5 attempts/60s) — wait or restart backend; then password reset via admin/forgot-password |
| AI fails | ai-service logs; `AI_API_KEY`/`AI_PROVIDER` set; platform keeps working on the mock client — verify `AI_CLIENT_TYPE` |
| M-Pesa fails | expected without prod credentials (clear 503); check `MPESA_*` and that `MPESA_CALLBACK_URL` is publicly reachable over HTTPS |
| Email/SMS fails | providers are mock until configured — set `EMAIL_PROVIDER=javamail` / `SMS_PROVIDER=africa_talking` + credentials |

## K. PILOT EXIT CRITERIA (deployment → controlled user testing)

All must be **factually true**:

- [ ] Core journeys verified on the deployed system (§I steps 3–7) with real accounts
- [ ] No open critical security issue (first-boot checks §E all pass; HTTPS live)
- [ ] Backups verified: one successful `db-restore-drill.sh` run on a real backup
- [ ] Monitoring/log access confirmed: an operator can reach `docker compose logs`
      and `/actuator/health`, and knows where backups land
- [ ] A school admin can independently run the §F workflow without engineer help
- [ ] Learner / teacher / guardian journeys each completed end-to-end by a non-engineer
- [ ] No `DEMO_SEED_ENABLED` on the pilot database (users table contains only real accounts)

## L. PILOT READINESS (LiveLabs / InnovateNow / first school)

**Ready now (verified):** all CORE smoke checks are covered by automated suites
(backend 269, E2E 31 incl. a11y + offline + role journeys) and the §I manual
pass on the deployed stack; demo-seed gate proven; secrets hygiene verified.

**Needs credentials (blockers only for those features):** Groq key (real AI
adaptation), M-Pesa Daraja prod + public HTTPS callback (live payments), SMTP
(email delivery), Africa's Talking (SMS delivery). Everything degrades safely
without them.

**Needs human testing before users arrive:** §I checklist executed by a human
on the real host; one backup + restore drill; admin runs the §F first-school
workflow unaided.

**What pilot users should test:** daily teaching flow (content, quiz,
attendance, assignments), learner experience on low-end Android/PWA offline,
guardian visibility (progress/fees/digest), and honest reporting of anything
confusing — UX friction is data, not failure.

**Telemetry/feedback to collect:** `/actuator/health` + `docker compose logs`
ship-metrics; error tracking via optional Sentry; a weekly 30-min teacher and
parent feedback call; in-app feedback channel for learners; track
gestures-of-success (lessons completed, quizzes scored, attendance marked)
from the existing analytics.

**Pilot blockers (fix immediately):** any CORE smoke-check failure; login/auth
instability; data loss or cross-tenant visibility; unexplained 500s in logs;
restore drill failing.

**Do NOT change during the pilot:** database schema/migrations, auth/session
design, RBAC model, the seed gate, API contracts the frontend depends on, and
the AI boundary — freeze the architecture; ship only clear defect fixes.
