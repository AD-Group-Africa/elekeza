# Backend Sprint 3 — Execution, Testing & Safe Push (2026-10-23)

Branch: `sprint-3-safe-config` · Scope: the reported Sprint 3 backend regressions and class-management gaps. No refactors beyond the fixes required.

## Verification commands

| Check | Command | Result (fresh run) |
| --- | --- | --- |
| Full backend suite | `cd backend && ./gradlew test` | BUILD SUCCESSFUL — **341 tests, 0 failures, 0 errors** (from `build/test-results/test/*.xml` aggregation) |
| Targeted re-runs during fix loop | `./gradlew test --tests com.elekeza.backend.teacher.TeacherStudentsApiTest` (and per-class) | BUILD SUCCESSFUL |
| Frontend build | `cd frontend && npm run build` | BUILD SUCCESSFUL — all routes compiled, prerender lookup printed |
| Flyway/Postgres validation | local harness `backend/flyway-validation/` (PgRunner + vendored Flyway 9.22.3 against Postgres 42.6.2 driver) | executed during this sprint; artifacts intentionally **not committed** (local scratch) |

## Issues investigated → fixes implemented

### A. Guardian calendar school dates (regression + gap)
- Root cause: guardians had no access to the school calendar; `GET /api/deadlines` was never surfaced to them.
- Fix: `GuardianScheduleController` now merges upcoming deadlines into `/api/guardian/schedule` under an explicit tenant-safe visibility rule: NATIONAL/REGIONAL are public, institution scope requires an **active** guardian link to a learner of that institution (guardians carry no institution of their own), plus the guardian's personal deadlines.
- File: `backend/.../guardian/GuardianScheduleController.kt`
- Tests: `backend/.../guardian/GuardianSchoolDatesTest.kt` (new).

### B. Teacher student IDs as JSON strings (regression)
- Root cause: `TeacherController.StudentDto.id` had been changed to `String` (`.toString()`), breaking the established numeric contract the frontend types expect.
- Fix: `StudentDto.id: Long` again, on both `/api/teacher/students` and create. Frontend `teacher/students/page.tsx` type pinned to `number` with numeric-keyed state maps.
- Files: `backend/.../teacher/TeacherController.kt`, `frontend/src/app/teacher/students/page.tsx`.
- Tests: `backend/.../teacher/TeacherStudentsApiTest.kt` (new — asserts the JSON **type**, not just the value). Note: the teacher fixture must be created inside an institution (institution 1 in the dev seed); a teacher without one legitimately gets an empty list.

### C. Lesson file upload ignored the submitted title (regression)
- Root cause: file upload had no `title` `@RequestParam` and silently used the filename.
- Fix: optional `title` param is honored when present, blank/missing falls back to the filename, >255 chars rejected with 400 (instead of a DB failure).
- File: `backend/.../content/ContentController.kt`.
- Tests: `backend/.../content/ContentUploadTitleTest.kt` (new).

### D. Feature flags disappeared after backend restart (regression)
- Root cause: admin runtime overrides lived only in an `in-memory ConcurrentHashMap` — a kill switch that killed itself.
- Fix: V19 migration adds `feature_flag_overrides` (PK `flag_name`, `enabled`, `updated_by`, `updated_at`); `FeatureFlags` now layers DB overrides over the yaml `features` defaults, which remain the source of truth for enabled-by-default.
- Files: `backend/.../common/FeatureFlags.kt`, `backend/src/main/resources/db/migration/V19__feature_flag_overrides.sql`.
- Tests: `backend/.../common/FeatureFlagPersistenceTest.kt` (new).

### E. Attendance percentages inconsistent, no period labels
- Root cause: three independently-inlined formulas diverged; the guardian **digest** divided by all records including EXCUSED (understating attendance vs the `/api/attendance` endpoints for identical marks), and "no records" was reported as an invented `100%`.
- Fix: single `AttendancePolicy.rate()` in `AttendanceEntities.kt` used by learner history, institution summary and guardian digest: attended = PRESENT+LATE over assessed = PRESENT+ABSENT+LATE; EXCUSED excluded from both sides; **null** when nothing is assessed. Explicit `periodFrom`/`periodTo`/`periodLabel` (`ALL_TIME`, `LAST_60_DAYS`, `CUSTOM_RANGE`, `NO_RECORDS`) added everywhere the UI lists a rate.
- Files: `backend/.../attendance/AttendanceEntities.kt`, `AttendanceService.kt`, `AttendanceController.kt`, `backend/.../guardian/GuardianDigestController.kt`, `frontend/src/app/attendance/page.tsx`, `frontend/src/lib/api.ts`.
- Tests: extended `backend/.../attendance/AttendanceApiTest.kt` and `backend/.../guardian/GuardianDigestTest.kt`.

### Class-management gaps also closed this sprint
- Devices: `DELETE /api/devices/{id}/assignment` (unassign open assignment, idempotent) and `PATCH /api/devices/{id}` (edit label) — both `SCHOOL_ADMIN`/`ADMIN`, tenant-checked, audited. Tests extended in `DevicesAndBillingApiTest.kt`.
- Verified already-existing behaviour rather than duplicating: create class, enroll/remove learners, rename, archive, teacher assignment (existing coverage in `CurriculumApiTest`, `TimetableApiTest`, institution suites).
- Content: upload title fix (C) plus existing traversal hardening retained; `ContentUploadSecurityTest` remains green.

## Security review notes
- All new/changed endpoints carry `@PreAuthorize` role checks and the same institutional scoping as their neighbours; deadline visibility and guardian digest reuse the established link (`GuardianLink.currentlyActive()`), never cross-tenant IDs from the client.
- No auth weakening, no test skipping, no validation relaxation anywhere in this sprint.
- M-Pesa regression tests (`MpesaCallbackVerificationTest`, `MpesaCallbackFailureTrustSourceTest`) updated to the Sprint-2 semantics: verifier failures are surfaced as `Unavailable` (never treated as trust evidence) plus a forged-failure protection case.

## Migration / config changes
- New V19 Flyway migration (additive only; no existing tables touched). H2 (dev/tests) and Postgres were both exercised.
- No application.yaml changes required.

## Remaining / not part of this sprint
- Daraja live callbacks, production Postgres, SMTP/DNS/TLS and CI integration checks remain external readiness items — see `docs/PAYMENT-*` and `docs/PRODUCTION_READINESS.md`; unchanged by this sprint.
- `backend/flyway-validation/` (vendored jars, class files) is a local validation harness and is deliberately left untracked.

## Git
- Commit on `sprint-3-safe-config`: see `git log -1` (fix(elekeza): complete sprint 3 backend regressions …).
