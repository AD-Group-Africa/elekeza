# ELEKEZA — COMPLETE MODULE INVENTORY

**Generated:** 20 November 2026 · **Candidate:** `c21a404` (+ working-tree changes noted in §7)
**Method:** static inspection of the actual implementation — 44 Spring controllers / 191 route mappings,
61 Next.js routes, 61 PostgreSQL tables, 8 FastAPI endpoints, 64 backend test classes, 10 E2E specs.
No README or prior report was taken as evidence.

Legend: **Operational** · **Partial** · **Broken** · **Absent** · **Unverified** (see matrix for colours).

---

## 0. Discovery summary

| Layer | Count | Source |
|---|---|---|
| Spring `@RestController` classes | 44 (46 files) | `backend/src/main/kotlin` |
| Backend route mappings | **191** | `@*Mapping` extraction |
| Next.js route files (`page.tsx`) | **61** | `frontend/src/app` |
| Frontend feature modules | 22 directories under `frontend/src/features` | `ls` |
| Typed API call sites | **118 distinct paths** | `apiClient.*` extraction |
| PostgreSQL tables | **61** | `CREATE TABLE` across 21 migrations |
| FastAPI endpoints | 8 (7 functional + `/health`) | `ai-elewa/**` excluding venv |
| Backend test classes | 64 (417 tests) | `backend/src/test` |
| E2E specs | 10 (46 journeys) | `frontend/e2e` |
| Provider integrations | 5 families (SMS, email, storage, M-Pesa, AI) | `common/*Provider*`, `payments/*`, `finance/Mpesa*` |

**Two facts that matter more than the counts:**

1. All 61 frontend routes are thin wrappers (~230 bytes) that render a screen from `features/*/screens`.
   There are **no unreachable page files** and **no screen files missing on disk**.
2. The role sidebar is generated from one file (`frontend/src/config/navigation.ts`), so "can a role reach
   this module?" is a single, auditable question — not 61 separate ones.

---

## 1. LEARN — learning management

### 1.1 Content ingestion (text + file)

| Field | Detail |
|---|---|
| Purpose | Turn a teacher's raw material into an adapted lesson + quiz |
| Frontend | `/teacher/content` → `features/lessons` upload UI |
| Backend | `ContentController` (`POST /api/content/upload/text`, `/upload/file`), `ContentProcessingService`, `TextExtractor` (PDFBox/DOCX/TXT) |
| Database | `content`, `lessons`, `lesson_sections`, `key_terms` |
| AI | `simplifyText` + `generateQuiz` (stage 1–4 pipeline) |
| Roles | TEACHER, SCHOOL_ADMIN, ADMIN |
| Dependencies | AI service (or mock client), storage provider |
| Status | **Operational** (upload + extraction + persistence covered by `ContentUploadTitleTest`, `ContentUploadSecurityTest`, `ContentAuthorizationTest`) |
| Outstanding | Real-provider adaptation needs `AI_CLIENT_TYPE=real` + a funded key |

### 1.2 AI adaptation pipeline

| Field | Detail |
|---|---|
| Purpose | Rewrite material for ADHD / autism / dyslexia / intellectual disability / none |
| Frontend | Surfaced through 1.1 and 1.3 |
| Backend | `common/ai/{AiClient,RealAiClient,MockAiClient}`, `AiWebClientConfig` |
| Database | `content_adaptations`, `adaptation_events` |
| AI | `/ai/simplify/text`, `/ai/simplify/image`, `/ai/quiz/generate`, `/ai/quiz/wrong-answer-flow` |
| Roles | Indirect (teacher triggers, learner consumes) |
| Status | **Partial** — code path complete and fail-closed; the dev/E2E posture is `mock`, so real-provider quality is unverified here (603 AI tests cover the pipeline itself) |
| Outstanding | Funded provider key; latency measurement under real load |

### 1.3 Lessons, sections and on-demand adaptation

| Field | Detail |
|---|---|
| Purpose | Read a lesson, switch presentation style |
| Frontend | `/lesson/[id]` (`LessonScreen`, TTS, 4 adaptation styles), `/student-lessons`, `/teacher/lessons` |
| Backend | `ContentController` (`/lessons/{id}`, `/list`, `/status/{id}`), `PersonalizationControllers` (`/api/content/lessons/{id}/adapted`, `/feedback`) |
| Database | `lessons`, `lesson_sections`, `content_adaptations`, `key_terms` |
| AI | `ContentAdaptationService` → `/ai/simplify/text` (cached per learner+style) |
| Roles | STUDENT (read), TEACHER (author), GUARDIAN (read via ward) |
| Status | **Operational** — `LessonScreen` is exercised by the learner-journey E2E |
| Outstanding | — |

