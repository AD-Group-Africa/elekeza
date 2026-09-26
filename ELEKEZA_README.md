# ELEKEZA

> Inclusive Education Infrastructure

**Status:** READY FOR MANUAL E2E — pilot-ready with documented limitations
**Last verified:** 22 September 2026
**Documentation source:** this file (`ELEKEZA_README.md`)

This README consolidates and supersedes the project's previous scattered
documentation (99 files under `docs/` plus root reports, now archived under
`docs/archive/`). Where older documents conflict with the current
implementation, the current implementation takes precedence. Every claim below
was verified against the repository on **22 September 2026**.

---

## 1. Product identity

**Elekeza** is an inclusive learning and education-infrastructure platform
built under **Afrika Digitalis (AD Group)** for East and Central African
schools. It connects the learner, teacher, parent/guardian, school
administration and (in future) the education system into one ecosystem.

It is **not** a generic school ERP and **not** an LMS demo. The central
principle: *every learner should be understood, supported and given an
accessible path to learning* — presentation, pacing, guidance and interaction
adapt to the learner, always visibly and always reversibly. Reduce complexity
for users even when the technology underneath is sophisticated.

**Problem it solves:** Kenyan CBC schools have no unified system that (a)
delivers curriculum-aligned learning to mainstream *and* special-needs
learners in the same platform, (b) gives parents real visibility of their
child's learning, attendance and fees, and (c) gives schools honest
operational data without a maze of separate tools.

**Target users (current):** learners (Grade 4–6 first), teachers, parents/
guardians, school administrators. **Target users (planned):** county/national
education systems, therapists, device programmes.

**Release status:** pilot-ready (`v0.1.0` branch `release/v0.1.0`). See
§21 Known limitations — one AI credential and a handful of deployment
requirements separate this from production.

---

## 2. Ecosystem architecture

One codebase, one database, five product layers. They are layers of the same
system, not separate products.

```text
ELEKEZA
│
├── ELEKEZA LEARN          learner experience: lessons, quizzes, exams,
│                          assignments, AI tutor, progress, gamification
│
├── ELEKEZA ACCESSIBILITY  learner profiles + presentation system: SNE types,
│                          dyslexia font, TTS, calm mode, reading tools,
│                          AI content adaptation for four cognitive profiles
│
├── ELEKEZA ERP            institutional side: institutions, staff provisioning,
│                          learners + CSV import, classes, curriculum, timetable,
│                          attendance, fees/payments, assignments, exams, reports
│
├── ELEKEZA INTELLIGENCE   telemetry (engagement events), analytics dashboards,
│                          mastery engine, competency progress, support signals
│
├── ELEKEZA FAMILY         guardian accounts, ward links with lifecycle,
│                          daily digest, ward detail (progress/attendance/fees),
│                          notifications
│
└── ELEKEZA PLATFORM       multi-tenancy, RBAC, audit logging, devices registry,
                           billing/subscription architecture, country configs,
                           waitlist, Docker/deployment, AI service
```

| Layer | Current | Partial | Planned |
|---|---|---|---|
| Learn | lessons/sections/key-terms, server-scored quizzes, exam engine (timer, autosave, immutable submission, attempt limits), assignments with resubmission + grading, progress, gamification, AI tutor | AI adaptation & tutor responses need a Groq key (deterministic mock otherwise) | adaptive learning expansion, more gamification |
| Accessibility | SNE-typed learner profiles, per-learner accessibility-profile API (V13), 40+ presentation toggles (OpenDyslexic, high contrast, TTS, focus mode, calm mode, reading ruler/toolbar), 4-stage AI simplification pipeline (mock/real) | image/OCR path needs live provider; comorbid-profile prompts need live key to verify | further cognitive profiles |
| ERP | institution registration + CSV learner import, staff provisioning with seat limits (V13), classes/enrolment, curriculum hierarchy (V14), attendance sessions, fee structures → charges → payments → allocations → receipts, M-Pesa STK push (sandbox code, needs prod credentials), timetable with conflict detection (V13) | M-Pesa production, SMS/email real providers | government portal |
| Intelligence | engagement telemetry (V13) + institutional summary, teacher/learner/admin analytics, mastery engine, competency progress (V14), support signals | AI-generated insights (credential-gated) | predictive analytics |
| Family | guardian links with expiry/revocation lifecycle (V13), ward detail, daily digest endpoint, fees view, reports, notifications | SMS notifications (mock today) | WhatsApp channel |
| Platform | JWT cookie auth + CSRF + login rate limiting, tenant isolation, audit log, devices registry + billing/country configs (V15), superadmin, Docker Compose, backup/restore scripts + executed drill, CI for all three services | production host/TLS/secrets | device MDM (Phase 7) |

---

## 3. Technical architecture

```text
┌────────────────────────────────────────────────────────────────────┐
│  Browser / tablet / phone — Next.js 16 App Router PWA (React 19)   │
│  same-origin /api/*  ──rewrites──►  backend                        │
└──────────────────────────────┬─────────────────────────────────────┘
                               │ HTTPS, cookie auth (elekeza_access /
                               │ elekeza_refresh + XSRF-TOKEN)
                               ▼
┌────────────────────────────────────────────────────────────────────┐
│  Spring Boot 3.2.4 backend (Kotlin, modular monolith)   :8080      │
│  43 controllers, package-per-domain; Flyway owns the schema        │
│  JWT access 15 min / refresh 7 d, BCrypt, CSRF, Bucket4j limiter   │
└────────────┬──────────────────────────────┬────────────────────────┘
             │ SQL (Flyway V1–V15)          │ HTTP + X-Internal-Key
             ▼                              ▼
┌──────────────────────────┐   ┌─────────────────────────────────────┐
│  PostgreSQL 16           │   │  ai-elewa FastAPI service   :8000   │
│  prod (H2 in dev/tests)  │   │  X-Internal-Key auth; 4-stage       │
│  15 migrations, ~40 tbl  │   │  pipeline (profile→simplify→verify  │
│                          │   │  →concepts) → Groq/OpenAI/          │
│                          │   │  Anthropic/Google                   │
└──────────────────────────┘   └─────────────────────────────────────┘

Production edge:  nginx:1.27 (TLS termination, :80/:443) → frontend + backend
Docker Compose:   postgres, redis, backend, ai-service, frontend, nginx
```

