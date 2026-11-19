# Elekeza — Completion & Integration Register

**Date:** 2026-10-31
**Branch / HEAD at review:** `sprint-3-safe-config` @ `c56df6b` (`fix(elekeza): complete sprint 3 backend regressions`)
**Scope of this session:** inspect, run, repair within the existing implementation; no branch switching, no commit, no push, no deploy.

This document is the single source of truth for current readiness. It supersedes nothing; it links to existing artifacts in `docs/` where they already cover a topic.

---

## 1. Verified runtime state (observed, not assumed)

| Component | Port | How it was started | Observed result |
|---|---|---|---|
| Frontend (Next.js 16.3.3, webpack) | 3100 | `npx next dev --webpack -p 3100` | `200` on `/` and `/login`; renders and logs in |
| Backend (Spring Boot 3.2.4, Java 21) | 8097 | `./gradlew bootRun --args='--spring.profiles.active=prod'` | `/actuator/health` → `{"status":"UP"}` |
| AI service (FastAPI/uvicorn) | 8001 | `./venv/Scripts/python.exe -m uvicorn main:app --port 8001` | `/health` → `200`, Groq client initialised |
| PostgreSQL | 5433 | pre-existing local instance | DB `elekeza_chain_scratch`, Flyway schema version **19** |

Backend was started with the project's documented environment contract (`backend/restart-local.sh`): prod profile, `DB_URL` → local Postgres, `JWT_SECRET` ← `SECURITY_JWT_SECRET`, `AI_SERVICE_URL` → 8001, `AI_INTERNAL_SECRET` ← `ai-elewa/.env`, CORS/FRONTEND → 3100, providers `mock`.

**Note:** `AI_INTERNAL_SECRET` has no fallback in `application.yaml`. Any start that does not source `ai-elewa/.env` fails immediately with `Could not resolve placeholder 'AI_INTERNAL_SECRET'`. `restart-local.sh` handles this; ad-hoc starts do not.

---

## 2. What is genuinely complete (verified this session)

### Authentication
All five seeded roles authenticate against the live API and receive a session:

| Role | Account | Password | Result |
|---|---|---|---|
| STUDENT | `student@elekeza.app` | `student123` | 200 |
| TEACHER | `teacher@elekeza.app` | `teacher123` | 200 |
| GUARDIAN | `parent@elekeza.app` | `parent123` | 200 |
| SCHOOL_ADMIN | `admin@elekeza.app` | `admin123` | 200 (restored this session — see §5) |
| ADMIN | `superadmin@elekeza.app` | `superadmin123` | 200 (restored this session — see §5) |

### Critical journeys exercised against the live stack

| # | Journey | Evidence |
|---|---|---|
| 1 | Student dashboard + progress | `GET /api/progress/dashboard` → 200 (`completedLessons:3, quizzesTaken:18, averageScore:40`); `/api/progress/lessons` → 200 |
| 1b | Student assignments | `/api/assignments/learner/mine` → 200 (Grade 4 Blue, "Fractions practice set 2"); `/api/assignments/learner/submissions` → 200 |
| 2 | Teacher class roster + learner progress | `/api/teacher/students` → 200; `/api/teacher/student/1/progress` → 200; `/api/attendance/classes` → 200 (learnerCount:1) |
| 3 | Guardian linked learner | `/api/guardian/wards` → 200; `/api/guardian/wards/1` → 200; `/api/guardian/wards/1/progress` → 200 |
| 3b | Guardian **unlinked** learner denied | `/api/guardian/wards/12/progress` → **403** |
| 4 | School admin, school-scoped | `/api/institutions/1/students` → 200; `/api/institutions/2/students` → **403** ("no permission to access this institution") |
| 4b | Platform admin | `/api/institutions` → 200; `/api/system/health` → 200; `/api/analytics/admin` → 200 |
| 5 | Privilege escalation blocked | student → `/api/teacher/students` **403**, `/api/institutions/1/students` **403** |
| 6 | Unauthenticated rejected | `/api/progress/dashboard` **401**, `/api/teacher/students` **401** |
| 6b | Foreign origin rejected | login from `Origin: http://evil.example` → **403** |
| 6c | Wrong password | → **401** |
| 7 | AI request | `POST /api/tutor {action:EXPLAIN, lessonId:3}` → 200 in **2.25 s**, `source:"provider"`, real generated explanation |

### Browser verification
`http://localhost:3100/login` → student login → `/student-home` renders live data (name, level 4 "Adventurer", progress bar, "CONTINUE LEARNING Understanding Fractions"). Login page exposes labelled inputs, a skip link on the app shell, `role="alert"` regions and `<h1>`/`<h2>` semantics. No unexpected console/network errors; only the expected pre-login `/api/auth/me` 401s.

### CSRF
Enforced with `CookieCsrfTokenRepository` (`XSRF-TOKEN` cookie + `X-XSRF-TOKEN` header), with `/api/auth/*` exempted. Mutating calls without the token return 403 — verified deliberately. The frontend is same-origin (`/api/*` rewritten by `next.config.ts`), so the browser path works.

---

