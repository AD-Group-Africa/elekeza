# ELEKEZA — API REFERENCE

> Verified routes (40 controllers; this is the operator-facing subset). Auth = JWT httpOnly cookie
> (`elewa_access`) unless noted. All mutating requests require CSRF (`X-XSRF-TOKEN`) except the
> exempt list in ARCHITECTURE.md §4. Full controller inventory: `ELEKEZA_FINAL_SYSTEM_MAP.md` §4
> (release-evidence copy).

## Conventions

- Base path `/api`. Errors: JSON, no stack traces; 401 `AUTH_REQUIRED`, 403 role/object denials,
  429 rate limit, 409 conflicts, 400 validation.
- Roles: STUDENT, TEACHER, GUARDIAN, ADMIN, SCHOOL_ADMIN.

## Auth

| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/auth/register` | public | creates STUDENT only; 409 duplicate |
| POST | `/auth/login` | public | 429 after 5 fails/60s per email+IP |
| POST | `/auth/refresh` | public (cookie) | rotates hashed refresh token; reuse → 401 |
| POST | `/auth/logout` | auth | revokes refresh server-side |
| GET | `/auth/me` | auth | identity + role + institutionId |
| POST | `/auth/csrf` | public | mints CSRF cookie token |
| POST | `/auth/forgot-password`, `/auth/reset-password` | public | single-use hashed token; never reveals account existence |

## Institution & people

| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/institutions/register` | public | 201 → institution + SCHOOL_ADMIN |
| GET | `/institutions/{id}/students` | SCHOOL_ADMIN (own) / ADMIN | 403 cross-tenant |
| POST | `/institutions/{id}/students/import` | SCHOOL_ADMIN (own) / ADMIN | CSV columns: `firstName,lastName,grade,sneType,guardianEmail,guardianPhone,guardianName,guardianRelationship`; returns ImportResult incl. studentCredentials (learner logins panel) |
| POST | `/institutions/{id}/staff` | SCHOOL_ADMIN (own) / ADMIN | `{email,name,role}` → one-time `tempPassword` in response only |
| POST | `/institutions/{id}/staff/password-reset` | SCHOOL_ADMIN | standard single-use token email flow |
| Classes | class/session endpoints | TEACHER/SCHOOL_ADMIN | **EL-F-007: no class-creation API yet — classes exist only via seed** |

## Content & lessons

| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/content/upload/text` | TEACHER+ | `{title,text,subject}` → `{lessonId,adapted,message}`; AI failure → honest fallback to raw text |
| POST | `/content/upload/file` | TEACHER+ | PDF/DOCX/TXT; 10 MB cap; allow-list; flattened storage names |
| GET | `/content/lessons/{id}` | access-guarded | institution/ownership/assigned rule |
| GET | `/content/lessons/{id}/adapted?code=` | access-guarded | `original|clearer|step_by_step|spaced|detailed`; learner-scoped cache |
| POST | `/content/lessons/{id}/feedback` | access-guarded | `{helpful, code}` |
| PATCH | `/content/lessons/{id}/sections/{sectionId}/progress` | auth | time spent |
| POST | `/content/lessons/{id}/term-tap` | auth | key-term interaction event |

## Quiz

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/quiz/{lessonId}/start` | access-guarded | never returns answer key |
| POST | `/quiz/{quizId}/answer` | attempt owner | JSON-number `questionId` + `selectedOptionId` letter |
| POST | `/quiz/{quizId}/complete` | attempt owner | body `List<AnswerSubmission>{questionId,selectedOption}`; 409 on duplicate attempt; score server-computed |
| GET | `/quiz/{quizId}/review` | attempt owner | own completed attempt only |

## Learner experience

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET/PUT | `/learner/preferences` | STUDENT (self) | effective map / `{key,value}` |
| GET | `/progress/dashboard` | auth | completedLessons, quizzesTaken, recentLessons, upcomingQuizzes |
| POST | `/tutor` | STUDENT | `{action, lessonId}`; AI-degradation journey covers outage |
| GET | `/gamification/student`, `/analytics/student` | STUDENT | computed from persisted completions |

## Teacher

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/teacher/students` | TEACHER | institution-scoped |
| GET | `/teacher/student/{id}` (+`/progress`, `/learning-support`) | TEACHER/SCHOOL_ADMIN/ADMIN | 403 other institution |
| POST | `/teacher/content/assign` | TEACHER | bulk assign → LessonProgress + notification |
| POST | `/teacher/student/{id}/learning-preferences` | TEACHER+ | guidance; **409 if learner chose that key** |
| POST | `/teacher/guardian-link` | TEACHER/ADMIN | link guardian ↔ learner |
| GET | `/analytics/teacher/quiz-results` | TEACHER | per-question analytics, completed attempts only |
| Attendance | class-session endpoints | TEACHER | register save idempotent per day; 403 foreign class |

## Guardian

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/guardian/wards` | GUARDIAN | linked wards only |
| GET | `/guardian/wards/{id}` (+`/progress`) | GUARDIAN (linked) | 403 cross-family |
| GET | `/guardian/wards/{id}/learning-support` | GUARDIAN (linked) | plain-language summary, no labels |
| GET | `/guardian/reports`, `/guardian/schedule` | GUARDIAN | per-ward reports / pending assignments |
| Messages | `/guardian/messages` + `/notifications/send` | GUARDIAN/TEACHER | **EL-NEW-02: stored sender-only — recipient never receives (known defect)** |

## Notifications

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/notifications` | auth | own only |
| POST | `/notifications/{id}/read` | owner | |

## Payments / finance

| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/payments/stkpush` | SCHOOL_ADMIN/ADMIN | 503 when Daraja unconfigured (honest) |
| POST | `/payments/callback` | public, CSRF-exempt | state machine + amount binding + idempotency; forged → `ResultCode:1`, replay → no-op |
| GET | `/payments/revenue` | ADMIN | aggregates COMPLETED |
| Fees | `/fees/*` (charges, payments, balances) | role-scoped | allocation server-derived |

## Ops

| Method | Path | Notes |
|---|---|---|
| GET | `/actuator/health` | only exposed actuator endpoint; `show-details: never` |
| GET | `/ai/health` (ai-elewa :8001) | `{"status":"ok"}`; provider fail-fast at boot on non-real provider |

## AI service (internal, `X-Internal-Key`)

| Method | Path | Purpose |
|---|---|---|
| POST | `/ai/simplify/text`, `/ai/simplify/image` | 4-stage lesson pipeline |
| POST | `/ai/quiz/generate` | quiz generation |
| POST | `/ai/quiz/adaptive-response`, `/ai/quiz/wrong-answer-flow` | tutor feedback flows |

**P0 FIXED (2026-10-03):** ai-elewa previously accepted requests without the key when
`INTERNAL_SECRET` was unset (fail-open → 422 instead of 401). Now fail-closed: unset/empty secret →
**401 on every endpoint** (verified live both directions); valid key → auth passes. Backend
`ai.internal-secret` is fail-fast (no dev fallback outside the dev profile). Remaining: AI r3
release authorization. See SECURITY.md §5.