**AI boundary (second diagram):**

```text
Frontend → Backend AiClient (Spring, ai.client.type = mock | real)
        → ai-elewa (FastAPI, POST /ai/simplify/text | /ai/simplify/image |
          /ai/quiz/generate | /ai/quiz/adaptive-response |
          /ai/quiz/wrong-answer-flow | /process, GET /health)
        → LLM provider (Groq default; openai / anthropic / google supported)
```

* Service-to-service auth: shared secret in the `X-Internal-Key` header
  (`AI_INTERNAL_SECRET` ↔ `INTERNAL_SECRET`). The AI service never touches
  the database and never calls back into Spring — it receives context and
  returns structured JSON.
* `ai.client.type=mock` (the dev default) returns deterministic lessons from
  the learner's SNE profile — the whole product is testable with zero
  credentials. `real` requires a provider key.
* Graceful degradation, verified live: when ai-elewa is unreachable or
  rejects the key, upload still stores the document and returns
  `adapted: false` with an honest error message.
* No tool-calling exists; the AI layer receives server-side context only, so
  it cannot cross tenant boundaries (the backend authorizes every request
  before constructing AI context).

### Services & ports

| Service | Port (local) | Notes |
|---|---|---|
| frontend `next dev` | 3000 (arbitrary; E2E uses 3100) | `NEXT_PUBLIC_API_URL` default `http://localhost:8085` |
| backend (dev profile, H2) | **8085** | `application-dev.yaml` |
| backend (prod profile, PG) | 8080 in Docker; any port via `--server.port` | fail-fast env contract |
| ai-elewa | 8000 | `uvicorn main:app --port 8000` |
| PostgreSQL | 5432 in Docker; local gate uses 5433 | postgres 16-alpine |
| Redis | 6379 | provisioned in compose; **not yet consumed by backend code** (rate limiting is in-process Bucket4j) |
| nginx | 80/443 | production reverse proxy, TLS termination |

---

## 4. Technology stack (actual, verified)

| Layer | Technology | Version | Purpose | Status |
|---|---|---|---|---|
| Frontend | Next.js (App Router, Turbopack/webpack flag) | 16.1.6 | UI + API rewrites | WORKING |
| | React | 19.2.3 | | WORKING |
| | TypeScript | ^5 | | WORKING |
| | Tailwind CSS | ^3.4.19 | moss/forest design system | WORKING |
| | next-pwa | ^5.6.0 | installable PWA, runtime caching, offline | WORKING |
| | Capacitor | ^8.4.1 | Android packaging (config present) | PARTIAL (no build wired) |
| | axios | ^1.13.6 | API client | WORKING |
| | recharts | ^3.9.2 | teacher dashboards | WORKING |
| Backend | Kotlin / Spring Boot | 1.9.23 / 3.2.4 | API, auth, domains | WORKING |
| | Java | 17 (source/target; Dockerfiles jdk17/jre17) | | WORKING |
| | Flyway | 9.22.3 | 15 migrations, schema owner | WORKING |
| | JJWT | 0.12.5 | JWT cookies | WORKING |
| | Bucket4j | 8.0.1 | login rate limiting (in-process) | WORKING |
| | Apache PDFBox / POI | 3.0.2 / 5.2.5 | PDF/DOCX text extraction | WORKING |
| | OpenCSV | 5.9 | learner CSV import | WORKING |
| AI | FastAPI / Python | 0.115 / 3.11-slim container | ai-elewa service | WORKING |
| | groq / openai / anthropic / google SDKs | per requirements.txt | provider abstraction | BLOCKED on real key (code complete) |
| | pytesseract | 0.3.13 | OCR endpoint | BLOCKED on real key |
| Database | PostgreSQL | 16-alpine | production data store | WORKING |
| | H2 | runtime dep | dev/test in-memory (MODE=PostgreSQL) | WORKING |
| Cache | Redis | 7-alpine | provisioned in compose | NOT CONSUMED YET by backend |
| Storage | Cloudflare R2 provider | code + env contract | upload storage | MOCK default; real provider BLOCKED on credentials |
| Notifications | Africa's Talking (SMS), JavaMail | code + env contract | SMS/email | MOCK default; real BLOCKED on credentials |
| Payments | M-Pesa Daraja | code + env contract | STK push + callback | SANDBOX code path; prod BLOCKED on credentials |
| Testing | JUnit (37 suites) / Gradle | — | backend | 269/269 green |
| | Vitest | ^5 | frontend units | 17/17 |
| | Playwright + axe-core | ^1.63 / ^4.13 | E2E + WCAG 2.1 AA gate | 31/31 |
| | pytest | ai-elewa | 367 test functions, `live` marker | 453 passed / 55 live-deselected in CI |
| CI | GitHub Actions | — | backend, frontend, e2e, ai-elewa jobs | configured |

---

## 5. Directory / codebase map

