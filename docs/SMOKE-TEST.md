# Elekeza — Smoke Test

Run against a prod-profile backend (PostgreSQL + Flyway, e.g. the local
verification instance on `:8083`). CSRF-protected writes need
`X-XSRF-TOKEN` = the `XSRF-TOKEN` cookie value from `GET /api/auth/csrf`.

## Results from the v1.0.0 release audit (local prod-profile instance, PostgreSQL 15)

| # | Role | Action | Result | HTTP | PASS |
|---|---|---|---|---|---|
| 1 | TEACHER | login | Alice Mwalimu returned | 200 | ✅ |
| 2 | TEACHER | CSRF fetch | token issued | 200 | ✅ |
| 3 | TEACHER | upload text | `lessonId:2 status:READY` (AI fallback, see note) | 200 | ✅ |
| 4 | TEACHER | list content | both lessons listed | 200 | ✅ |
| 5 | TEACHER | analytics | teacher analytics allowed | 200 | ✅ |
| 6 | STUDENT | login | Juma Ali returned | 200 | ✅ |
| 7 | STUDENT | dashboard | empty state | 200 | ✅ |
| 8 | STUDENT | start quiz | real questions, **no answer key** in payload | 200 | ✅ |
| 9 | STUDENT | answer correct | `{"correct":true}` (server-side grading) | 200 | ✅ |
| 10 | STUDENT | answer wrong | `{"correct":false}` | 200 | ✅ |
| 11 | STUDENT | complete quiz | score 50, feedback with explanations | 200 | ✅ |
| 12 | STUDENT | access control | start quiz on unassigned content → denied | 403 | ✅ |
| 13 | STUDENT | teacher route | `/api/teacher/students` denied | 403 | ✅ |
| 14 | STUDENT | admin route | `/api/admin/audit` denied | 403 | ✅ |
| 15 | STUDENT | dashboard after quiz | `completedCount:1 averageScore:50` | 200 | ✅ |
| 16 | GUARDIAN | login | Fatima Ali returned | 200 | ✅ |
| 17 | GUARDIAN | wards | Juma Ali with score/progress history | 200 | ✅ |
| 18 | any | logout | session revoked, `/api/auth/me` → 401 | 200 | ✅ |
| 19 | any | refresh rotation | refresh issued new tokens | 200 | ✅ |
| 20 | any | wrong password | rejected | 401 | ✅ |
| 21 | anonymous | protected route | denied | 403 | ✅ |
| 22 | any | GET on POST route | method not allowed | 405 | ✅ |
| 23 | any | unknown route | 404 (authenticated) | 404 | ✅ |
| 24 | GUARDIAN | reports/schedule | endpoints are stubs — verify before claiming | ⚠️ | ⚠️ |
| 25 | SCHOOL_ADMIN | login | Demo School Admin returned | 200 | ✅ |
| 26 | SCHOOL_ADMIN | analytics overview | allowed | 200 | ✅ |
| 27 | SCHOOL_ADMIN | institution students | allowed | 200 | ✅ |
| 28 | SCHOOL_ADMIN | platform institutions list | super-admin-only → denied | 403 | ✅ |
| 29 | SUPER_ADMIN | login | Demo Super Admin returned | 200 | ✅ |
| 30 | SUPER_ADMIN | platform institutions list | seeded institutions returned | 200 | ✅ |
| 31 | SUPER_ADMIN | analytics overview | allowed | 200 | ✅ |
| 32 | STUDENT | teacher analytics | denied | 403 | ✅ |
| 33 | TEACHER | institutions list | denied | 403 | ✅ |
| 34 | GUARDIAN | teacher routes | denied | 403 | ✅ |
| 35 | anonymous | protected route | denied (401/403) | 403 | ✅ |
| 36 | any | write without CSRF token | denied | 403 | ✅ |
| 37 | any | write with `X-XSRF-TOKEN` | accepted | 200 | ✅ |
| 38 | STUDENT | review before completing quiz | denied (no completed attempt) | 403 | ✅ |
| 39 | STUDENT | review after completing quiz | per-question `userAnswer`/`correctAnswer`/`correct`/`explanation` | 200 | ✅ |
| 40 | TEACHER | review someone else's quiz | denied (no own attempt) | 403 | ✅ |
| 41 | TEACHER | `/api/analytics/teacher/quiz-results` | per-question rows for own students (completed attempts) | 200 | ✅ |
| 42 | GUARDIAN | `/api/guardian/wards/{id}` | real ward detail (progress, recent quizzes) | 200 | ✅ |
| 43 | GUARDIAN | ward detail for unlinked learner | denied | 403 | ✅ |

## Notes

- **AI note:** in the audit the Groq key was invalid, so uploads succeeded via
  the graceful fallback (raw text stored, no AI quiz). Rerun rows 3 + 8–11
  against a working AI key to validate real AI simplification + quiz
  generation (expected: AI-generated lesson sections, key terms, and quiz
  questions on `startQuiz`).
- Row 24 (guardian reports/schedule) is the only unverified role feature: the
  endpoints are known stubs.

## CSRF checklist

- `GET /api/auth/csrf` → 200, sets `XSRF-TOKEN` cookie.
- Write with correct `X-XSRF-TOKEN` → 200.
- Write without token → 403.
- Login/register/refresh are exempt by design.