## 3. Test evidence (exact commands and exits)

| Check | Command | Exit | Result |
|---|---|---|---|
| Frontend typecheck | `npx tsc --noEmit` | **0** | clean |
| Frontend unit tests | `npx vitest run` | **0** | 4 files / 20 tests passed |
| Frontend lint | `npx eslint .` | **1** | 41 problems: **17 errors**, 24 warnings — all pre-existing style rules (`no-explicit-any`, `react/no-unescaped-entities`, `no-html-link-for-pages`, one `set-state-in-effect`) |
| AI tests (as configured) | `pytest -q` | **1** | 572 passed, **34 failed**, 55 deselected |
| AI tests (correct port) | `AI_TEST_BASE_URL=http://localhost:8001 pytest tests/test_edge_cases.py tests/test_live_smoke.py -q` | **0** | **34 passed** |
| Frontend production build | `npx next build --webpack` | **0** | **Compiled successfully in 35.7 s**, 59 routes emitted (static + dynamic) |
| Backend tests | `./gradlew test` | **0** | **357 tests, 0 failures, 0 errors, 0 skipped** (54 suites, `BUILD SUCCESSFUL in 7m 30s`) |

**The 34 AI "failures" are not code defects.** `tests/test_edge_cases.py` defaults to `AI_TEST_BASE_URL=http://localhost:8000` while the service runs on **8001**; every failure was `httpx.ConnectError`, and all 34 pass against the correct port. Fix: change the default in `tests/test_edge_cases.py` to 8001 (or export `AI_TEST_BASE_URL` in `pytest.ini`).

### 3.1 Backend suite

```
./gradlew test
BUILD SUCCESSFUL in 7m 30s
```

Aggregated from `backend/build/test-results/test/*.xml`: **54 suites, 357 tests, 0 failures, 0 errors, 0 skipped.**
This confirms the historical 357-test figure for the current working tree, which carries the staged Sprint 3 regional-deadline changes.

---

## 4. Integration status

| Integration | Existing status | Required action | Dependency |
|---|---|---|---|
| **AI (Groq via backend)** | **Working.** `TutorController` → `TutorService` → AI service `/ai/*` with internal-secret auth. Real provider response verified (2.2 s). `providerConfigured:true`. Actions: EXPLAIN, PRACTICE, TRANSLATE, SUMMARY, DIAGRAM | None for pilot. Add explicit AI-down fallback test (offline dictionary path exists via `translatedBy`) | — |
| **M-Pesa / Daraja** | **Implemented, unconfigured.** `MpesaGateway`, `MpesaController`, `MpesaPaymentFinalizer`, `MpesaReconciliationService`, callback verification hardened in `c311ce6` | Sandbox consumer key/secret/passkey + public callback URL. Then one sandbox STK push end-to-end | Safaricom sandbox account |
| **Africa's Talking (SMS)** | **Provider implemented** (`AfricaTalkingSmsProvider`), default `SMS_PROVIDER=mock` | API key + sender ID registration; then delivery test | AT account + sender approval |
| **Twilio** | **Not implemented** | Only if WhatsApp is required; otherwise stay on AT | Twilio account + template approval |
| **Sentry** | **Scaffolded only** (`sentry.client.config.ts`, `sentry.server.config.ts`); no DSN, so inactive | Project DSN per environment, then scrubbing rules + alert routing | Sentry account |
| **Media storage** | **Interface exists** (`StorageProvider`), only `MockStorageProvider` is implemented. Cloudflare R2 config keys exist in `application.yaml` but no R2 provider class | Implement R2 provider against `StorageProvider`, signed URL support, then switch `STORAGE_PROVIDER` | R2 bucket + credentials |
| **Hosting** | Dockerfiles for frontend/backend/AI, `docker-compose.yml`, `docker-compose.tls.yml`, nginx reverse proxy, `.github/workflows/ci.yml` | Choose target; CI pins **Java 17** while the app runs on 21 — align before relying on CI | Hosting decision |
| **DNS / TLS** | Not configured. `docker-compose.tls.yml` + nginx exist for certificate termination | Domain, DNS A/CNAME records, cert issuance (provider-managed or certbot) | Domain purchase |

---

## 5. Repairs made this session

| File / target | Change | Why |
|---|---|---|
| Pilot database (`users` rows 4 and 5) | Restored documented password hashes for `admin@elekeza.app` and `superadmin@elekeza.app` from `V2__seed_demo.sql` | Both admin accounts had been overwritten to `teacher123` by an earlier test run, so the documented `admin123` / `superadmin123` in `ELEKEZA_README.md` returned 401. Code was correct; data had drifted. Data-only fix, no schema or code change. |

No source files were changed, and no Git index, commit, push or deploy action was performed.

---

## 6. Known issues found (not fixed this session)

