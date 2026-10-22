# What each role can do

A map of the web app by role: where each capability lives (route) and which feature folder owns it.
Use it to find code quickly, or to check what is ready to demo. Everything listed here is wired to
the real backend; pages that are planned but not built show a "Coming soon" card instead of fake data.

## School administrator (`SCHOOL_ADMIN`)

| Task | Route | Feature folder |
| --- | --- | --- |
| School overview dashboard | `/admin` | `admin` |
| Create teacher / staff accounts | `/admin/staff` | `admin` |
| Learner directory: search, open a learner's full record (progress, attendance, competencies), link a guardian | `/admin/learners` | `learners` |
| Import learners from CSV | `/school/import` | `admin` |
| Create classes, enrol and remove learners | `/classes` | `classes` |
| Build the curriculum tree (learning area → strand → sub-strand → competency → objective) | `/curriculum` | `curriculum` |
| Fees: terms, fee items, fee structures, "bill learners", one-off charges, manual payments, receipts | `/finance` | `finance` |
| Attendance: whole-school summary (last 30 days) and any class register | `/attendance` | `attendance` |
| School calendar: exams, due dates, events | `/calendar` | `calendar` |
| Devices: register tablets, activate, assign to a learner, mark lost, revoke | `/admin/devices` | `devices` |
| Engagement analytics | `/analytics` | `admin` |

**First-day setup order:** Staff accounts → Import learners → Classes (enrol learners) → Curriculum →
Finance (term, fee items, structures, bill learners) → Calendar. Each page's empty state links to the
next step it depends on (for example, Attendance links to Classes when no class exists).

## Platform administrator (`ADMIN`)

Everything a school admin can do, plus `/super-admin`:

- **Overview** — schools, total users, enrolled learners, recent notifications.
- **Audit log** — security and admin events, filterable by category.
- **Feature flags** — turn features on/off at runtime; "Reset" returns to the configured value.
- **System health** — database and external-service circuit breakers, refreshed every 30 s.
- **Waitlist** — people who signed up on the public waitlist.

## Teacher (`TEACHER`)

| Task | Route | Feature folder |
| --- | --- | --- |
| Dashboard | `/teacher` | `teacher` |
| Students: list, add, expand a learner to see their school record | `/teacher/students` | `teacher`, `learners` |
| Classes and rosters (view; school admins create classes) | `/classes` | `classes` |
| Lessons: create, link a lesson to a curriculum objective, publish | `/teacher/lessons` | `lessons` |
| Assign lessons to learners | `/teacher/assignments` | `teacher` |
| Upload content | `/teacher/content` | `teacher` |
| Classwork: set, collect and mark | `/teacher-assignments` | `assignments` |
| Exams and quiz results | `/teacher/exams`, `/teacher/quiz-results` | `exams`, `quiz` |
| Support signals: who needs help, support queue, interventions (open → close with outcome) | `/teacher/support` | `teacher` |
| Class progress incl. competency summary per objective | `/teacher/progress` | `teacher` |
| Curriculum (read) | `/curriculum` | `curriculum` |
| Timetable | `/teacher/timetable` | `teacher` |
| School calendar (add/remove own dates) | `/calendar` (also `/teacher/schedule`) | `calendar` |
| Messages with guardians | `/teacher/communication` | `messaging` |
| Attendance register | `/attendance` | `attendance` |

## Learner (`STUDENT`)

| Task | Route | Feature folder |
| --- | --- | --- |
| Home: next lesson, "coming up" dates | `/student-home` | `learner` |
| Lessons, with **"Show this lesson as"** — as written, clearer, step by step, spaced out, more detail — and a "did this help?" check | `/student-lessons`, `/lesson/[id]` | `lessons` |
| Quizzes (offline-capable) and exams | `/student-quizzes`, `/quiz/[id]`, `/student-exams` | `quiz`, `exams` |
| Classwork | `/assignments` | `assignments` |
| Progress: level, mastery, achievements, **my skills (curriculum)**, **my attendance**, weekly time | `/progress` | `learner` |
| AI tutor | `/student-ai-tutor` | `tutor` |
| School calendar | `/calendar` | `calendar` |
| My fees (view, pay via M-Pesa, receipts) | `/fees` | `finance` |
| How I learn (learning preferences) and accessibility settings | `/learner/preferences`, `/dashboard/settings` | `learner`, `accessibility` |

Accessibility settings that change the page live: themes (dark / light / calm), large text, high
contrast, dyslexia-friendly fonts, reduced motion, read aloud, and the **reading guide** (a band that
follows the pointer or keyboard focus to help keep your place in text).

## Guardian (`GUARDIAN`)

| Task | Route | Feature folder |
| --- | --- | --- |
| Daily digest per child | `/guardian` | `guardian` |
| Child detail: today at a glance, **exam results, classwork, attendance**, how they are learning | `/guardian/wards`, `/guardian/wards/[id]` | `guardian` |
| Fees: balances, M-Pesa payment, receipts | `/guardian/fees` | `finance` |
| Reports (download) | `/guardian/reports` | `guardian` |
| Schedule: timetable and school dates | `/guardian/schedule` | `guardian`, `calendar` |
| Messages with teachers | `/guardian/communication` | `messaging` |

## Everyone

- Notifications bell and `/notifications`. A notification with a link opens that page when clicked.
- Profile and settings (`/dashboard/profile`, `/dashboard/settings`).
- Elekeza Assist (floating help button) with role-specific shortcuts.

## Backend endpoints added for the frontend

| Endpoint | Why |
| --- | --- |
| `POST /api/attendance/classes` | Create a class (school admin / admin; 409 on duplicate name) |
| `GET/POST /api/attendance/classes/{id}/learners` | List / enrol learners (same school only) |
| `DELETE /api/attendance/classes/{id}/learners/{learnerId}` | Remove a learner from a class |
| `GET /api/content/list` now returns `objectiveId` | Show which curriculum objective a lesson is linked to |

Covered by `backend/src/test/.../attendance/ClassManagementApiTest.kt`.
