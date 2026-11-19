# ELEKEZA — ARCHITECTURE

> Canonical architecture reference. Verified against the running stack on branch
> `integration/staging-reconciliation` (HEAD `b139b8e`).
> Re-verified 2026-10-05: fresh-database boot applies Flyway V1–V16 (16/16 success) with
> `ddl-auto=validate`; see [PRODUCTION_READINESS.md](PRODUCTION_READINESS.md).

## 1. Shape

**Modular monolith, one repository, package boundaries — no microservices.**

```
Browser / PWA (desktop, tablet, mobile; Capacitor shell optional)
    │ HTTPS
    ▼
Next.js frontend (App Router, TypeScript, Tailwind, next-pwa, webpack builds)
    │  same-origin /api/* proxy (next.config.ts rewrite; NEXT_PUBLIC_API_URL baked at build)
    ▼
Spring Boot 3.2 backend (Kotlin) — JWT httpOnly cookies, CSRF double-submit,
    │                             RBAC via @PreAuthorize, server-side tenancy
    ├──────────────▶ PostgreSQL 15/16 (Flyway V1–V16; ddl-auto=validate in prod)
    ├──────────────▶ Providers: Email (mock|javamail), SMS (mock|africa_talking),
    │                        Storage (mock|cloudflare_r2)  — @ConditionalOnProperty
    └── X-Internal-Key ──▶ FastAPI ai-elewa ──▶ LLM provider (Groq|OpenAI|Anthropic|Google)
```

## 2. Ports and environments

| Service | Local dev (this machine) | Docker compose | Notes |
|---|---|---|---|
| Frontend | :3100 (`next dev --webpack`) | :3000 (internal) / :80 via nginx | `NEXT_PUBLIC_API_URL` points at backend |
| Backend | :8097 (prod profile via `backend/restart-local.sh`, pinned SERVER_PORT) | :9090 container / :8080 docker profile | prod profile defaults 8080 |
| ai-elewa | :8001 (venv uvicorn) | :8000 internal | |
| PostgreSQL | :5433 (`elekeza_chain_scratch`) | :5432 (`postgres:16-alpine`) | Flyway owns schema |
| Redis | foreign :6379 untouchable | :6379 (REDIS_PASSWORD) | provisioned, currently unused by backend |
| nginx | n/a | :80/:443 + TLS override | |

## 3. Backend domains (package-per-domain)

| Domain | Package | Responsibility |
|---|---|---|
| Identity & access | `auth` | register/login/refresh-rotation/logout, forgot/reset, CSRF, login rate limiting |
| Institution | `institution` | school registration, CSV import (+guardian links, one-time credentials), staff management, classes |
| Content | `content` | upload (text/file), AI simplification, lessons/sections/key terms, `ContentAccessGuard` |
| Quiz | `quiz` | start (no answer key), server-side grading, complete, review, 409 duplicate attempts |
| Learner | `learner` | LearnerProfile (JSONB preferences), progress dashboard, preferences API, gamification |
| Personalization | `personalization` | sourced preferences, precedence resolution, deterministic `TextAdaptation`, `AdaptationSafety`, `SignalAccumulator`, adaptation cache |
| Teacher | `teacher` | institution-scoped students, assignments, progress, learning-support summaries/guidance |
| Guardian | `guardian` | wards (linked only), ward detail, learning-support plain-language summaries |
| Notification | `notification` | in-app notifications (the messages store), email/SMS dispatch via providers |
| Payments/finance | `payments`, `finance` | M-Pesa STK lifecycle (idempotent callback), fees/charges, allocations, revenue |
| Support | `support` | support flags, interventions, `SignalCalculator` |
| Analytics | `analytics` | role-scoped engagement/quiz analytics |
| Accessibility | `accessibility` | AccessibilityProfile (server-side TTS etc.) |
| Calendar | `calendar` | timetable/schedule |
| Waitlist | `waitlist` | public landing sign-up |

## 4. Request auth flow (verified)