### 1.4 Quizzes

| Field | Detail |
|---|---|
| Purpose | Practise and score understanding |
| Frontend | `/quiz/[lessonId]`, `/quiz/review/[quizId]`, `/student-quizzes`, `/teacher/quiz-results` |
| Backend | `QuizController` (`/{lessonId}/start`, `/{quizId}/answer`, `/{quizId}/complete`, `/{quizId}/review`), `QuizProvisioner`, `AiQuizParser` |
| Database | `quizzes`, `quiz_questions`, `quiz_answers`, `quiz_attempts` |
| AI | `adaptiveResponse` for per-answer feedback; `generateQuiz` at ingestion |
| Roles | STUDENT (attempt), TEACHER (results) |
| Status | **Operational** — learner journey E2E; replay returns 409 |
| Outstanding | — |

### 1.5 Examinations

| Field | Detail |
|---|---|
| Purpose | Timed, invigilated assessment with integrity signals |
| Frontend | `/student-exams`, `/teacher/exams`, `/exam` (redirect) |
| Backend | `ExamController` — 19 mappings (create, publish, close, start, answer, submit, mark, results, integrity, guardian results) |
| Database | `exams`, `exam_questions`, `exam_attempts`, `exam_answers`, `exam_integrity_events` |
| AI | None |
| Roles | STUDENT (sit), TEACHER (author/mark), GUARDIAN (results), ADMIN |
| Status | **Operational** — `exam.spec.ts` covers start → timer → autosave → submit → score, immutable replay (409), maxAttempts |
| Outstanding | Manual marking UI is API-only (see matrix) |

### 1.6 Assignments

| Field | Detail |
|---|---|
| Purpose | Teacher assigns content; learner submits; teacher grades |
| Frontend | `/assignments` (learner), `/teacher/assignments`, `/teacher-assignments` |
| Backend | `AssignmentController` — 9 mappings incl. submissions and grading; `teacher/AssignmentController` (`/api/teacher/assignments`) |
| Database | `assignments`, `assignment_submissions` |
| Roles | TEACHER, STUDENT, GUARDIAN (via ward submissions) |
| Status | **Operational** (grade/update endpoints exist but have no UI — API only) |
| Outstanding | Grading screen |

### 1.7 Progress and dashboards

| Field | Detail |
|---|---|
| Purpose | Show what has been learned and what is next |
| Frontend | `/student-home`, `/progress`, `/teacher/progress`, `/guardian` |
| Backend | `ProgressController` (`/dashboard`, `/lessons`), `AnalyticsController`, `StudentProgressController` |
| Database | `lesson_progress`, `class_enrollments` |
| Roles | STUDENT, TEACHER, GUARDIAN, ADMIN |
| Status | **Operational** — covered by journey + theme E2E |

### 1.8 Gamification

| Field | Detail |
|---|---|
| Purpose | Streaks and badges to sustain practice |
| Frontend | Surfaced on learner home/progress |
| Backend | `GamificationController` (`GET /api/gamification/student`) |
| Database | `learning_streaks` (via `LearningStreak`) |
| Roles | STUDENT |
| Status | **Operational** |

### 1.9 Mastery engine + support queue

| Field | Detail |
|---|---|
| Purpose | Decide which lessons a learner has mastered and who needs help |
| Frontend | `/teacher/support` (support signals + queue) |
| Backend | `MasteryController` (`/learner/{id}`, `/teacher/support`), `MasteryEngine`, `SupportController` (6 mappings) |
| Database | `support_flags`, `interventions`, `quiz_attempts` |
| Roles | TEACHER, SCHOOL_ADMIN |
| Status | **Operational** — teacher support panel asserted in E2E |

### 1.10 AI tutor

| Field | Detail |
|---|---|
| Purpose | Answer a learner's question in their own register, grounded in the lesson |
| Frontend | `/student-ai-tutor` (`TutorScreen`) |
| Backend | `TutorController` (`POST /api/tutor`, `GET /api/tutor/status`), `TutorService`, `TutorEngine` |
| Database | none (stateless) |
| AI | `/ai/tutor/chat`, with a deterministic offline fallback and an EN→SW glossary |
| Roles | STUDENT only (by design) |
| Status | **Partial** — the deterministic engine always answers; the LLM path activates only when the provider is configured (`providerConfigured` flag exposed) |
| Outstanding | Provider key; per-learner quota (§4 of the security report) |

