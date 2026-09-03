# ELEKEZA-AUDIT.md — Engineering State Report

*Last run: 2026-09-03. Status classification used throughout:*
`VERIFIED` · `PARTIALLY VERIFIED` · `BLOCKED (external)` · `MOCKED` · `NOT IMPLEMENTED`.

---

## Executive status

| | Status | Note |
|---|---|---|
| Overall completion | Substantially complete for demo/pilot | Core learning loop is real and persisted end-to-end |
| Production readiness | PARTIALLY VERIFIED | Requires valid external credentials + deployment infra (see below) |
| Demo readiness | VERIFIED (dev mode) | Boots, seeds, and runs the full learner loop with the mock AI client |

## Architecture (from code)

```
Next.js 16 frontend (port 3000) ── axios (cookie auth + CSRF) ──►
  Spring Boot 3.2 / Kotlin backend (port 9090) ──► PostgreSQL (Flyway V1–V5)
        │ X-Internal-Key (HMAC-style shared secret)
        ▼
  FastAPI AI service (port 8000): /ai/simplify/text|image, /ai/quiz/generate,
        /ai/quiz/adaptive-response, /ai/quiz/wrong-answer-flow, /process
        │ AI provider (groq/openai/anthropic/google)
        ▼
  External providers (env-configured, mock default): Africa's Talking (SMS),
        JavaMail (email), Cloudflare R2 (storage), M-Pesa Daraja, Sentry, Langfuse
```

Key vertical slices: auth (JWT access cookie + rotating refresh cookie, CSRF double-submit,
role + institution RBAC), content (upload → raw text → AI adaptation → lesson view),
quiz (start → per-question answer w/ adaptive feedback → complete → review → durable
`quiz_attempts`/`quiz_answers`), progress (`lesson_progress` → learner + teacher dashboards),
guardian (ward links/reports), support signals & interventions, notifications, M-Pesa, waitlist.

## Completed / implemented (concrete)

- Content upload (text + file) persists **raw text** (new `raw_text` column, V5) and auto-runs the
  AI pipeline when `AI_CLIENT_TYPE=real`; adapted lesson + generated quiz are **persisted** into
  `simplified_text` as one JSON document (`{"lesson":…, "quiz":…}`).
- `GET /api/content/lessons/{id}` (was missing — the lesson page previously 404'd) serves the
  learner lesson view; legacy and AI content shapes are normalised by `LessonView`.
- Text extraction for uploaded `txt/pdf/docx/doc` files (`TextExtractor`).
- Quiz: server-side grading, answer key never sent pre-completion, ownership + assignment checks,
  per-question evidence rows, post-quiz review, guardian notification, progress mutation.
- Learner progress dashboards (`/api/progress/*`), teacher student/assignment/progress views,
  analytics (student/teacher/guardian/admin), support signals/interventions.
- External-provider abstractions with **mock-as-default** (previously the beans never activated):
  `SMS_PROVIDER/EMAIL_PROVIDER/STORAGE_PROVIDER`, credential env contract aligned across code,
  compose and docs. Real providers degrade safely (log + mock id) when credentials are missing.
- Security hardening already present and verified: CSRF on, CORS explicit (wildcard rejected),
  method-level `@PreAuthorize`, institution-scoped teacher/guardian queries, shared content-access
  guard across lesson + quiz flows, actuator exposes health only.
- Clean `.env.example` templates at root, `ai-elewa/`, docs table in README.

## Verified (actually executed 2026-09-03)

| Gate | Result |
|---|---|
| Backend `./gradlew test` | **48 tests, 0 failures** (incl. 5 new content-flow/lesson-view tests) |
| Backend package `./gradlew bootJar` | PASS |
| Fresh PostgreSQL migration gate (real PG 15.17, empty DB) | PASS — V1→V5 applied, Hibernate `validate` OK, app started |
| Dev profile boot (H2, seed data) | PASS |
| Frontend `tsc --noEmit` | PASS |
| Frontend `eslint` | PASS — 0 errors, 30 warnings (unused vars/hooks-deps) |
| Frontend production build (`next build`) | PASS — 49/49 pages |
| Docker compose config | PASS (`docker compose config` exit 0) |
| AI service offline unit/contract tests | PASS — 422 tests (10 files); live suites require server+key |
| AI internal auth | VERIFIED — wrong `X-Internal-Key` → 401 |
| Runtime auth | VERIFIED — login 200, wrong password 401, `/auth/me` 200 |
| Runtime tenancy | VERIFIED — unauthenticated 403; student→teacher API 403; unassigned lesson view & quiz start 403; owner 200 |
| Full learner loop (runtime, mock AI) | VERIFIED — upload → assign → lesson view → quiz start/answer/complete (score persisted) → review → progress dashboard → teacher progress view, all against H2 + real HTTP |
| E2E loop persistence check | Learner `progress/dashboard` reported `completedCount=1, averageScore=100` after completion; teacher view showed same |

## Remaining external dependencies (BLOCKED without these)

- **Groq/LLM API key** — the key currently in the local `ai-elewa/.env` returns `401 Invalid API
  Key` from the provider (confirmed by live call). The service path, auth and graceful error
  handling are verified; live AI generation is BLOCKED until a valid key is supplied.
- Production PostgreSQL instance (local PG 15.17 used only for the migration gate).
- Africa's Talking account + key (SMS), SMTP credentials (email), Cloudflare R2 bucket (storage),
  M-Pesa Daraja sandbox/production credentials, Sentry DSNs, Langfuse keys — all env-configured,
  all default to safe mock/DB-only behaviour.

## Known limitations (genuine)

- File uploads of images are stored but not OCR'd/processed (AI image path exists on the AI
  service but is not wired into the upload flow). Uploaded-file MIME validation is extension-based.
