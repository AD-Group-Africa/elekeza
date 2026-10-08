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