### 1.11 Personalization / learning preferences

| Field | Detail |
|---|---|
| Purpose | Per-learner presentation and guidance preferences |
| Frontend | `/learner/preferences`, teacher "learning support" panel |
| Backend | `PersonalizationControllers` (`/api/learner/preferences`, `/api/teacher/student/{id}/learning-support`, `/learning-preferences`) |
| Database | `learning_preferences` (via entities), `learner_profiles` |
| Roles | STUDENT, TEACHER |
| Status | **Operational** — preferences E2E test asserts a saved choice survives |

### 1.12 Curriculum

| Field | Detail |
|---|---|
| Purpose | Kenyan CBC hierarchy: learning area → strand → sub-strand → competency → objective |
| Frontend | `/curriculum` (read/mapping) |
| Backend | `CurriculumController` (7), `CompetencyProgressController` (2) |
| Database | `learning_areas`, `strands`, `sub_strands`, `competencies`, `learning_objectives` |
| Roles | TEACHER, SCHOOL_ADMIN, ADMIN |
| Status | **Partial** — read + content↔objective mapping exist; the five authoring POSTs (areas/strands/sub-strands/competencies/objectives) have **no UI** |
| Outstanding | Curriculum authoring screen, or seed the official CBC tree |

### 1.13 Calendar and deadlines

| Field | Detail |
|---|---|
| Purpose | School calendar, county-scoped deadlines |
| Frontend | `/calendar` |
| Backend | `DeadlineController` (`/api/deadlines` CRUD) |
| Database | `deadlines` |
| Roles | TEACHER, SCHOOL_ADMIN, STUDENT, GUARDIAN |
| Status | **Partial** — read works; create/delete are API-only |

### 1.14 Study plans

| Field | Status |
|---|---|
| Frontend | `/teacher/plans` — renders `ComingSoon` |
| Backend | none |
| Status | **Absent** (deliberate placeholder) |

---

## 2. ERP — school management

| # | Module | Frontend | Backend | Tables | Status |
|---|---|---|---|---|---|
| 2.1 | Institution registration / onboarding | `/school/onboarding` | `InstitutionController` (`POST /register`) | `institutions` | **Operational** — E2E creates a real school + SCHOOL_ADMIN |
| 2.2 | Institution dashboard | `/admin` | `AnalyticsController`, `InstitutionController` | `institutions`, `users`, `class_enrollments` | **Operational** (verified by the new school-admin spec) |
| 2.3 | Staff management | `/admin/staff` | `StaffManagementController` (list, create, activate/deactivate, password-reset) | `users` | **Partial** — list + create wired; deactivate and password-reset are API-only |
| 2.4 | Learner records | `/admin/learners`, `/teacher/students` | `TeacherController` (`/students`, `/student`), `InstitutionController` (`/{id}/students`) | `users`, `learners`, `learner_profiles` | **Operational** |
| 2.5 | CSV learner import | `/school/import` | `InstitutionController` (`POST /{id}/students/import`), `InstitutionService` (OpenCSV) | `users`, `learners`, `guardians`, `guardian_links` | **Operational** (no automated test — see matrix) |
| 2.6 | Classes and enrolment | `/classes` | `attendance/ClassManagementController` (`/api/attendance/classes`) | `classes`, `class_enrollments` | **Operational** |
| 2.7 | Attendance | `/attendance` | `AttendanceController`, `AttendanceService`, sessions API | `attendance_records`, `attendance_sessions` | **Operational** — E2E marks and saves a register; session-based API has no UI |
| 2.8 | Timetable | `/teacher/timetable` | `TimetableController` (`/api/timetable/{classId}`, `/slot`, delete) | `timetable_entries` | **Partial** — teacher UI works; no school-admin authoring view |
| 2.9 | Finance — fees, structures, charges, payments | `/finance`, `/fees`, `/guardian/fees` | `FinanceController` (15 mappings) | `fee_structures`, `fee_items`, `learner_charges`, `payments`, `payment_allocations` | **Operational** — guardian + admin finance both asserted in E2E |
| 2.10 | M-Pesa STK push / callback / reconciliation | `/school/payment` | `MpesaController`, `MpesaService`, `MpesaStatusVerifier`, `MpesaReconciliationService` | `mpesa_transactions` | **Partial / blocked** — implemented and sandbox-configured; **no live financial activation authorised** |
| 2.11 | Billing, plans, entitlements, invoices | none | `BillingController` (5), `CountryConfigController` (2) | `billing_plans`, `billing_subscriptions`, `billing_invoices`, `country_configs` | **Absent from UI** — backend complete, zero frontend callers |
| 2.12 | Devices | `/admin/devices` | `DeviceController` (7) | `devices`, `device_assignments` | **Partial** — admin list wired; assign/status/patch/delete are API-only |
| 2.13 | Academic years / terms | none | none (`academic_periods` referenced only by finance entities and seed) | `academic_periods` | **Absent** — data model exists, no API, no UI |