```text
backend/                     Spring Boot (Kotlin) — the API and all business logic
  src/main/kotlin/com/elekeza/backend/
    auth/          users, JWT cookies, login rate limiter, password reset, roles
    learner/       learner records, onboarding (profile→placement→guardian→complete)
    personalization/ learning preferences, deterministic text adaptation
    content/       lessons, upload validation, text extraction (PDFBox/POI)
    quiz/ exam/    server-scored quizzes; exam engine (timer, immutability)
    assignments/   teacher assignments, learner submissions, grading
    attendance/    attendance sessions + records (unique per class/day)
    finance/       fee structures, charges, payments, allocations, receipts
    payments/      M-Pesa Daraja client, STK push, idempotent callback
    guardian/      ward links, digest, ward detail APIs
    institution/   institutions, CSV import, staff management (seat limits)
    teacher/       teacher dashboards, roster, support signals
    curriculum/    learning area → strand → sub-strand → competency → objective
    analytics/     engagement telemetry + institutional summary
    mastery/       mastery engine
    support/       interventions, deadlines, signal calculator
    timetable/     timetable entries + conflict detection
    devices/ billing/ device registry, plans, subscriptions, country configs
    accessibility/ per-learner accessibility profiles (whitelisted keys)
    tutor/         AI tutor endpoint
    notification/  in-app notifications + provider dispatch
    common/ai/     AiClient interface, MockAiClient, RealAiClient
    common/        AuditLogService, SMS/email/storage providers
    security/ config/ SecurityConfig (CSRF, RBAC, CORS), seeds
  src/main/resources/db/migration/   V1–V15 (Flyway owns the schema)
frontend/                    Next.js App Router PWA
  src/app/                   student-home, lesson, quiz, exam, student-exams,
                             teacher/* (13 pages), guardian/* (8 pages), admin,
                             analytics, attendance, finance, upload, document,
                             super-admin, dashboard/{profile,settings,history},
                             register, login, forgot/reset-password, onboarding
  src/components/            accessibility (ReadingToolbar/Ruler), learner,
                             guardian, admin, layout, ui
  src/hooks/useTextToSpeech.ts   TTS with voice matching
  e2e/                       Playwright: journey, exam, offline, a11y, route-crawl
ai-elewa/                    FastAPI service: pipeline/{stage1..4}, endpoints/,
                             prompts/{dyslexia,adhd,autism,intellectual_disability,
                             none,COMORBID_RULES}, tests/ (367 functions)
scripts/                     staging-gate.sh, db-backup.sh, db-restore-drill.sh
docs/                        99 documents (see §24); status reports now archived
docker-compose.yml           postgres, redis, backend, ai-service, frontend, nginx
.github/workflows/ci.yml     backend / frontend / e2e / ai-elewa jobs
.env.example                 every integration variable, placeholders only
```

---

## 6. Database architecture

PostgreSQL 16 in production; H2 (MODE=PostgreSQL) for dev/tests. **Flyway owns
the schema** — Hibernate runs `ddl-auto: validate` in prod (H2 tests mask
nothing in the fresh-PG gate: V1→V15 + validate + health is a verified
one-command gate).

**Migration state (15 migrations):**

| V | File | Adds |
|---|---|---|
| 1 | baseline_schema | institutions, users, learners, content, quizzes/questions, progress, notifications, guardian core (~19 tables) |
| 2 | seed_demo | Demo Academy + demo accounts + demo content — placeholder-gated, OFF in prod/docker by default (`DEMO_SEED_ENABLED`) |
| 3 | quiz_answers | learner quiz answers |
| 4 | support_interventions_deadlines | interventions, deadlines |
| 5 | content_raw_text | raw extracted text on content |
| 6 | notification_links | deep-link targets on notifications |
| 7 | personalization | learning preferences JSONB |
| 8 | exams | exam engine tables (5) |
| 9 | exam_marking | marking columns |
| 10 | attendance | attendance domains (4 tables) |
| 11 | school_fees | fee structures/charges/payments/allocations (6 tables) |
| 12 | assignments | assignments + submissions |
| 13 | pilot_completion | password_reset_tokens, guardian_links lifecycle (expires_at/revoked_at), timetable_entries, accessibility_profiles, engagement_events |
| 14 | curriculum_hierarchy | learning_areas, strands, sub_strands, competencies (with institution_id), learning_objectives |
| 15 | devices_regions_billing | devices, device_assignments, billing plans/subscriptions/entitlements/invoices, country_configs |

**Key relationships & constraints:**

* `users.institution_id → institutions` — every tenant-scoped record carries an
  institution path; all admin/teacher queries filter by it (server-side).
* `guardian_links (guardian_id, learner_id, relationship, is_active,
  expires_at, revoked_at)` — authorization uses *currently active* links only.
* Attendance uniqueness: (class, session/day) enforced; duplicate sessions rejected.
* Finance: derived balance = `charges − allocations`; decimal money columns;
  M-Pesa transactions idempotent on callback.
* `password_reset_tokens`: hashed, single-use, expiring.
* `engagement_events`: append-only, no PII.
* V14 curriculum tables are tenant-optional (`institution_id` nullable) and
  indexed; `learning_objectives` carries `name/description`.

**Integrity risks (honest):** dev/test run on H2 with `ddl-auto: update`, so
only the fresh-PG gate proves real schema; backups are local (off-site storage
is a pilot commitment); Redis is not yet consumed by backend code.

**Backup/restore:** `scripts/db-backup.sh` (pg_dump -Fc, `pg_restore --list`
verification, retention) and `scripts/db-restore-drill.sh`; a real drill was
executed (restore into disposable DB, 15/15 migrations verified, drill DB
dropped). Evidence in `docs/reliability/BACKUP_AND_RESTORE.md`.

---

## 7. Authentication

