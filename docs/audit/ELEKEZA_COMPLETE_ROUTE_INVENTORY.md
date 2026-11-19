# ELEKEZA — COMPLETE ROUTE INVENTORY

**Date:** 14 Nov 2026 · **Branch:** `sprint-3-safe-config` @ `47d17f5`
**Route count:** **61** — counted from `find frontend/src/app -name page.tsx | wc -l`
**Layouts present in the tree:** 3 only — `app/layout.tsx` (providers + `<html>`), `app/guardian/layout.tsx`, `app/teacher/layout.tsx`

## How to read this document

- **Shell** is what the user actually sees around the page:
  - `SBL` = `components/layout/SidebarLayout` (dark, role-aware, mobile bottom nav, Assist pill)
  - `DBL` = `components/DashboardLayout` → `components/Sidebar` (learner-only, role-blind) + `Navbar`
  - `none` = **no application shell at all**: no sidebar, no navigation, no skip link, no `<main>` landmark
  - `chrome` = public page with its own standalone presentation
- **API** column is extracted mechanically from each `page.tsx` (`api.get/post/...` and named `*API.*` clients), so it reflects real calls, not intentions.
- **Evidence** for "renders" is code structure + prior E2E coverage. This session did **not** open the app in a browser, so runtime rendering is inferred, not observed, except where a spec is named.

---

## 1. Public / unauthenticated (7)

| Route | Purpose | Shell | API | Notes |
|---|---|---|---|---|
| `/` | Landing / entry | chrome | — | No data calls |
| `/login` | Sign-in | chrome | — | Covered by `a11y.spec.ts` (login page axe scan) |
| `/register` | Self-registration → `STUDENT` only | chrome | `POST /auth/register` | **No age gate / consent** (SEC-P0-01) |
| `/forgot-password` | Reset request | chrome | `POST /auth/forgot-password` | Anti-enumeration response |
| `/reset-password` | Reset completion | chrome | `POST /auth/reset-password` | |
| `/waitlist` | Interest capture | chrome | `POST /waitlist` | |
| `/school/onboarding` | School self-registration | **none** | `POST /institutions/register` | Public yet **no shell**; duplicate-admin guarded by `DuplicateAdminRegistrationTest` |

`/not-found` exists as a route page and imports `DBL`.

---

## 2. Learner (20)

| Route | Purpose | Shell | API | State coverage |
|---|---|---|---|---|
| `/student-home` | Learner home | DBL | `/progress/dashboard`, `/gamification/student` | Loading + empty; axe-scanned; E2E root of every journey |
| `/student-lessons` | Lesson list | DBL | `/progress/lessons` | List; E2E reachable |
| `/student-quizzes` | Quiz list | DBL | `/progress/dashboard` | Shares dashboard payload rather than a quiz endpoint |
| `/student-exams` | Exams | DBL | `examAPI.available`, `examAPI.myResults` | axe-scanned |
| `/student-ai-tutor` | AI tutor | DBL | `progressAPI.lessons`, `tutorAPI.ask` | **Only surface with text-to-speech** (A11Y-P1-03) |
| `/progress` | Mastery + "what next" | DBL | `/progress/dashboard`, `/gamification/student`, `/analytics/student` | axe-scanned |
| `/assignments` | Learner assignments | **none** | `assignmentsAPI.mine`, `mySubmissions` | **No shell** |
| `/learner/preferences` | "How I Learn" | DBL | `GET/PUT /learner/preferences` | axe-scanned; cached by SW for offline |
| `/lesson/[id]` | Lesson reader | DBL | (via hooks/components) | E2E heart of `journey.spec.ts` |
| `/quiz/[lessonId]` | Practice quiz | DBL | `GET/POST /quiz/*` | Offline-queue evidence (`offline.spec.ts`) |
| `/quiz/review/[quizId]` | Mistake review | DBL | `/quiz/{id}/review` | |
| `/document/[id]` | Document viewer | DBL | `/content/lessons/…` | |
| `/notifications` | Notification list | DBL | `GET /notifications`, `POST …/read`, `…/read-all` | |
| `/dashboard` | Legacy learner home | DBL | `/progress/dashboard`, `/content/list` | **Duplicates `/student-home`** (FUNC-P2-01) |
| `/dashboard/history` | History | DBL | none detected | Static-ish; 84 lines |
| `/dashboard/profile` | Profile | DBL | `GET /auth/me` | |
| `/dashboard/settings` | Settings | DBL | `PUT /accessibility-profiles/{id}`, `POST /engagement/events` | |
| `/upload` | "Upload Content" | DBL | `POST /content/upload/file`, `/upload/text` | **BROKEN for learners — endpoint is TEACHER-only** (SEC-P1-05) |
| `/exam` | Legacy redirect | **none** | `GET /auth/me` | Documented legacy route; redirects to role-specific exams |
| `/onboarding/profile` | Learning setup | DBL | (component-level) | 187 lines; goal + placement score |

