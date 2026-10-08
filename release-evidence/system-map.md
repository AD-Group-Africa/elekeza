# ELEKEZA FINAL SYSTEM MAP

**Audited live:** 2026-10-02 · HEAD `b139b8e` (`v0.1.0-pilot-r2`, branch `integration/staging-reconciliation`)
**Method:** repository inspection + live process/port/API verification. No code modified during recon.

## 1. Architecture

One ecosystem, two surfaces over one backend + one AI service:

```
Browser / tablet / phone (Next.js App Router PWA, React 19)
        │  HTTPS (nginx 80/443 + certbot in deployment topology)
        ▼
   chain-api (Spring Boot 3 / Kotlin, :8097 local, prod profile)
        │  JDBC                      │ HTTP + X-Internal-Key
        ▼                            ▼
   PostgreSQL 15/16 (:5433)     ai-elewa (FastAPI, :8001, Groq)
        │
   Redis (:6379 in docker topology — not required for pilot; template only locally)
```

- **ELEKEZA LEARN** = learner/teacher/guardian surfaces (lessons, quizzes, progress, tutor, accessibility).
- **ELEKEZA ERP** = school/institution layer (staff, students, classes, attendance, finance/fees, billing, reporting, devices).
- Shared identity/users/learners/schools/classes/guardians/teachers/attendance/assessments/progress/notifications/analytics — single PostgreSQL source of truth.
- **Safiri (transportation/safety): NOT IMPLEMENTED.** No routes/vehicles/trips/boarding/arrival code exists anywhere (verified by repository-wide search). The only related artifacts are a "Transport" fee-item *name* in `V11__school_fees.sql` and the `devices`/`device_assignments` tables, which belong to the **Access/offline-sync device registry**, not transport. See §9.

## 2. Services

| Service | Tech | Local port | Health | Source |
|---|---|---|---|---|
| Frontend | Next.js 16 (webpack dev; prod build exists) | 3100 | HTTP 200 | `frontend/`, `npm run dev -- --webpack -p 3100` |
| Main backend | Spring Boot / Kotlin (chain-api) | 8097 | `/actuator/health` UP | `backend/`, prod-profile jar |
| AI service | FastAPI + Groq (ai-elewa) | 8001 | `/health` ok | `ai-elewa/`, `venv/Scripts/python.exe -m uvicorn main:app` |
| Database | PostgreSQL (15 local / 16 docker) | 5433 local | psql OK | `elekeza_chain_scratch` |
| Redis | redis:7-alpine (docker topology) | 6379 (docker) | — | `docker-compose.yml`; not exercised locally (pilot does not require it) |
| nginx | nginx:1.27-alpine + certbot | 80/443 | — | `infrastructure/nginx`, `docker-compose.yml` |
| E2E backend | Playwright webServer | 8098 on demand | — | `frontend/playwright.config.ts` |
| Foreign stack (demo-v1/pcea-works) | — | 3000/8000/8090/55432/6379/9000-9001/8025 | UNTOUCHABLE | not part of Elekeza |

## 3. Database

- Flyway migrations **V1–V16** (`backend/src/main/resources/db/migration/`); live DB at schema V16.
- 60 tables incl.: users, learners, learner_profiles, guardians, guardian_links, institutions, classes, class_enrollments, attendance_sessions/records, content, content_adaptations, lesson_sections, key_terms, quizzes, quiz_questions, quiz_attempts, quiz_answers, lesson_progress, exams (+questions/attempts/answers/integrity_events), assignments (+submissions), payments, mpesa_transactions, fee_structures, fee_items, learner_charges, payment_allocations, billing_plans/subscriptions/invoices, notifications, refresh_tokens, password_reset_tokens, audit_logs, engagement_events, accessibility_profiles, devices, device_assignments, timetable_entries, academic_periods, competencies, learning_areas/objectives/strands/sub_strands, interventions, support_flags, waitlist_entries, country_configs, adaptation_events, deadlines, exams.
- **Demo seed**: `V2__seed_demo.sql`, every INSERT gated by Flyway placeholder `demoSeedEnabled` — ON in dev/test, **OFF in prod/docker** (compose passes `DEMO_SEED_ENABLED:-FALSE`).
- Backup/restore tooling: `scripts/db-backup.sh`, `scripts/db-restore-drill.sh` (drill executed this audit — see `release-evidence/database-results.md`).

## 4. API surface (40 controllers)

Auth/identity: AuthController, OnboardingController, WaitlistController.
Learn: ContentController, QuizController, ProgressController, GamificationController, MasteryController, TutorController, AccessibilityProfileController, AssignmentController (learner+teacher), ExamController, TimetableController, CurriculumController, CompetencyProgressController, StudentProgressController.
Teacher: TeacherController, AssignmentController, SupportController, DeadlineController.
Guardian: GuardianController, GuardianWardDetailController, GuardianLinkLifecycleController, GuardianReportsController, GuardianScheduleController, GuardianDigestController.
ERP: InstitutionController, StaffManagementController, AnalyticsController, EngagementController, AttendanceController, FinanceController, BillingController, MpesaController, MessageController, DeviceController, CountryConfigController.
Ops: HealthController.

## 5. Authentication & authorization

- **Sessions**: HS384 JWT in HttpOnly cookies — 15-min access cookie (path `/`) + rotating refresh cookie (path `/api/auth`); refresh rotation with reuse rejection (verified earlier: reuse → 401 "Refresh token expired or revoked").
- **CSRF**: double-submit XSRF cookie + `X-XSRF-TOKEN` header enforced on all mutating routes; exemptions: login/register/refresh/csrf/forgot/reset + `/api/payments/callback` (provider).
- **401 shape**: `{"error":"Unauthorized","code":"AUTH_REQUIRED"}`; FE interceptors recover (`lib/api.ts:45`, `lib/axios.ts:42`).
- **RBAC**: `@PreAuthorize` role checks on every protected controller; object-level checks in guardian/teacher/institution services.
- **Rate limiting**: `LoginRateLimiter` (login brute force → 429 after 5 bad attempts, verified live) + waitlist. No global API rate limiter (post-pilot hardening item).