---

## 3. INTELLIGENCE — analytics and insight

| # | Module | Frontend | Backend | Status |
|---|---|---|---|---|
| 3.1 | Teacher analytics | `/teacher` dashboard | `AnalyticsController` (`/api/analytics/teacher`, `/teacher/quiz-results`) | **Operational** |
| 3.2 | School insights | `/analytics` | `AnalyticsController` (`/admin`, `/admin/overview`) | **Partial** — verified to load in the new spec; institution scoping asserted in `GovernanceRegressionTest` |
| 3.3 | Learner analytics | `/progress` | `/api/analytics/student`, `/dashboard` | **Operational** |
| 3.4 | Guardian analytics | `/guardian` | `/api/analytics/guardian` | **Partial** — endpoint live, guardian UI composes its own view |
| 3.5 | Engagement analytics | `/analytics` | `EngagementController` (`/api/engagement/**`), `engagement_events` | **Partial** — event capture live; institution summary has no UI |
| 3.6 | Honesty of numbers | — | Dashboards read the database, not fixtures. Empty institutions render zeros (asserted in E2E) | **Operational** |

---

## 4. ASSISTIVE — inclusive learning

| # | Feature | Implementation | Evidence | Status |
|---|---|---|---|---|
| 4.1 | Text-to-speech | `features/accessibility/useTextToSpeech.ts`, `LessonSection` | Used in lesson screen | **Operational** |
| 4.2 | Text scale 0.9–2.0 | `AccessibilitySettingsScreen`, profile API | Persists across reload (theme E2E) | **Operational** |
| 4.3 | Calm theme / reduced motion / high-contrast focus | `globals.css`, `AccessibilitySettingsProvider` | Theme E2E covers persistence per account and per role | **Operational** |
| 4.4 | Simplified language | AI pipeline + `plainLanguage` toggle | 603 AI tests | **Operational** (mock provider in dev) |
| 4.5 | Keyboard / screen-reader navigation | skip link, landmarks, labelled controls | `a11y.spec.ts` + axe scans | **Operational** (no formal WCAG audit claimed) |
| 4.6 | Kiswahili | `translateContent` setting; tutor translate action; offline EN→SW glossary | Code inspection | **Partial** — content-level only; UI is English-only |
| 4.7 | Low-bandwidth | PWA service worker caches lesson/quiz/progress | `offline.spec.ts` (queue, honest offline state, sync on reconnect) | **Operational** |
| 4.8 | Per-learner support preferences | `/learner/preferences`, teacher guidance | preferences E2E | **Operational** |

---

## 5. DATA — records, privacy, governance

| # | Module | Backend | Tables | Frontend | Status |
|---|---|---|---|---|---|
| 5.1 | Tenant isolation | Every controller scopes by `institutionId`; `MultiTenantAuthorizationTest` | — | — | **Operational** |
| 5.2 | Guardian relationships | `GuardianLinkLifecycleController` (create/revoke/restore/temporary), `GuardianController` | `guardian_links`, `guardians` | `/guardian/wards`, admin forms | **Partial** — lifecycle API complete; revoke/restore have no UI |
| 5.3 | Consent | `PrivacyController` (`/consent`, `/consent/active`, withdraw) | `consent_records` | none | **Absent from UI** |
| 5.4 | Erasure | `PrivacyController` (`POST /erasure`, `/erasure/history`), `AccountErasureService` | `data_erasure_log` | none | **Absent from UI** |
| 5.5 | Retention | `RetentionAdminController`, `RetentionService` | `retention_runs` | none | **Absent from UI** (admin-only API) |
| 5.6 | Audit trail | `AuditLogService` (`GET /api/admin/audit`) | `audit_logs` | none | **Absent from UI** |
| 5.7 | Data export | — | — | — | **Absent** (import only) |
| 5.8 | Backup / restore | runbook + drill | — | — | **Operational** (documented, drilled) |