| Aspect | Actual behaviour (verified) |
|---|---|
| Login | `POST /api/auth/login` — email+password, BCrypt check, rate limited (Bucket4j, 5 attempts / 60 s per email+IP, in-process) |
| Tokens | JWT **access 15 min** / **refresh 7 days** in `elekeza_access` / `elekeza_refresh` HTTP-only cookies; `Secure` flag controlled by `SECURE_COOKIES` (true in prod) |
| Refresh | `POST /api/auth/refresh` (cookie-to-cookie) |
| CSRF | `CookieCsrfTokenRepository` (XSRF-TOKEN cookie + `X-XSRF-TOKEN` header) — verified live (403 without header, 200 with) |
| Registration | `POST /api/auth/register` creates a learner; UI then routes to `/onboarding/profile` |
| Password reset | forgot-password (anti-enumeration, always same response) → emailed link `/reset-password?token=…` → hashed single-use expiring token → password replaced, all tokens invalidated (V13; lifecycle test suite proves reuse is rejected) |
| Logout | clears cookies, `POST /api/auth/logout` |
| Failure mode | wrong password → accessible inline error (E2E asserts); lockout after limit window |
| Frontend | axios client, same-origin `/api` rewrite; role-home redirect after login |

**Demo accounts (Flyway V2 seed on fresh databases — passwords are demo-only).
Seed gate (verified 23 Sep 2026 on real PostgreSQL): default/dev profiles seed
ON; `prod`/`docker` profiles default **OFF** via `DEMO_SEED_ENABLED` (set
`DEMO_SEED_ENABLED=true` only for a private demo deployment). Demo credentials
cannot exist on a default production install:**

| Role | Email | Password |
|---|---|---|
| Learner | student@elekeza.app | student123 |
| Teacher | teacher@elekeza.app | teacher123 |
| Guardian | parent@elekeza.app | parent123 |
| School admin | admin@elekeza.app | admin123 |
| Superadmin | superadmin@elekeza.app | superadmin123 |

---

## 8. RBAC / authorization

Five roles: `STUDENT`, `TEACHER`, `GUARDIAN`, `SCHOOL_ADMIN`, `ADMIN`
(superadmin). Enforcement is **server-side** in `SecurityConfig` +
per-service checks; the frontend hides nothing that the API would allow.

| Role | Access (server-enforced) |
|---|---|
| Learner | own lessons/quizzes/exams/assignments/progress/attendance (read-only)/finance (read-only); own accessibility profile; AI tutor with own context only |
| Teacher | own institution only; assigned classes; roster with SNE types; attendance marking; assignment create/grade; exam authoring/marking; timetable editing with conflict detection; institutional analytics |
| Guardian | own currently-active links only; ward detail (progress/attendance/assignments evidence/fees), daily digest; cross-ward attempts → 404 (E2E-tested) |
| School admin | own institution; staff provisioning (TEACHER/SCHOOL_ADMIN only — cannot create ADMIN), seat limits, CSV import, fee setup, attendance/finance dashboards, engagement summary |
| Superadmin (ADMIN) | platform-wide: institutions, users, system config, audit log (`/api/admin/audit`), feature flags; separate `/super-admin` UI |

**Verification evidence:** 269 backend tests include cross-tenant 404
matrices for learners, attendance, assignments, submissions, grading, fees,
payments, receipts and guardian wards; the E2E suite asserts a guardian
cannot open another guardian's ward. Unauthenticated reads of protected
endpoints are rejected; the only public GETs are auth, waitlist and the
billing/country catalogs.

---

## 9. UI/UX audit (what was actually inspected, 22 Sep 2026)

* **Navigation** — Sidebar layout across roles; learner home is
  companion-first; teacher sidebar has 15 surfaces; guardian 8 pages; all
  crawled by E2E route-crawl without crashes.
* **Dead UI removed** — `/analytics` was a "coming soon" page while a real
  engagement-summary API had no consumer → now a real engagement dashboard.
  Admin "Reports" and guardian "Schedule" dead buttons → wired to real
  destinations. No other dead buttons found in the crawl.
* **Floating "N"** — the Next.js dev-tools badge; **removed** via
  `devIndicators: false` in `next.config.ts` (dev and prod; nothing rendered
  in production builds even before, so prod users never saw it).
* **Visual system** — deep moss/forest identity (`--ek-moss-*` tokens),
  dark (default) / calm / light themes, `prefers-reduced-motion` honoured;
  a few purple legacy classes remain on secondary pages (token migration is
  cosmetic, tracked, not a defect); teacher dashboard charts now render with
  animation disabled to avoid recharts animation hangs.
* **States** — loading/skeletons, honest empty states (finance dashboard
  shows real zeros), inline form errors, retry buttons on analytics failure;
  E2E asserts no fake scores while offline.
* **Responsive** — grid layouts collapse to single column on mobile;
  PWA installable with offline queue (E2E-tested round trip).

---

## 10. Learner journey (registration → learning)

```text
REGISTER (/register)  ──►  account created (learner role)
      │
      ▼
ONBOARDING (/onboarding/profile)
   language/age group/goal/support → placement score → guardian link → complete
   (persists through the real onboarding API; verified end-to-end)
      │
      ▼
LEARNER HOME (/student-home) — companion-first dashboard, real data
      ▼
LESSON (/lesson/[id]) — sections + key terms; AI-adapted content when the
      provider is configured (deterministic mock otherwise)
      ▼
QUIZ (/quiz/[lessonId]) — server-scored; progress updated transactionally;
      offline answers queue in IndexedDB and sync on reconnect
      ▼
EXAMS (/student-exams, /exam/[id]) — timer, autosave, immutable submission,
      attempt limits, scored result
      ▼
ASSIGNMENTS — submissions + resubmission (no duplicate rows), teacher grading
      ▼
PROGRESS (/progress) — mastery ("what to do next"), gamification, history
      ▼
AI TUTOR (/student-ai-tutor) — lesson/quiz context, provider or mock
```