## 6. Roles (as implemented)

| Role | Home | Verified |
|---|---|---|
| STUDENT | `/student-home` | full journey 22/22 |
| TEACHER | `/teacher` | full journey 12/12 |
| GUARDIAN | `/guardian` | full journey 10/10 |
| SCHOOL_ADMIN | `/admin` | full journey 9/9 |
| ADMIN | `/admin` (platform-level; used for system administration) | role exists in DB (superadmin@elekeza.app); no separate UI beyond admin |
| PARENT | alias role used by guardian pages | via guardian flows |

No invented SUPERADMIN surface.

## 7. Integrations

See `ELEKEZA_INTEGRATION_MATRIX.md`. Summary: Database ✅ functional · AI ✅ functional (Groq) · in-app notifications ✅ · M-Pesa mock-functional (live blocked on Daraja creds) · SMS/email wired-inert (provider classes exist, no runtime creds) · storage local disk (R2 template-only) · Google OAuth dead config · observability keys absent.

## 8. Deployment configuration

- `docker-compose.yml`: postgres:16 + redis:7 + backend (docker profile) + ai-service + frontend + nginx (80/443, certbot volumes). Secrets via `.env` (no defaults for secrets; `DEMO_SEED_ENABLED:-FALSE`, `FEES_MPESA_MODE:-mock`, `SMS/EMAIL/STORAGE_PROVIDER:-mock`).
- `scripts/staging-gate.sh`: bootJar → prod frontend build → fresh PG → migrations → prod-profile boot → health → login round-trip → teardown (GATE PASSED 2026-09-30 per project docs).
- `infrastructure/nginx/`: reverse-proxy configs.
- Prod profile defaults: `AI_SERVICE_URL` default `https://elekeza-ai.onrender.com` (placeholder host — must be set for real deployment).

## 9. Safiri (transportation/safety) — status: NOT IMPLEMENTED

Repository-wide search: zero transport domain code (no route/vehicle/trip/boarding/driver entities, controllers, migrations, or UI). The minimum pilot workflow (school registers transport → learner assigned → guardian associated → driver assigned → trip → boarding → guardian notification → arrival → notification) **cannot be executed because it does not exist**. Decision required (see final lists): build a clearly-labelled pilot/demo module (estimated 5–8 agent-days: 1 migration + service/controller + 2 UI screens + notification hooks + tests) or descope Safiri from pilot. **Not built during this audit** (broad change; awaiting authorization).

## 10. Test suites & E2E tooling

- Backend: Gradle/JUnit — **278/278 passed** (40 suites, re-verified earlier today).
- AI: pytest — 574 pass / 32 env-failures (30 = the now-fixed port hardcode; 2 live-smoke needing real provider), 55 deselected.
- E2E: Playwright — **31/31** (journeys, exam, offline, a11y axe gate, route crawls, IDOR negative test "guardian cannot open another guardian's ward").
- Closure E2E scripts (this engagement): `frontend/scripts/product-closure/*` — 4 role journeys + AI degradation + fix verifications; evidence in `e2e-evidence/` (78 screenshots, 6 videos).

## 11. Unfinished / stubbed / duplicate scan

| Item | Finding |
|---|---|
| Safiri | NOT IMPLEMENTED (see §9) |
| Class creation | No endpoint/UI (known EL-F-007) — classes exist only via seed/import |
| Message delivery | Notifications stored sender-only; `recipient` ignored (EL-NEW-02) |
| Email/SMS | Provider classes wired-inert; `mock` default (labelled) |
| Storage | Local disk; R2 config template-only |
| `/exam` route | Honest ComingSoon/redirect (documented, not fake) |
| Google OAuth | Config present, no flow (dead config EL-NEW-06) |
| Duplicate implementations | None found in domain logic; two accessibility preference systems (localStorage + server) are the one real duplication (EL-NEW-01, lesson-page fix already applied) |
| TODO/FIXME | Backend TODO markers exist but none block journeys; see defect matrix for the maintained list |

## 12. Known defects (live)

Maintained matrix: `e2e-evidence/10-reports/DEFECT-MATRIX.md` (0 blocker, 0 high; 2 medium product-decision items; rest low/cosmetic) + the two **new security findings from this audit**:

1. **AI-INTERNAL-SECRET FAIL-OPEN (P0 security)** — `ai-elewa/security.py:10` defaults `INTERNAL_SECRET` to `""`; an instance started without the env var accepts **unauthenticated** `/ai/*` calls (verified live: no-key request returned 422 schema-validation instead of 401 on a scratch instance). Frozen release r2 — fix requires an AI release decision.
2. **Backend "dev-secret" fallback (P2 hardening)** — `RealAiClient.kt:18` + `AiWebClientConfig.kt:15` use `${ai.internal-secret:dev-secret}`; base yaml forces resolution so it is currently dead code, but it must be removed to fail fast instead of silently using a known string.

## 13. Unfinished functionality (top level)

Class creation UI/API · Safiri module · two-way message delivery · real SMS/email delivery · external storage · production domain/TLS/hosting execution · observability wiring. All classified with owners/effort in the final decision table (`release-evidence/e2e-results.md` + `ELEKEZA_FINAL_CLOSURE_AUDIT.md` follow-ups).