---

## 3. Guardian (8) — all under `app/guardian/layout.tsx` → `SBL`

| Route | Purpose | API | Notes |
|---|---|---|---|
| `/guardian` | "Today" home per child | `/guardian/wards` | Good empty state: "Contact your school to link a learner" |
| `/guardian/wards` | Child list | `/guardian/wards` | Sidebar label already **"My Child"** |
| `/guardian/wards/[id]` | Child detail | `/guardian/wards/{id}`, `/learning-support` | |
| `/guardian/reports` | Reports | `/guardian/reports` | |
| `/guardian/schedule` | Schedule + school dates | `/guardian/schedule` | Copy still says **"View your wards' classes"** (FUNC-P2-02) |
| `/guardian/communication` | Messaging | `/guardian/messages`, `/guardian/teachers`, `POST /guardian/messages` | Fixed in `47d17f5`; axe does not scan it |
| `/guardian/fees` | Fees | `financeAPI.charges`, `payments` | |
| `/guardian/settings` | Settings | none detected | 37 lines — inspect before pilot |

---

## 4. Teacher (14) — all under `app/teacher/layout.tsx` → `SBL`, except `/teacher-assignments`

| Route | Purpose | Shell | API |
|---|---|---|---|
| `/teacher` | Dashboard | SBL | `/analytics/teacher` |
| `/teacher/students` | Roster + mastery drilldown | SBL | `/teacher/students`, `/teacher/student/{id}/learning-support`, `/mastery/learner/{id}` |
| `/teacher/lessons` | Content list + upload | SBL | `/content/list`, `POST /content/upload/file` |
| `/teacher/content` | Content authoring | SBL | `POST /content/upload/file`, `/upload/text` |
| `/teacher/assignments` | Assignments | SBL | `/teacher/assignments`, `/content/list`, `/teacher/students` |
| `/teacher/exams` | Exams | SBL | `examAPI.list`, `create` |
| `/teacher/quiz-results` | Per-question analytics | SBL | `/analytics/teacher/quiz-results` |
| `/teacher/progress` | Student progress | SBL | `/teacher/student/progress` |
| `/teacher/support` | Support signals + interventions | SBL | `/teacher/support-signals`, `/teacher/interventions`, `POST …/{action}` |
| `/teacher/timetable` | Timetable editor | SBL | `POST /timetable/slot`, `DELETE /timetable/…` |
| `/teacher/communication` | Parent messaging | SBL | `/teacher/messages`, `/teacher/students`, `POST /notifications/send` |
| `/teacher/plans` | Lesson plans | SBL | **none — no persistence** (FUNC-P2-03) |
| `/teacher/schedule` | Schedule & meetings | SBL | **none — no persistence** (FUNC-P2-03) |
| `/teacher-assignments` | Classwork (duplicate job) | **none** | `attendanceAPI.classes`, `assignmentsAPI.classAssignments` |

---

## 5. School administration (5)

| Route | Purpose | Shell | API | Notes |
|---|---|---|---|---|
| `/admin` | School admin dashboard | SBL | `/analytics/admin`, `/teacher/students` | Works |
| `/admin/staff` | Staff CRUD (create teacher/school-admin, deactivate) | **none** | `/institutions/{id}/staff` GET/POST/PATCH | **No shell**; silent infinite load if `institutionId` absent |
| `/finance` | Fees, charges, receipts, M-Pesa | **none** | `financeAPI.*` | **No shell**; 414 lines; mock/live mode shown honestly |
| `/attendance` | Attendance register | **none** | `attendanceAPI.classes`, `roster` | **No shell** — the reported "disappearing sidebar" |
| `/school/import` | CSV learner import | **none** | `POST /institutions/{id}/students/import` | **No shell** |