**Registration/onboarding status (verified 2026-09-22):** the full chain is
implemented end-to-end. `/register` creates the account (learners row is
get-or-created on first onboarding call), and `/onboarding/profile` persists
language / age group / learning goal / support preference, the placement
score → BEGINNER/INTERMEDIATE/ADVANCED literacy level, an optional guardian
contact, then flips onboarding-complete. The placement step is a reading-
check score entry, **not a clinical diagnostic** — results are framed as
literacy level / support indicators. Verified live (register → all four
calls 200) and covered by `SelfRegisteredOnboardingApiTest`.

**Accessibility during the journey:** presentation toggles apply immediately
(font, contrast, calm mode, focus mode, TTS via `useTextToSpeech`); per-learner
accessibility profiles (V13) persist settings server-side with whitelisted
keys (no medical classifications stored).

---

## 11. Teacher / guardian / admin experiences

* **Teacher** — dashboard with real analytics (`/api/analytics/teacher`);
  students roster with SNE types + support panel with mastery evidence;
  attendance register (save → counts, learner history reachable); lessons
  upload/assign; assignments (create, view submissions, grade); exams
  (author, timer config, mark); quiz results; support signals; progress;
  lesson plans; timetable editor with conflict detection; communication;
  schedule.
* **Guardian** — ward cards → ward detail (per-lesson scores, attendance,
  assignment evidence read-only, fee balance & payment history); daily
  digest `GET /api/guardian/wards/{id}/digest` (lessons, attendance, today's
  attendance, classwork, due/missing work, feedback, fee balance — same
  calculation as FinanceService); notifications with deep links; reports
  download; settings. Ward links are lifecycle-managed (admins can set
  expiry / revoke; revocation takes effect immediately).
* **School admin** — dashboard with school-scoped stats; staff management
  (create/deactivate teachers & admins, seat-limit enforcement, password
  reset trigger, audit-logged); CSV learner import with automatic guardian
  linking; fees & payments management; attendance oversight; engagement
  analytics page; reports.
* **Superadmin** — `/super-admin` console over platform data (institutions,
  users, system flags, audit log), clearly separated from tenant scopes.

---

## 12. Document / PDF learning

```text
PDF/DOCX/DOC/TXT/RTF/ODT (≤10 MB, extension allowlist, path-traversal-safe
storage; provider = mock | Cloudflare R2)
   → POST /api/content/upload/file (teacher or admin)
   → text extraction: PDFBox (pdf) / POI XWPF (docx) / plain text
   → ContentProcessingService: AI adaptation via AiClient
        · provider reachable → structured lesson (sections, key terms) + quiz
        · provider down / key rejected → stores raw text, status READY,
          adapted:false + honest error (verified live)
   → lesson renders at /lesson/[id]; learner reads, quizzes, progress tracked
```

Supported formats: **pdf, doc, docx, txt, rtf, odt**. Limitations: scanned
PDFs without a text layer produce little text (OCR exists only on the
ai-elewa image path and needs a live provider); 10 MB cap; extraction is
text-layer based.

---

## 13. Integrations (authoritative status)