```
login → elewa_access JWT (httpOnly, SameSite=Lax, Secure unless dev) + elewa_refresh (httpOnly, Strict)
every request → JwtAuthFilter resolves cookie/header → validates → SecurityContext principal
writes → CSRF double-submit (XSRF-TOKEN cookie → X-XSRF-TOKEN header; /api/auth/csrf mints)
expire → POST /api/auth/refresh rotates opaque hashed refresh token; reuse of rotated token → 401
```

CSRF exempt list (narrow, deliberate): login, register, refresh, csrf, forgot/reset,
`/api/payments/callback` (server-to-server, self-validating + idempotent).

Live negative probes (2026-10-05): `GET /api/auth/me` with no credentials → **401**; with
`Authorization: Bearer garbage` → **401**.

## 5. Frontend structure

- Role-scoped routes: `student-*`, `learner/*`, `teacher/*`, `guardian/*`, `school/*`, `admin`,
  `super-admin`; shared shells: `SidebarLayout` (skip link, `aria-current`, logout
  `[aria-label="Logout"]`), `DashboardLayout`, `RoleLayout`, `Navbar`, `Sidebar`.
- Learner primitives: `LearningCompanion`, `Celebration`, `ReadingToolbar`, `AccessibilityToolbar`,
  `LanguageToggle`, `Toast`, `GamificationWidget`, `useOfflineSync`, `useAccessibilitySettings`,
  `useCognitiveProfile`.
- Elekeza Assist ([ElekezaAssist.tsx](../frontend/src/components/assist/ElekezaAssist.tsx)) is
  sidebar-width aware (`collapsed` prop; `left-4` + `md:left-20/md:left-60`) so it never intercepts
  the sidebar Logout button; opaque token surface, Esc/focus-return, `elekeza:assist-open` event.
- PWA: workbox service worker — app-shell precache; NetworkFirst for `/api/content/*`,
  quiz starts, progress, notifications, `/api/learner/preferences` (7-day, 100-entry caches).
- Two a11y preference surfaces (documented, deliberate): local `elekeza-settings` (instant, all
  roles) and server `/learner/preferences` + `/dashboard/settings` mirror → `accessibility_profiles`
  (per-user persistence). See [ACCESSIBILITY.md](ACCESSIBILITY.md).

## 6. The learning loop (single source of truth)

```
learner login → learner home (one primary action)
→ lesson (content from /content/lessons/{id}; presentation adapted by preferences)
→ practice quiz (server-scored; offline answers queue in IndexedDB)
→ LessonProgress updated transactionally with quiz completion
→ gamification recomputed from persisted completions
→ guardian notification (in-app; SMS/email if providers configured)
→ teacher support/progress surfaces re-read the same completion data
```

Every pilot-report claim traces back to completed quiz attempts and lesson-progress rows.

## 7. Deployment topology (docker)

`docker-compose.yml`: postgres, redis, backend (docker profile), ai-service, frontend, nginx
(80/443; `docker-compose.tls.yml` renders nginx template with `NGINX_DOMAIN` fail-fast `:?`,
mounts certbot_data). `DEMO_SEED_ENABLED` defaults FALSE; `FEES_MPESA_MODE` defaults mock.
Verified dry-run: 6/6 healthy, HTTPS 200, HTTP→HTTPS 301, migrations, users=0, demo login 401.
Never exercised against a real host yet — external blocker.

## 8. Architectural decisions worth remembering

- `users.institution_id` is a deliberate soft reference (no FK/@ManyToOne) — dev seed creates
  institution-less teachers; isolation is enforced in the service layer and tested.
- Legacy UUID `learners`/`guardians` tables coexist with `users(id)`-scoped modern domains — known
  debt, documented in DOMAIN_MODEL.md.
- Exams/marketplace/government/therapist are **Coming Soon placeholders with zero backend surface**.
- Redis is wired in compose but unused by backend code; rate limiting is in-process (single-instance
  fine for pilot).

---

## 5. Consolidated architecture — verified 2026-11-19

> Appended during the pre-December audit. Sections 1–4 above were verified against
> `integration/staging-reconciliation` @ `b139b8e`; this section describes the **actual
> current topology** and supersedes them where they disagree.

