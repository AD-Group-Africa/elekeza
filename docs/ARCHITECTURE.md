# ARCHITECTURE — Elekeza

Status: verified against repository on branch `release/v0.1.0` (baseline: 151 backend tests green, frontend typecheck/lint/build green).

## Shape

Elekeza is a **modular monolith**:

- `backend/` — Kotlin + Spring Boot, package-per-domain under `com.elekeza.backend`
- `frontend/` — Next.js (App Router) + TypeScript + Tailwind, PWA-enabled
- One repository, no microservices. Boundaries are package boundaries; extraction to services is deferred until a scaling/security/team boundary demands it.

## Backend domains (as they exist today)

| Domain | Package | Contents (verified) |
| --- | --- | --- |
| Identity & Access | `auth` | Cookie-based JWT access/refresh, BCrypt, CSRF, login rate limiting, forgot-password |
| Learner Profile | `learner` | `LearnerProfile` (JSONB `preferences`, `adaptationState`, `sneType`), `LearnerPreferencesController`, `GamificationController`, `ProgressController` |
| Accessibility & Personalization | `personalization` | `LearningPreferences` (typed keys + `Source` precedence), `PersonalizationService`, deterministic `TextAdaptation` engine, `AdaptationSafety` guards, `SignalAccumulator` |
| Learning Content | `content` | `Lesson`, `LessonSection`, `KeyTerm`, `LessonPersistenceService`, `ContentAccessGuard` (institution isolation) |
| Assessments | `quiz`, `exam` | Server-scored quizzes (`QuizController`), server-authoritative exams (startedAt/expiresAt, immutable submissions) |
| Progress | `learner` + `analytics` | `ProgressController` dashboard, `LessonProgress` updated transactionally with quiz completion |
| Gamification | `learner/GamificationController` | Points, levels, stars, achievements, streak — computed from persisted completion data |
| AI Learning Support | `common/ai` | `AiClient` interface, `RealAiClient` (Groq), `MockAiClient` (deterministic), `AiWebClientConfig` |
| Teacher | `teacher` | Students, progress, learning-support signals, learning-preferences read surfaces |
| Guardian | `guardian` | Wards, ward detail, `GuardianLearningSupportController` (plain-language summaries) |
| Institution | `institution` | Registration, admin management |
| Notifications | `notification` | In-app notifications; provider-abstracted email/SMS delivery |
| Payments | `payments` | M-Pesa lifecycle: state machine, idempotency, callback, reconciliation (STK push pending live Daraja credentials) |
| Support signals | `support` | `SignalCalculator`, teacher support dashboard backend |
| School ops | `calendar` | Timetable/schedule support |
| Waitlist | `waitlist` | Public landing sign-up |

## Cross-cutting infrastructure

- **Provider abstraction** (dependency-inversion, all in `common/`): `AiClient`, `EmailProvider` (JavaMail/Mock), SMS provider (Africa's Talking/Mock), storage (Cloudflare R2/Mock). Every external dependency is switchable by configuration; the product runs fully on mocks (`AI_CLIENT_TYPE=mock` etc.).
- **Persistence**: JPA + Flyway (V1–V4 baseline migrations), H2 in dev, PostgreSQL in production configuration, HikariCP pooling.
- **Security**: RBAC server-side on every protected endpoint, tenant isolation via `ContentAccessGuard`, explicit CORS (no wildcard), CSRF on writes, rate limiting on auth, secret management via environment variables only.

## Frontend structure

- Role-scoped route groups: `student-*`, `teacher/*`, `guardian/*`, `admin`, `super-admin`
- Shared shells: `SidebarLayout` (role-aware nav, skip link, `aria-current`), `DashboardLayout`, `PageShell`
- Learner experience primitives: `LearningCompanion` (SVG+CSS character, reduced-motion aware), `Celebration`, `ReadingToolbar`, `useOfflineSync` (IndexedDB queue), `useAccessibilitySettings`, `useCognitiveProfile`
- PWA: `next-pwa` in `next.config.ts` — precache + runtime caches for lessons, quiz starts, progress, notifications, learner preferences; registered automatically on production builds
- Real backend only: pages read `/progress/dashboard`, `/gamification/student`, `/analytics/student`, `/learner/preferences`, etc. No mock-data pages in the learner journey.

## Deliberate non-goals (current phase)

- Microservice decomposition, Kubernetes, service mesh
- SMS/USSD channel adapters (architecture allows them behind the existing provider abstraction — not yet built)
- Mastery/competency DAG engine (progress today is lesson/quiz-based; the canonical learner-identity core is in place for it)
- KEMIS/KNEC/KICD adapters (interoperability layer is a documented next-phase item; nothing government-specific is hard-coded into the learner core)

## Data flow: the learning loop

```
Learner login (JWT cookie, CSRF)
→ learner home (companion, one primary action)
→ lesson (content from /content/lessons/{id}, presentation adapted by preferences)
→ practice quiz (server-scored; offline answers queue in IndexedDB)
→ LessonProgress updated in the same transaction as quiz completion
→ gamification recomputed from persisted completions
→ guardian notification
→ teacher support/progress surfaces re-read the same completion data
```

Every claim in the pilot reports traces back to this single source of truth: completed quiz attempts and lesson progress rows.