- `AI Tutor` page (`/student-ai-tutor`) is a clearly-labelled mock chat (its own replies state AI
  is "not connected yet") — no tutor-chat endpoint exists yet on backend or AI service.
- Personalize step of teacher lesson wizard is a "coming soon" notice; assignment happens from
  the assignments page.
- Rate limiting is not enforced on API endpoints (dependency present, not configured).
- Local file storage under `uploads/` for uploaded documents (R2 provider exists but is not the
  active upload sink).
- Production Docker stack not runtime-tested this session (Docker daemon was off); compose config
  is valid. `.netlify` static bundle previously built but not exercised here.

## Security status

- Working tree secret scan: **PASS** — no credential-shaped strings in any tracked/untracked
  source, docs, scripts, YAML or the bundled `repomix-ai.xml`.
- **MUST-DO before any push/PR:** committed history (`HEAD`, `backend/src/main/resources/
  application-dev.yaml`) still contains two credential-shaped dev defaults — an M-Pesa consumer
  key and an Africa's Talking API key (`atsk_…`). The working tree has removed both. Rotate those
  credentials if real, then scrub history (e.g. fresh baseline / filter-repo) before sharing.
- No secrets logged in code paths reviewed; demo passwords are dev-profile only.
- CORS: explicit origins, `*` rejected when credentials are enabled; CSRF active; JWT in
  HttpOnly cookies (no token in localStorage); refresh cookie rotated.

## Database status

- 5 Flyway migrations (V1 baseline consolidated schema, V2 demo seed, V3 quiz answers, V4 support
  interventions/deadlines, V5 content `raw_text`). Fresh-database migration + JPA validate PASS.
- Dev profile runs H2 with `ddl-auto=update` (Flyway off) — dev-only choice; prod/docker validate.
- Note: this working tree rewrote the earlier 30-file migration history (V1–V30) into V1–V5 as
  uncommitted work. If any deployed database already ran the old V1–V30 series, do NOT deploy the
  consolidated files onto it — that is a migration-history rewrite, safe only before first deploy.

## Deployment readiness

- Backend jar builds; Flyway applies cleanly; prod profile boots against Postgres when
  `DB_URL/DB_USER/DB_PASSWORD/JWT_SECRET/AI_INTERNAL_SECRET/CORS_ALLOWED_ORIGINS/FRONTEND_URL`
  are set (missing vars fail fast).
- Frontend production build requires `NEXT_PUBLIC_API_URL` (fails fast when absent).
- `docker-compose.yml` validated; images build from `backend/Dockerfile`,
  `ai-elewa/Dockerfile`, `frontend/Dockerfile` behind nginx. Full `docker compose up` not runtime
  verified this session (daemon off).
- See `docs/DEPLOYMENT.md`, `docs/PRODUCTION.md`, `docs/HUMAN_SETUP_CHECKLIST.md`.

## Final acceptance matrix

| Area | Status | Evidence |
|---|---|---|
| Frontend | PASS | typecheck, lint (0 err / 30 warn), prod build 49/49 |
| Backend | PASS | 48/48 tests, bootJar, dev boot, runtime auth |
| Database | PASS | fresh PG gate V1→V5 + Hibernate validate |
| AI | PARTIALLY VERIFIED / BLOCKED (external) | service boots, auth 401 verified, 422 offline tests pass; live provider key invalid → BLOCKED |
| Authentication | PASS | login/logout/refresh cookies, wrong-password 401 |
| Authorization | PASS | role 403s, unassigned-content 403, institution checks, shared access guard |
| Accessibility | PARTIALLY VERIFIED | labelled inputs, aria-live/roles on key components, reading-toolbar prefs; no automated axe run |
| PWA/Offline | PARTIALLY VERIFIED | next-pwa config, manifest + sw + workbox generated; offline runtime not browser-verified |
| Tests | PASS | backend 48/48; AI offline 422; frontend typecheck/lint |
| Production build | PASS | backend jar + frontend `next build` |
| Security | PASS (worktree) | secret scan clean, CORS/CSRF/cookies verified; historical-secret rotation action open |
| Configuration | PASS | clean `.env.example`s, aligned compose/README/env contract, fail-fast prod vars |
| Docker | PARTIALLY VERIFIED | compose config valid; stack not runtime-tested (daemon off) |
| Documentation | PASS | README/ARCHITECTURE reconciled; AGENT.md added; this audit current |
| Demo readiness | PASS (dev, mock AI) | full learner loop exercised over HTTP with real persistence |

## How to run

```bash
# Backend (dev, H2 + seed data + mock AI)
cd backend && ./gradlew bootRun --args='--spring.profiles.active=dev'   # http://localhost:9090

# Frontend
cd frontend && NEXT_PUBLIC_API_URL=http://localhost:9090 npm run dev    # http://localhost:3000
# (login: teacher@elekeza.app / teacher123 · student@elekeza.app / student123 · parent@elekeza.app / parent123)

# AI service (needs a valid AI_API_KEY in ai-elewa/.env)
cd ai-elewa && ./venv/Scripts/python -m uvicorn main:app --port 8000
```