### 5.1 Shape (unchanged, and deliberately so)

Modular monolith + one repository + three independently deployable services:

```
Elekeza/                       (single Git repo — AD-Group-Africa/elekeza)
├── backend/                   Kotlin 1.9.23 · Spring Boot 3.2.4 · JDK 17 · Flyway V1–V21
│                             40 controllers · 21 migrations · 397 tests
├── ai-elewa/                  Python · FastAPI · 4 endpoints · 4 providers · 603 tests
│                             endpoints/: simplify · quiz · process · tutor
├── frontend/                  Next.js 16.3.3 (webpack) · React 19.2.3 · PWA · 61 routes
│                             ├── src/app/(app|public)/...   route groups
│                             └── android/                   Capacitor 8.4.1 WebView wrapper
├── infrastructure/            nginx templates + TLS override (self-hosted path, unused on Render)
├── scripts/                   db-backup.sh · db-restore-drill.sh · staging-gate.sh
├── docs/                      architecture · integrations · deployment · testing
└── .github/workflows/ci.yml   4 jobs: backend · frontend · e2e · ai-elewa
```

### 5.2 Deviation from the proposed `apps/` layout — documented, not accidental

The mandate suggested `apps/{backend,ai-service,frontend}`. **This repository keeps
`backend/`, `ai-elewa/`, `frontend/` at the root.** Reasons:

1. Every deploy artefact references these paths: `backend/Dockerfile`, `ai-elewa/Dockerfile`,
   `frontend/Dockerfile`, `render.yaml` (`rootDir`), `frontend/netlify.toml`,
   `ci.yml` `working-directory`, `frontend/android/` Capacitor paths and `scripts/*.sh`.
2. Moving them rewrites every path in one shot and would invalidate the Android build,
   while adding **zero** runtime value before launch.
3. The goal — one repo, three deployable services — is already satisfied by the current layout.

The mapping is: `apps/backend` → `backend/`, `apps/ai-service` → `ai-elewa/`,
`apps/frontend` → `frontend/`. `shared/` does not exist because the three services share
no compiled code, only wire contracts (HTTP + JSON), which is the correct boundary.

### 5.3 Runtime topology

```
Browser/PWA ─► Netlify (Next.js + @netlify/plugin-nextjs)
                  │  /api/* rewritten by next.config.ts
                  ▼
           Render: elekeza-backend (Spring Boot, Docker, /actuator/health)
                  ├── PostgreSQL 16 (Flyway V1–V21, ddl-auto=validate)
                  └── SMS · Email · R2 storage · M-Pesa  (all default to mock)
                  ▼
           Render: elekeza-ai (FastAPI, Docker, /health, X-Internal-Key)
                  ▼
           AI provider (groq | openai | anthropic | google)
```

**Trust boundary:** the AI service is never called by the browser. `AI_INTERNAL_SECRET`
(backend) must equal `INTERNAL_SECRET` (AI). Treat it as a production credential.

### 5.4 Module map (backend)

`analytics` · `attendance` · `auth` · `billing` · `calendar` (incl. `DeadlineVisibility`,
`CountyKey`) · `common` (provider adapters) · `config/seed` (incl. `DemoSeedGuard`) ·
`content` · `devices` · `finance` (M-Pesa gateway/listener) · `guardian` · `institution`
(guardian links) · `learner` (progress, gamification, streaks) · `mastery` · `messaging` ·
`notification` · `payments` · `privacy` (consent, erasure, retention) · `quiz` · `tutor`.

### 5.5 Verified state at time of writing

| Service | Build | Tests | Notes |
|---|---|---|---|
| backend | `bootJar` OK | 397/397 | PostgreSQL 16 path not re-verified (H2 in tests) |
| ai-elewa | starts, `/health` 200 | 603/603 | real-provider run outstanding |
| frontend | `next build` OK | 34/34 | **ESLint 17 errors — CI red** |

Full detail: `docs/testing/TEST_RESULTS.md`. Consolidation: `docs/REPOSITORY_CONSOLIDATION_REPORT.md`.