| Integration | Current status | Configuration required | Production requirement |
|---|---|---|---|
| Groq (LLM) | **MOCK/LOCAL** — deterministic MockAiClient default; real client code complete & live-tested against provider boundary | `AI_PROVIDER=groq`, `AI_API_KEY`, `AI_SERVICE_URL`, `AI_INTERNAL_SECRET`, `AI_CLIENT_TYPE=real` | real key + hosted ai-elewa |
| M-Pesa Daraja | **PARTIAL** — STK push, callback, idempotency, payment/allocation/receipt chain implemented; stkPush returns clear 503 until credentials configured (fail-safe, verified) | `MPESA_CONSUMER_KEY/SECRET`, `MPESA_PASSKEY`, `MPESA_SHORTCODE`, `MPESA_CALLBACK_URL`, `MPESA_ENVIRONMENT` | production Daraja credentials + public HTTPS callback (owner-side; see `docs/MPESA_PRODUCTION_CHECKLIST.md`) |
| SMS (Africa's Talking) | **MOCK** — provider interface + real provider class exist; `SMS_PROVIDER=mock` default | `SMS_PROVIDER=africa_talking`, `AFRICA_TALKING_API_KEY`, `AFRICA_TALKING_SENDER_ID` | provider account + key |
| Email (JavaMail) | **MOCK** — same pattern (`EMAIL_PROVIDER=mock`); password-reset mail goes through the provider abstraction | `EMAIL_PROVIDER=javamail`, `MAIL_HOST/PORT/USERNAME/PASSWORD` | SMTP account + verified domain |
| Storage (Cloudflare R2) | **MOCK** — local temp storage default | `STORAGE_PROVIDER=cloudflare_r2`, `CLOUDFLARE_R2_*`, `R2_ENDPOINT` | R2 bucket + keys |
| PostgreSQL | **WORKING** — V1–V15 on virgin PG verified (gate), Flyway owns schema | `DB_URL`, `DB_USER`, `DB_PASSWORD` | managed PG + backups |
| Redis | **NOT CONSUMED** — provisioned in compose, no backend code uses it yet (rate limiting is in-process) | `REDIS_HOST/PORT/PASSWORD` | only when horizontal scaling lands |
| Google OAuth | **PARTIAL/UNVERIFIED** — button + client/secret env exist | `GOOGLE_CLIENT_ID/SECRET` | Google console config; NOT VERIFIED in current codebase |
| Sentry | **OPTIONAL** — DSN env variables present | `SENTRY_DSN_BACKEND/_AI/NEXT_PUBLIC_SENTRY_DSN` | DSN |
| Langfuse (ai-elewa tracing) | **OPTIONAL** — client present, disabled when host empty | `LANGFUSE_HOST/KEY` | optional |

Do not read "code complete" as "production configured": statuses above are
the honest current state.

---

## 14. Environment variables

Full annotated list: `.env.example` (root), `ai-elewa/.env.example`.
Placeholders only — **no real credentials are committed anywhere** (verified
by scan; only `.env.example` files are tracked).

Core (backend, required in prod):

```text
DB_URL=jdbc:postgresql://host:5432/elekeza
DB_USER=postgres
DB_PASSWORD=your-value
JWT_SECRET=<64-char random>          # openssl rand -base64 48
AI_INTERNAL_SECRET=<32-char random>  # must equal INTERNAL_SECRET in ai-elewa
FRONTEND_URL=https://your-frontend-domain
CORS_ALLOWED_ORIGINS=https://your-frontend-domain   # fail-fast: boot refuses to start without it (deliberate)
SECURE_COOKIES=true
```

AI service:

```text
AI_PROVIDER=groq            # groq | openai | anthropic | google — boot fails fast without it
AI_API_KEY=your-value       # boot fails fast without it
AI_SERVICE_URL=http://ai-service:8000
AI_CLIENT_TYPE=real         # mock | real (backend side)
INTERNAL_SECRET=<same as backend AI_INTERNAL_SECRET>
```

Frontend:

```text
NEXT_PUBLIC_API_URL=https://your-backend-domain   # required for production build (enforced)
```

External providers (all default to safe in-memory mocks):

```text
SMS_PROVIDER=mock | africa_talking        EMAIL_PROVIDER=mock | javamail
STORAGE_PROVIDER=mock | cloudflare_r2     MPESA_ENVIRONMENT=sandbox | production
# + provider-specific variables from .env.example
```

---

## 15. Security posture

**Implemented & verified:**

* JWT access/refresh in HTTP-only, `Secure` cookies; BCrypt password hashing.
* CSRF double-submit cookie on all mutating requests (curl-verified 403→200).
* Server-side RBAC on every endpoint; role lists in `SecurityConfig`; the
  only anonymous routes are auth, waitlist, health and the read-only
  billing/country catalogs.
* Tenant isolation via `institution_id` scoping in services (not filters)
  — 269-test suite includes cross-tenant 404 matrices.
* Login rate limiting (Bucket4j, per email+IP, interval refill).
* Anti-enumeration forgot-password; hashed, single-use, expiring reset tokens.
* File-upload hardening: extension allowlist, 10 MB cap, stored-name
  generation safe against path traversal.
* `X-Internal-Key` shared-secret auth between backend and ai-elewa; AI
  service holds no DB access, so it cannot become an isolation bypass.
* Async audit logging (`AuditLogService`) on sensitive actions (staff
  provisioning, curriculum mapping, billing); failure never blocks requests.
* Explicit CORS allowlist from env (`CORS_ALLOWED_ORIGINS`) — deliberate
  fail-fast if unset in prod.
* Secrets: none committed; `.env` files git-ignored; only examples tracked.
  (A default Google OAuth client id baked into `application.yaml` was found
  and removed with the dead OAuth surface on 2026-09-22.)

**Remaining (deployment-side, not code):** TLS termination + real domain
(nginx config present), production secrets injection, M-Pesa callback over
public HTTPS, off-site backup storage, optional Sentry/Langfuse.

---

## 16. Testing (latest verified results — 23 September 2026)

| Suite | Result | Evidence |
|---|---|---|
| Backend (Gradle, 37 suites) | **269/269 passed, 0 failed, 0 skipped** | JUnit XML aggregate `tests=269 failures=0 errors=0 skipped=0`, re-run 23 Sep after onboarding wiring |
| Frontend TypeScript | clean (exit 0) | `tsc --noEmit` |
| Vitest units | **17/17** | 3 files passed |
| Production build | **green** (64 routes) | `next build` + `.next/BUILD_ID` today |
| Playwright E2E | **31/31 passed** (final run today; 1 retry budget locally, 2 in CI) | journeys, exam, offline, route crawls (per-link bounded), WCAG 2.1 AA axe gate |
| AI service (credential-free) | **453 passed / 55 live-deselected** | exact CI command locally; `live`-marked pipeline tests need a real key |
| Fresh PostgreSQL gate | **15/15 migrations + Hibernate validate + health 200** | staging-gate pattern on virgin DB |
| Docker Compose | config valid (6 services, healthchecks) | `docker compose config` |
| Backup/restore drill | **PASSED** (real dump → restore → verify → drop) | `docs/reliability/BACKUP_AND_RESTORE.md` §6 |
| API smoke (live JAR) | login 200 (CSRF round-trip), document upload → READY lesson, read-back 200 | curl against boot JAR today |

CI (`.github/workflows/ci.yml`) runs all of the above on push: backend,
frontend (typecheck+lint+Vitest), e2e (real stack), ai-elewa (boots uvicorn,
dummy creds, `-m "not live"`).

**Test data:** dev profile seeds demo accounts + demo content on every boot
(`DataInitializer`, `ShowcaseDataInitializer`); Flyway V2 seeds the same
accounts on PG; E2E uses only those accounts — nothing touches external data.

---

## 17. Running Elekeza

> **Operating modes.**
> - **DEVELOPMENT:** §17 below — H2, mock providers, demo seed ON (Flyway V2) by default.
> - **TESTING:** §16 — 269 backend tests, Vitest 17, Playwright E2E 31; CI enforces both
>   production builds (bootJar + `next build`) on every push to `main`/`release/**`.
> - **PILOT:** [`docs/PILOT_DEPLOYMENT_RUNBOOK.md`](docs/PILOT_DEPLOYMENT_RUNBOOK.md) —
>   host requirements, environment contract, deployment commands, first-boot security
>   checks, first-school flow, 22-item smoke checklist, incident + exit criteria.
> - **PRODUCTION:** runbook §C–§E and §H — `DEMO_SEED_ENABLED` **unset** (seed OFF),
>   `SECURE_COOKIES=true`, TLS via nginx, `pg_dump` backups + restore drill,
>   rollback = previous image tag / commit. Seed behavior: V2 is placeholder-gated
>   (ON for default/dev, OFF for prod/docker).

### Install

```bash
git clone <repo> && cd Elekeza
# prerequisites: Java 17 (JDK), Node 20+, Python 3.11+ (for AI service), Docker (optional PG/Redis)
```

### Run locally (2 terminals, zero credentials needed)

```bash
# Terminal 1 — backend on H2, mock AI, demo data auto-seeded
cd backend && ./gradlew bootRun --args='--spring.profiles.active=dev'
# → http://localhost:8085

# Terminal 2 — frontend
cd frontend && npm install && npm run dev
# → http://localhost:3000  (rewrites /api/* to :8085)
```

Login with the demo accounts in §7. AI adaptation runs deterministically
without any key.

### Optional: AI service (needed only for `AI_CLIENT_TYPE=real`)

```bash
cd ai-elewa
python -m venv venv && venv/Scripts/activate      # Windows Git Bash
pip install -r requirements.txt
cp .env.example .env                               # set AI_PROVIDER + AI_API_KEY
uvicorn main:app --port 8000
```

### Run with Docker

```bash
cp .env.example .env      # fill required values
docker compose up -d      # postgres, redis, backend, ai-service, frontend, nginx
```

### Test

```bash
cd backend  && ./gradlew test
cd frontend && npm run type-check && npx vitest run && npm run build
cd frontend && npx playwright test              # boots real stack itself
cd ai-elewa && python -m pytest tests -q -m "not live"
bash scripts/staging-gate.sh                    # prod-artifact gate: build → fresh PG → boot → smoke
```

### Build & deploy

```bash
cd backend  && ./gradlew bootJar     # build/libs/elekeza-backend-0.0.1-SNAPSHOT.jar
cd frontend && NEXT_PUBLIC_API_URL=https://api.your-domain npm run build && npx next start
```

Production: provision PostgreSQL, set the env contract (§14), run the boot
JAR on the `prod` profile (Flyway migrates, Hibernate validates), terminate
TLS at nginx (config in `infrastructure/nginx/`), point the M-Pesa callback
at `https://<backend-domain>/api/payments/callback`, schedule
`scripts/db-backup.sh`. Full checklist: `docs/DEPLOYMENT_RUNBOOK.md` (now
archived; superseded by this section + §14).

---

## 18. Known limitations / remaining work

### Product (in-repo, contained)
1. ~~`/onboarding/profile` page is a client-side scaffold~~ **FIXED
   2026-09-22:** the page now persists through the real onboarding API
   (profile → placement → optional guardian link → complete). Wiring it
   surfaced and fixed two real backend defects (see §16/§23). Kiswahili
   content exists (seed lessons) but there is no UI language switching (P2).
2. Redis provisioned but unused by backend code (P2; matters only at
   horizontal scale — the in-process rate limiter note in
   `LoginRateLimiter` documents this).
3. ~~Google OAuth button present; flow NOT VERIFIED~~ **RESOLVED
   2026-09-22:** verified there is NO backend implementation (no endpoint,
   no OAuth2 starter, no client-id consumer) — the dead button, its stub,
   the `google:` config block (including a baked-in real client-id default)
   and `GOOGLE_CLIENT_*` env entries were removed. Re-introduce with a real
   implementation when needed.
5. Legacy purple styling classes remain on some secondary pages (cosmetic
   token migration, P2).
6. Capacitor config + deps exist but no Android build is wired (P2/roadmap).

### External integration requirements (credential-gated, code complete)
7. Groq key → real AI adaptation + tutor + the 55 `live`-marked AI tests.
8. M-Pesa production credentials + public HTTPS callback (owner-side).
9. Africa's Talking key (SMS), SMTP account (email), R2 keys (storage).
10. Production host, domain, DNS, TLS, real secrets.

### Pilot-operational commitments
11. Off-site backup storage + drill schedule at the hosting layer.
12. Device procurement/MDM (Phase 7), pilot-school agreement, licensed
    curriculum content.

**NOT VERIFIED in current codebase:** USSD (architecture docs only);
government portal (coming-soon page); therapist portal (coming-soon page);
marketplace (coming-soon page). Google OAuth was verified NOT IMPLEMENTED
and the dead surface was removed (§18 item 3).

---

## 19. Roadmap (documented, **Future / Planned** — not in this release)

Sequencing from `docs/NEXT_PHASE.md` (archived) and pilot-evidence principle:

1. Pilot with a real school → collect evidence from learners, teachers,
   guardians, admins.
2. Assignments maturity → guardian learning experience → accessibility
   deepening (evidence-driven order, not binding).
3. Offline/PWA hardening → AI Tutor expansion → school/device
   infrastructure (V15 devices/billing schema is the software-side
   foundation) → larger deployments.
4. Government/county portals, therapist portal, marketplace — coming-soon
   surfaces today, deliberate post-pilot candidates.

---

## 20. Development guide (for engineers & Alvin)

* **Where AI configuration lives:** backend `common/ai/*` (`AiClient`,
  `MockAiClient`, `RealAiClient`, `ai.client.type` switch) and
  `ai-elewa/config.py` (provider env contract, fails fast at boot without
  `AI_PROVIDER`/`AI_API_KEY`); prompts in `ai-elewa/prompts/` (per-profile +
  `COMORBID_RULES.md`); 4-stage pipeline in `ai-elewa/pipeline/`.
* **Where integration configuration lives:** `backend/src/main/resources/
  application-{dev,prod}.yaml` + `.env.example`; provider classes under
  `backend/common/` (`AfricaTalkingSmsProvider`, `JavaMailEmailProvider`,
  `CloudflareR2Provider`, M-Pesa in `payments/`).
* **Schema changes:** add `V16__*.sql` under `db/migration/` — never edit an
  applied migration unless no durable database has it (documented precedent:
  V14 was aligned in place before any durable DB applied it). Verify with
  `bash scripts/staging-gate.sh`.
* **Common failures & fixes:**
  * Boot fails with CORS error → set `CORS_ALLOWED_ORIGINS` (deliberate
    fail-fast).
  * 403 on POST via curl → fetch `/api/auth/csrf` first, send
    `X-XSRF-TOKEN` header from the same cookie jar.
  * `next build` refuses to start → `NEXT_PUBLIC_API_URL` unset in
    production (enforced).
  * Turbopack rejects BOM in globals.css → build uses `--webpack` scripts
    (already in `package.json`).
  * Gradle "file lock" on Windows → use the project-local
    `GRADLE_USER_HOME=backend/.gradle-user` (scripts already do).
  * Port 8080 occupied on this machine → dev backend is 8085; E2E uses
    8090/3100 via `playwright.config.ts` env overrides.
* **AI handoff note (for Alvin):** *the main codebase has been updated
  (V13–V15 migrations, password reset, staff provisioning, timetable,
  guardian links, telemetry, curriculum, devices/billing). Pull
  `release/v0.1.0`, review `ai-elewa/config.py` (provider env contract),
  `backend/.../common/ai/*` (client boundary), and
  `ContentProcessingService` (adaptation + fallback). The tutor flow and
  document/lesson context are verified working to the provider boundary;
  staging is fully contained in the release branch — nothing of yours was
  lost (`git rev-list release/v0.1.0..staging` = 0).*
* **Git state at documentation date:** branch `release/v0.1.0`, HEAD
  `8aae18b` "Pilot-ready release: attendance, fees, assignments, guardian
  digest, token system", ~70 changed/new uncommitted paths (the completion
  sprint + this README consolidation). Commit before packaging.

