# HOW TO APPLY THIS PACKAGE

Apply files in this exact order. Each section tells you the **source path inside this zip**,
the **destination path in your repo**, and **what changed**.

---

## STEP 1 — Build file (OpenCSV dependency)

| Source | Destination |
|---|---|
| `backend/build.gradle.kts` | `backend/build.gradle.kts` |

**What changed:** Added `com.opencsv:opencsv:5.9` — required by InstitutionService CSV import.
Also removed `spring-boot-starter-oauth2-client` (was causing startup failures when Google
credentials were absent).

---

## STEP 2 — Auth updates (SCHOOL_ADMIN role, institutionId)

| Source | Destination |
|---|---|
| `backend/config/User.kt` | `backend/src/main/kotlin/com/elekeza/backend/auth/User.kt` |
| `backend/config/UserRepository.kt` | `backend/src/main/kotlin/com/elekeza/backend/auth/UserRepository.kt` |
| `backend/config/SecurityConfig.kt` | `backend/src/main/kotlin/com/elekeza/backend/config/SecurityConfig.kt` |
| `backend/config/application.yaml` | `backend/src/main/resources/application.yaml` |

**What changed:**
- `User.kt`: Added `SCHOOL_ADMIN` to `UserRole` enum; added `institutionId: Long?` field
- `UserRepository.kt`: Added `findByInstitutionIdAndRole()` and `findByInstitutionId()` queries
- `SecurityConfig.kt`: Added `/api/institutions/**` route protection; `/api/institutions/register` public; `SCHOOL_ADMIN` role included in teacher/admin routes
- `application.yaml`: Added `ai.client.type: ${AI_CLIENT_TYPE:real}`; disabled OAuth2 autoconfigure; `baseline-on-migrate: true` prevents Flyway failure on existing DBs

---

## STEP 3 — Institution module (NEW)

Create the directory: `backend/src/main/kotlin/com/elekeza/backend/institution/`

| Source | Destination |
|---|---|
| `backend/institution/Institution.kt` | `…/backend/institution/Institution.kt` |
| `backend/institution/InstitutionService.kt` | `…/backend/institution/InstitutionService.kt` |
| `backend/institution/InstitutionController.kt` | `…/backend/institution/InstitutionController.kt` |

**What this adds:** School self-registration, CSV bulk student import with guardian linking,
school summary endpoint. Registers all under `/api/institutions/`.

---

## STEP 4 — Notification module (NEW)

Create: `backend/src/main/kotlin/com/elekeza/backend/notification/`

| Source | Destination |
|---|---|
| `backend/notification/Notification.kt` | `…/backend/notification/Notification.kt` |

**What this adds:** `Notification` entity, `NotificationRepository`, `NotificationService`,
`NotificationController`. Guardian notified async after every quiz completion.

---

## STEP 5 — Analytics module (NEW)

Create: `backend/src/main/kotlin/com/elekeza/backend/analytics/`

| Source | Destination |
|---|---|
| `backend/analytics/Analytics.kt` | `…/backend/analytics/Analytics.kt` |

**What this adds:** `AnalyticsService` + `AnalyticsController`. School admins hit
`GET /api/analytics/institution`; platform admins hit `GET /api/analytics/platform`.

---

## STEP 6 — Updated QuizController (notification trigger)

| Source | Destination |
|---|---|
| `backend/institution/QuizController.kt` | `backend/src/main/kotlin/com/elekeza/backend/quiz/controller/QuizController.kt` |

**What changed:** `completeQuiz()` now calls `notificationService.notifyGuardianOnQuizComplete()` async.
`submitAnswer()` now calls `aiClient.adaptiveResponse()`. All progress writes use authenticated user.

---

## STEP 7 — Updated ContentController

| Source | Destination |
|---|---|
| `backend/content/ContentController.kt` | `backend/src/main/kotlin/com/elekeza/backend/content/ContentController.kt` |

**What changed:** `listAll()` now filters by userId (teachers only see their own content).
`getLesson()` now extracts `keyTerms` from AI JSON alongside sections.

---

## STEP 8 — Updated Repositories

| Source | Destination |
|---|---|
| `backend/institution/Repositories.kt` | `backend/src/main/kotlin/com/elekeza/backend/learner/Repositories.kt` |

**What changed:** Added `findByUserIdAndContentId()` to `LessonProgressRepository`
(was missing — caused compile error in QuizController).

---

## STEP 9 — Database migrations

| Source | Destination |
|---|---|
| `backend/migration/V25__multi_school_foundation.sql` | `backend/src/main/resources/db/migration/V25__multi_school_foundation.sql` |

**What this adds:** `institution_id` FK on `users`, `notifications` table, `import_jobs` table,
`institution_invites` table, guardian email index.

---

## STEP 10 — Frontend: updated files

| Source | Destination |
|---|---|
| `frontend/next.config.ts` | `frontend/next.config.ts` |
| `frontend/components/SidebarLayout.tsx` | `frontend/src/components/layout/SidebarLayout.tsx` |
| `frontend/app/school/onboarding/page.tsx` | `frontend/src/app/school/onboarding/page.tsx` |
| `frontend/app/school/import/page.tsx` | `frontend/src/app/school/import/page.tsx` |
| `frontend/app/parent-portal/page.tsx` | `frontend/src/app/parent-portal/page.tsx` |
| `frontend/app/notifications/page.tsx` | `frontend/src/app/notifications/page.tsx` |

**What changed:**
- `next.config.ts`: API URL now env-driven via `NEXT_PUBLIC_API_URL` (no hardcoded localhost)
- `SidebarLayout.tsx`: SCHOOL_ADMIN nav items, live unread notification badge, parent-portal link
- `school/onboarding`: New 3-step school registration wizard
- `school/import`: CSV drag-drop import with template download and row-level results
- `parent-portal`: Full guardian dashboard with ward progress, home activities, notification feed
- `notifications`: Replaces "Coming Soon" stub with real notification list + mark-read

---

## STEP 11 — Infrastructure

| Source | Destination |
|---|---|
| `infrastructure/nginx/nginx.conf` | `infrastructure/nginx/nginx.conf` |

Update `server_name` to your actual domain before deploying.

---

## STEP 12 — Documentation

| Source | Destination |
|---|---|
| `docs/ELEKEZA_DOCS.md` | `docs/ELEKEZA_DOCS.md` (or README) |

---

## VERIFY

After applying all files:

```bash
# 1. Compile check
cd backend && ./gradlew compileKotlin
# → should complete with 0 errors

# 2. Run dev
./gradlew bootRun --args='--spring.profiles.active=dev'
# → "Started ElekezaApplication in X seconds"
# → No Flyway errors (dev profile uses H2 with ddl-auto=update)

# 3. Test login
curl -s -X POST http://localhost:9090/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"teacher@elekeza.app","password":"teacher123"}' | python3 -m json.tool
# → {"learnerId":1, "accessToken":"eyJ...", "role":"TEACHER", "onboardingComplete":true}

# 4. Test school registration
curl -s -X POST http://localhost:9090/api/institutions/register \
  -H 'Content-Type: application/json' \
  -d '{"name":"Test School","adminEmail":"admin@test.ac.ke","adminName":"Admin","adminPassword":"password123"}' | python3 -m json.tool
# → {"institutionId":1, "adminEmail":"admin@test.ac.ke", "plan":"STARTER", ...}
```