| Severity | Issue | Evidence | Proposed fix |
|---|---|---|---|
| P1 | `GET /api/content/list` returns `[]` for a student whose progress reports 4 lessons | live call | Confirm whether content listing is intentionally institution/teacher-scoped; if not, fix the query filter |
| P1 | AI integration suite defaults to port 8000 | 34 `httpx.ConnectError` failures | Set default to 8001 / export in `pytest.ini` |
| P2 | `npx eslint .` fails with 17 pre-existing errors | lint run | Clean up `any` usage and unescaped entities; add to CI gate |
| P2 | CI targets Java 17, local runtime is Java 21 | `.github/workflows/ci.yml:28` | Align the matrix with `build.gradle.kts` |
| P2 | `frontend/src/components/ui/AppBar.tsx` is unimported dead code and renders the square logo at 120×40 (distorted) | grep: no imports | Either wire it in with a corrected aspect ratio or delete it |
| P3 | Logo source is a 2048×2048 PNG with ~35 % empty top/bottom padding (2.9 MB) | alpha bbox 1794×604 | Ship a trimmed banner variant for inline brand use; keep the square for icons |

---

## 7. Accessibility

**Verified:** labelled form controls on login; `<h1>` (sr-only) + `<h2>` structure; `role="alert"` for errors; skip-to-main-content link in `SidebarLayout`; `aria-label` on icon-only buttons (menu, notifications, password toggle); mobile bottom nav with `aria-current="page"`; progressbar with accessible name.

**Not verified this session:** automated axe run (`frontend/e2e/a11y.spec.ts` exists but was not executed), keyboard-only traversal, screen-reader output, reduced motion, calm/high-contrast themes, switch access. Do not claim WCAG 2.2 AA conformance — only the items above were inspected.

**Hardware (switch access, AAC, Bluetooth switches, eye-gaze):** unverified. Treat as a research backlog item; no claim of compatibility.

---

## 8. Offline / PWA

- `next-pwa` is configured with `register: true` and **`disable: NODE_ENV === 'development'`**, so the service worker is **inactive under the dev server used this session**. Offline behaviour can only be judged from a production build.
- The production build **did** emit a service worker: `frontend/public/sw.js` (12 KB) and the Workbox runtime were regenerated at 11:18 during `next build`.
- `frontend/e2e/offline.spec.ts` exists but was not executed.
- **Not verified:** install prompt, offline shell, cached lesson access, deferred sync, duplicate-submission protection. No offline-sync model was proven. Do not represent the app as offline-capable until a production build has been exercised offline.

---

## 9. Packaging for internal testing

```bash
# 1. Database (existing local Postgres on 5433)
#    expected DB: elekeza_chain_scratch (schema v19)

# 2. Backend  (:8097)
cd backend
./gradlew bootRun --args='--spring.profiles.active=prod'
#    requires: DB_URL, DB_USER, DB_PASSWORD, JWT_SECRET (from SECURITY_JWT_SECRET),
#              AI_SERVICE_URL=http://localhost:8001, AI_INTERNAL_SECRET (from ai-elewa/.env),
#              CORS_ALLOWED_ORIGINS=http://localhost:3100, FRONTEND_URL=http://localhost:3100,
#              SECURE_COOKIES=false, SERVER_PORT=8097
#    or simply: bash backend/restart-local.sh   (needs build/libs jar)

# 3. AI service (:8001)
cd ai-elewa && ./venv/Scripts/python.exe -m uvicorn main:app --host 0.0.0.0 --port 8001

# 4. Frontend (:3100)
cd frontend && npx next dev --webpack -p 3100
```

Health checks: `curl localhost:8097/actuator/health` → `{"status":"UP"}`, `curl localhost:8001/health` → 200, `curl -o /dev/null -w "%{http_code}" localhost:3100/login` → 200.

Tester accounts are listed in §2. Demo seeding is gated by the `demoSeedEnabled` Flyway placeholder and must stay **off** on anything internet-facing.

---

## 10. Remaining work, in dependency order

1. Fix AI test base URL default (5 min).
2. Confirm `content/list` scoping (30 min investigation).
3. Production build + offline/PWA verification on the built output (1–2 h).
4. Align CI Java version and make lint/tests blocking (30 min).
5. Implement Cloudflare R2 `StorageProvider` + signed URLs (1–2 days).
6. Sentry DSN wiring with scrubbing (half day).
7. M-Pesa sandbox end-to-end with callback URL (1 day, after credentials).
8. Africa's Talking sender registration + SMS delivery test (1 day, after approval).
9. TLS/DNS and hosting selection (1 day, after decision).

---

## 11. Readiness assessment

**CONTROLLED PILOT DEMO READY** — for local/instructor-led demonstration on a trusted network.

Why this level and not higher:

- All five roles authenticate; every core journey was executed against the live stack with correct positive **and** negative authorization.
- The AI path returns a real provider answer through the backend, and its failure mode is designed to degrade (offline dictionary path), though that fallback was not exercised.
- 357 backend tests, 20 frontend unit tests, 34 AI integration tests (correct port) and the production build all pass.

Why not "production ready":

- No TLS/DNS, no hosting deployment, no secret management, no rate-limit/backup validation in the deployed topology.
- Media storage is mock-only; R2 provider unimplemented.
- Offline behaviour has not been exercised on a production build.
- Lint gate is failing (17 errors), CI Java version mismatched.