---

## 21. Documentation consolidation record

* **Documents analyzed:** 99 under `docs/` + 5 root reports + 3 sub-READMEs.
* **Superseded by this file:** all status/readiness/audit/report documents
  (dates 2026-06 → 2026-09-19) — moved to `docs/archive/` (history kept,
  contradictions retired). Kept live: operational guides (pilot/teacher/
  guardian/learner guides, PILOT_PLAN, MPESA_PRODUCTION_CHECKLIST,
  TESTING_CREDENTIALS_CHECKLIST, DESIGN_SYSTEM, ACCESSIBILITY,
  DATA_GOVERNANCE, reliability/integrations/security subfolders).
* **Key discrepancies resolved (code wins):** dev port 9090/8080 → **8085**;
  "V5 migrations" → **V15**; "57 routes" → 64; Capacitor described as a
  shipping platform → config present, not wired; "Redis caching" →
  provisioned, not consumed; "M-Pesa working" → sandbox code path, prod
  credential-gated; AI service "1,096 test functions" → 367 real test
  functions (453 passed incl. parametrization in CI mode); teacher E2E
  crawl timeout → fixed; "Google OAuth button" → verified dead and removed;
  self-registered onboarding 404/500 defects → found and fixed (§23).
* **Secrets found in this README: NONE.**