---

## 6. CONNECT — communication

| # | Module | Frontend | Backend | Tables | Status |
|---|---|---|---|---|---|
| 6.1 | Teacher ↔ guardian messaging | `/teacher/communication`, `/guardian/communication` | `MessageController` (`/api/teacher/messages`, `/api/guardian/messages`, `/guardian/teachers`) | `notifications` (message rows) | **Operational** — asserted in E2E |
| 6.2 | Notifications | `/notifications` | `NotificationService` (`/api/notifications`, `/unread`, `/{id}/read`, `/read-all`) | `notifications` | **Partial** — API + page exist; delivery fan-out is in-app only |
| 6.3 | SMS (Africa's Talking) | — | `AfricaTalkingSmsProvider`, `MockSmsProvider` | — | **Blocked** — implemented, `SMS_PROVIDER=mock`, no credentials |
| 6.4 | Email (SMTP) | — | `JavaMailEmailProvider`, `MockEmailProvider` | — | **Blocked** — implemented, `MAIL_*` unset; password reset uses it |
| 6.5 | Storage (Cloudflare R2) | — | `CloudflareR2Provider`, `MockStorageProvider` | — | **Blocked** — implemented, `STORAGE_PROVIDER=mock` |
| 6.6 | Announcements | — | — | — | **Absent** |
| 6.7 | Offline sync | `features/quiz/useOfflineSync.ts` | — | IndexedDB `elekeza-offline` | **Partial** — quiz answers only |
| 6.8 | USSD | — | — | — | **Absent** (not required for pilot) |
| 6.9 | WhatsApp | — | — | — | **Absent** |

---

## 7. PLATFORM

| # | Module | Detail | Status |
|---|---|---|---|
| 7.1 | Authentication | JWT access (15 min) + hashed refresh (7 d), CSRF cookie token, session refresh interceptor, login throttling | **Operational** |
| 7.2 | Password reset | `/forgot-password`, `/reset-password`, single-use tokens | **Operational** (email delivery mock) |
| 7.3 | Role guards | Server rules in `SecurityConfig`; client guards per route | **Operational** — learner/teacher negative tests in E2E |
| 7.4 | Platform admin console | `/super-admin` | **Partial** — loads; contents limited |
| 7.5 | Feature flags | `FeatureFlags`, `/api/admin/flags`, `feature_flag_overrides` | **Absent from UI** |
| 7.6 | Waitlist | `/waitlist`, `WaitlistController` | **Partial** (public capture; admin list has no UI) |
| 7.7 | Health / metrics | `/actuator/health`, `/api/system/metrics` | **Operational** (no dashboard) |
| 7.8 | Request correlation | `RequestCorrelationFilter` (new) | **Operational** |
| 7.9 | Monitoring / error capture | none | **Absent** (needs DSN decision) |

---

## 8. Known frontend placeholders

Four routes render `ComingSoon` and are **honestly labelled**, not fake:

| Route | Status |
|---|---|
| `/government` | Absent — county/government aggregation not built |
| `/marketplace` | Absent — content marketplace not built |
| `/therapist` | Absent — therapist role not built |
| `/teacher/plans` | Absent — study planner not built |

None is linked from any role's sidebar, so no user is led into a dead end.

---

## 9. Changes made during this inventory

| Change | Why |
|---|---|
| Seeded `schooladmin@elekeza.app` (SCHOOL_ADMIN, demo institution) in `DataInitializer` | The dev seed had **no** school administrator, so no admin screen had ever rendered real data — only a freshly onboarded empty school. Closes backlog R-06/R-27 |
| Added `frontend/e2e/school-admin-modules.spec.ts` | Exercises all 11 school-admin destinations + platform admin, and asserts seeded staff/learner records actually appear |
| Updated `helpers.ts` | Documents that the SCHOOL_ADMIN gap is closed, and exports the fixture |

## 10. What this inventory cannot tell you

- **Whether a module renders *correct* data at scale.** Route-level success ≠ business correctness; only the
  E2E-asserted journeys (learner, teacher, guardian, attendance, finance, exam, messaging) check values.
- **Real-provider behaviour.** SMS, email, R2, M-Pesa and the LLM are all mock/unauthorised by design.
- **Anything hosted.** No staging environment exists; every status above is local.