---

## 6. Platform / oversight (2)

| Route | Role | Shell | API | State |
|---|---|---|---|---|
| `/super-admin` | `ADMIN` only | SBL | `/analytics/admin/overview`, `/institutions`, `/notifications` | Real, but only 3 read endpoints; `.catch(() => {})` hides failures |
| `/analytics` | `ADMIN` | **none** | `/engagement/institutions/{id}/summary` | **No shell** |

---

## 7. Placeholder / stubs (5)

| Route | Status | Evidence |
|---|---|---|
| `/government` | **ComingSoon placeholder** | `components/ComingSoon`; no role exists to reach it meaningfully |
| `/marketplace` | **ComingSoon placeholder** | same |
| `/therapist` | **11-line stub**, no role, no data | Heading only |
| `/guardian/settings` | 37 lines, no API calls | Likely non-functional; verify |
| `/dashboard/history` | 84 lines, no API calls detected | Likely static; verify |

---

## 7b. CORRECTION (Wave 0, 14 Nov 2026)

Re-inspecting each page before editing (Wave 0) proved three statements above wrong. They are corrected here rather than silently left in place:

- **`/admin`, `/school/import`, `/school/payment` already wrap themselves in `SidebarLayout`.** They were never shell-less; the import grep behind §8 finding 1 was misread. `/admin` was listed under "Platform / oversight" as `SBL` correctly, but the §8 count wrongly included `/school/import`.
- **`/school/onboarding` is a public registration page** with no `useAuth` — it correctly renders without the signed-in shell, like `/register`.
- **Revised count:** authenticated routes that genuinely had no shell before Wave 0 = **7**, not 11: `/attendance`, `/admin/staff`, `/finance`, `/analytics`, `/teacher-assignments`, `/assignments`, plus the `/government` `/marketplace` `/therapist` placeholders (the latter three are `ComingSoon` stubs, not live features).
- **Fixed in Wave 0 (5):** `/attendance`, `/admin/staff`, `/finance`, `/analytics`, `/teacher-assignments` now inherit `SidebarLayout` via segment layouts. Deferred: `/assignments` (not in the approved Wave 0 list) and the three placeholders (hide behind flags, R-15).

A new invariant test (`frontend/src/lib/appShell.test.ts`) now fails if an audited authenticated route loses its shell, or if a route ends up wrapped twice.

---

## 8. Structural findings from the inventory

1. **11 of 61 routes render with no shell.** `/admin/staff`, `/analytics`, `/assignments`, `/attendance`, `/exam`, `/finance`, `/government`, `/marketplace`, `/school/onboarding`, `/teacher-assignments`, `/therapist`. This is the mechanical proof behind the "sidebar disappears" report — the pages are outside every layout in the App Router tree.
2. **Two shells cover the remaining 50 asynchronously.** Learners get `DBL` on most pages and `SBL` on none; teachers/guardians/admins get `SBL`. `DBL`'s menu is learner-only and role-blind, so `/school/payment` and `/school/import` (imported by `DBL`) show a learner menu.
3. **Duplicates:** `/dashboard` vs `/student-home`; `/teacher/assignments` vs `/teacher-assignments`; `/upload` vs `/teacher/content` vs `/teacher/lessons`.
4. **Dead navigation targets:** `roleConfig.adminConfig` references `/admin/users`, `/admin/classes`, `/admin/system-settings`, `/admin/reports`, `/admin/security` — **0 of 5 exist**.
5. **No loading/empty/error triple** is applied consistently. `/guardian` and `/attendance` are good; `/admin/staff` and `/super-admin` can present plausible-looking blanks instead of errors.

## 9. Route-level test coverage (honest)

| Measurement | Count |
|---|---|
| Routes with an automated axe scan | 7 (`/login`, `/student-home`, `/progress`, `/learner/preferences`, `/student-exams`, `/teacher/students`, `/guardian`) |
| Routes reachable by the link-crawl gate | Those reachable from `/student-home`, `/student-lessons`, `/progress`, `/student-exams`, `/learner/preferences`, `/teacher/students`, `/teacher/progress`, `/guardian` |
| Routes with any role-authenticated E2E assertion | ~14 |
| Routes never exercised by any automated test | ≥ 30, including every school-admin surface except `/admin` |