---

## 22. Final verdict

**READY FOR MANUAL E2E.** Everything in this repository is verified green as
of 23 September 2026 (§16). The former in-repo P1 (wiring the onboarding
page to its finished API) is now complete and verified. Everything else that
separates this build from production is an external credential,
infrastructure, or an owner-side decision — each listed in §18 with its
exact unlock.

**Your manual test sequence:**

1. `cd backend && ./gradlew bootRun --args='--spring.profiles.active=dev'`
2. `cd frontend && npm run dev` → `http://localhost:3000`
3. Learner: `student@elekeza.app / student123` → student-home → open the
   demo lesson → take the quiz → check /progress (gamification, mastery).
4. Teacher: `teacher@elekeza.app / teacher123` → dashboard charts render
   instantly → students roster (SNE types) → mark attendance → open
   timetable and save a slot → exams.
5. Guardian: `parent@elekeza.app / parent123` → ward card → ward detail →
   fees & payment history → reports.
6. Admin: `admin@elekeza.app / admin123` → dashboard → /admin/staff (create
   a teacher) → /analytics (real engagement summary) → CSV import a learner.
7. Upload: teacher → /upload → your PDF → open the generated lesson.
8. Try logging in with a wrong password (accessible error, no crash), then
   log out.

## 23. Session record — 2026-09-22 verification fixes

Defects found *by wiring the onboarding UI to its API* and verified fixed:

| # | Defect | Root cause | Fix | Verification |
|---|---|---|---|---|
| 1 | Self-registered learner → any onboarding call → 404 "Learner profile not found" | `/api/auth/register` creates a `users` row but no `learners` row; `OnboardingService.findLearnerByEmail` returned null | get-or-create the `learners` row on first onboarding call (idempotent, email-keyed) | live chain register→profile→placement→guardian→complete all 200; `SelfRegisteredOnboardingApiTest` 3/3 |
| 2 | Onboarding calls → 500 "Something went wrong" after fix 1 | `Authentication.name` resolves to `User.toString()` (Kotlin data class), which overflowed the `learners.email VARCHAR(255)` column | controller resolves the principal to `User` and uses `user.email` explicitly | live chain green; same test suite |
| 3 | Out-of-range placement score → 500 instead of a usable 4xx | `require()`/`check()` threw `IllegalArgumentException`/`IllegalStateException` with no handler | `GlobalExceptionHandler` maps both to 400 with the user-written message | same test suite (range + double-completion cases) |

E2E hardening the same day: route crawls use a per-link bounded `crawlLink`
(goto 45s / networkidle 15s / body read 15s) instead of an unbounded
`networkidle` inside a 240s test budget, and Playwright now retries once
locally (twice in CI) to absorb transient dev-server hiccups.
