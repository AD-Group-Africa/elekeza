# ELEKEZA — FUNCTIONALITY & WORKFLOW AUDIT

**Date:** 14 Nov 2026 · **Branch:** `sprint-3-safe-config` @ `47d17f5`
**Method:** route-by-route source inspection, frontend→API call mapping extracted mechanically from every `page.tsx`, backend authorization read at each endpoint, and reconciliation against existing E2E evidence (38/38 passed, 8 Nov 2026, `FINAL E2E EXIT: 0`).

> **What this audit did not do:** it did not click through the application in a browser this session, and it did not run the E2E suite. Journey verdicts below are derived from code + prior recorded evidence. Where a journey's success depends on runtime behaviour that no evidence covers, it is marked **NOT VERIFIED**.

---

## 1. Journey scorecard

Verdicts: **WORKS** (code path complete + evidence), **PARTIAL** (works for one role or with a named gap), **BROKEN** (a step cannot succeed), **MISSING**, **NOT VERIFIED**.

| # | Journey | Verdict | Key evidence |
|---|---|---|---|
| J1 | Learner signs up and reaches a learning session | **PARTIAL** | registration → `STUDENT` → `/onboarding/profile` exists; no age gate/consent (SEC-P0-01) |
| J2 | Learner opens a lesson and completes practice | **WORKS** | `/lesson/[id]`, `/quiz/[lessonId]`, `/quiz/review/[quizId]`; `journey.spec.ts` + `exam.spec.ts` pass |
| J3 | Learner asks the AI tutor | **WORKS** (no quota) | `tutorAPI.ask`; live Groq smoke passed after SDK pin; limits ABSENT (SEC-P2-05) |
| J4 | Learner uploads their own document | **BROKEN** | `/upload` posts to a TEACHER-only endpoint → 403 for learners (SEC-P1-05) |
| J5 | Learner returns and resumes previous learning | **PARTIAL** | `/student-home` → "Continue learning"; no cross-device session continuity evidence |
| J6 | Learner works offline and syncs | **WORKS (desktop)** | `offline.spec.ts` passes; reload-while-offline relies on prod-only SW (TEST gap) |
| J7 | Parent registers themselves | **MISSING** | `/api/auth/register` hard-codes `STUDENT`; no guardian self-registration path at all |
| J8 | Parent links a child | **PARTIAL** | link exists only via school/admin seeding; `/guardian` empty state says "Contact your school" |
| J9 | Parent monitors progress and reads reports | **WORKS** | `/guardian`, `/guardian/wards/[id]`, `/guardian/reports`, `DailyDigest` |
| J10 | Parent messages a teacher | **WORKS** | fixed in `47d17f5`; API round-trip + 38/38 E2E |
| J11 | Parent sees fees | **WORKS** | `/guardian/fees` → `financeAPI.charges/payments` |
| J12 | Teacher manages a class and marks attendance | **PARTIAL** | `/teacher/students`, `/attendance` functional but **no app shell** (UX-P1-01) |
| J13 | Teacher creates content / assignments / exams | **WORKS** | `/teacher/content`, `/teacher/assignments`, `/teacher/exams` |
| J14 | Teacher communicates with parents | **WORKS** | `/teacher/communication` → `/teacher/messages`, `/notifications/send` |
| J15 | School admin onboards staff, manages learners, imports CSV | **PARTIAL** | `/admin/staff`, `/school/import` work but render with no sidebar |
| J16 | School admin manages finance | **PARTIAL** | `/finance` complete, no shell, no M-Pesa live credentials |
| J17 | School registers itself | **PARTIAL** | `/school/onboarding` → `POST /institutions/register`; duplicate-admin guard tested |
| J18 | National / government oversight | **MISSING** | `/government` is a `ComingSoon` placeholder; no role exists (SEC-P1-01) |
| J19 | Platform super-admin operates the platform | **PARTIAL** | `/super-admin` reads 3 endpoints; no user/tenant admin tooling |
| J20 | Anyone administers users, classes, permissions | **MISSING** | `roleConfig.adminConfig` links to `/admin/users`, `/admin/classes`, `/admin/system-settings`, `/admin/reports`, `/admin/security` — **none of these routes exist** |

**Tally: 6 WORKS · 9 PARTIAL · 1 BROKEN · 3 MISSING (of 20).**

---

## 2. Critical findings

### FUNC-P1-01 — There is no path for a parent to join Elekeza

- **Component:** `/register`, `AuthService.register`, `/guardian` empty state
- **Evidence:** `RegisterRequest` has no role field and `AuthService.register` hard-codes `UserRole.STUDENT`. No guardian-registration controller, invite flow, or consent handshake exists. The guardian dashboard's empty state reads "No linked learners yet. Contact your school to link a learner to your account."
- **Impact:** The brief's core home-learning model — a parent signing up at home and supporting their child — cannot happen. Every guardian must be created by a school administrator. That makes the "affordable access for families outside conventional school infrastructure" thesis unachievable, and it is the single largest product gap in the audit.
- **Expected:** A guardian can create an account, prove the relationship to a learner through a school-issued code or a teacher-initiated invite, and immediately see that child's progress.
- **Remediation:** Add `GUARDIAN` to the allowed self-registration roles; issue a one-time, expiring **learner-link code** from the school/teacher side; require the code to complete linking; record the relationship, the granting actor and the timestamp in `guardian_links`.
- **Acceptance criteria:** A new guardian with a valid code sees exactly that learner; an invalid/expired code is rejected; a guardian cannot enumerate learners without a code.

### FUNC-P1-02 — The learner "upload my own material" promise is structurally impossible

See `ELEKEZA_SECURITY_AUDIT.md` SEC-P1-05. Summarised here because it is a product failure as much as a security one: the learner shell advertises Upload, the page posts to an endpoint only teachers may call, and there is no learner-owned document concept anywhere (no `owner_user_id`-style scoping on content, no tutor-over-my-document flow).

**Required capability:** learner-owned documents with owner-only visibility, a quota, and a tutor affordance ("explain this worksheet").

### FUNC-P1-03 — Three shell implementations produce contradictory navigation for the same role

- **Component:** `components/Sidebar.tsx` (+ `DashboardLayout`), `components/layout/SidebarLayout.tsx`, `components/roles/RoleLayout.tsx` (+ `roleConfig.ts`)
- **Evidence:**
  - `SidebarLayout` is role-aware: separate `studentItems`, `teacherItems`, `guardianItems`, `adminItems`, plus mobile bottom bars. Used by `/admin`, `/super-admin` and every `/guardian/*`, `/teacher/*` page.
  - `Sidebar` is **learner-only and role-blind**: `Dashboard`(→`/dashboard`), `Profile`, `Upload`, `History`, `Settings`, for every user. Used by `DashboardLayout`, which wraps `/dashboard*`, `/progress`, `/upload`, `/student-*`, `/lesson/[id]`, `/quiz/*`, `/notification*`, `/document/[id]`, `/learner/preferences`, `/onboarding/profile`, `/school/*`, `/not-found`.
  - `RoleLayout` is a **third**, light-themed shell with its own nav that is not used by any route.
- **Impact:** A learner on `/student-home` sees *AI Tutor, Dashboard, My Lessons, Assignments, Quizzes, Exams, Progress, How I Learn*. The same learner on `/progress` or `/dashboard` sees *Dashboard, Profile, Upload, History, Settings*. Same user, same session, two different products. `RoleLayout` is dead code carrying a `DocuEase` copyright.
- **Remediation:** One shell. Keep `SidebarLayout` (it is the most complete and most accessible), delete `Sidebar`+`DashboardLayout` usage, delete `RoleLayout`/`roleConfig` or fold its role labels into the surviving shell. Mount it via route groups so every authenticated route inherits it.
- **Acceptance criteria:** One navigation component; a per-role snapshot test asserts the exact item list for each of the five roles; no authenticated route renders a different menu for the same role.

### FUNC-P1-04 — Five links in the admin navigation point at routes that do not exist

- **Component:** `components/roles/roleConfig.ts` → `adminConfig`
- **Evidence:** `navItems` reference `/admin/users`, `/admin/classes`, `/admin/system-settings`, `/admin/reports`, `/admin/security`. The route inventory contains only `/admin` and `/admin/staff`.
- **Impact:** If `RoleLayout` were ever mounted, an administrator would hit five 404s. Because the file is currently unreferenced by any route, this is latent rather than live — which is exactly why it should be deleted rather than fixed in place.
- **Remediation:** Delete `RoleLayout` + `roleConfig`, or replace the hrefs with the routes that exist. Do not ship a navigation whose entries are aspirational.

### FUNC-P1-05 — Attendance and school-admin routes render with no application shell

- **Evidence:** `/attendance` (299 lines, real register) and `/admin/staff` (262 lines, real staff CRUD) import neither `SidebarLayout` nor `DashboardLayout`, and sit outside the `/guardian` and `/teacher` layouts. Same for `/finance` (414 lines), `/analytics`, `/assignments`, `/teacher-assignments`, `/school/onboarding`.
- **Impact:** This is the reported symptom ("the sidebar disappears on attendance"). It is not a CSS bug and it will not be fixed by styling: those routes have no layout in the App Router tree at all.
- **Remediation:** Route-group layout. See `ELEKEZA_UI_UX_REVIEW.md` UX-P1-01 for the concrete structure.

### FUNC-P2-01 — Duplicate and overlapping implementations confuse the surface area
- `/teacher/assignments` and `/teacher-assignments` are two different pages for the same job (different APIs: `/teacher/assignments` vs `assignmentsAPI.classAssignments`).
- `/admin/staff` duplicates part of what `/admin` offers.
- `/exam` is a documented legacy redirect to the role-specific exam pages (acceptable, keep).
- `/therapist` is an 11-line placeholder with no route, role or data behind it.
- `/dashboard/*` and `/student-*` overlap: `/dashboard` and `/student-home` both read `/progress/dashboard`; `/dashboard/history` and `/progress` both describe history/progress.

**Remediation:** Choose one canonical page per job, redirect the other. Record the decision in the route inventory so the next audit does not re-litigate it.

### FUNC-P2-02 — Guardian "wards" language still leaks into UI copy
`SidebarLayout` correctly uses **"My Child"**. But `/guardian/schedule` still renders the button *"View your wards' classes"*. The route paths (`/guardian/wards`) can stay; user-visible copy should say *child*/*children*.

### FUNC-P2-03 — Teacher lesson plans and schedule pages have no persistence
`/teacher/plans` (67 lines) and `/teacher/schedule` (70 lines) render forms with title/subject/event inputs; the mechanical API map found **no `api.get/post` calls in either file**. They are local-state forms that lose everything on navigation.

### FUNC-P2-04 — Role-blind client guard on `/super-admin` is fine, but it is the only guard
`/super-admin` returns an "not authorized" panel unless `user.role === 'ADMIN'`, and the backend independently enforces `hasAnyRole("ADMIN")` on `/api/analytics/admin/**`. That is the correct pattern (client guard for UX, server guard for security). It is not applied consistently elsewhere: several pages assume `user.institutionId` exists and silently no-op when it does not (e.g. `/admin/staff` returns early from `load()` when `institutionId` is falsy, leaving a permanently loading table rather than an explanatory message).

---

## 3. Learning-experience assessment (the brief's central question)

**Can a learner aged 7–16 independently sign in, pick a subject, get help, practise, and track progress?**

Essentially **yes for the core loop, with two caveats that matter for the target age**:

1. The loop exists and is evidenced: `/student-home` → "Continue learning" → `/lesson/[id]` → "Start practice" → `/quiz/[lessonId]` → review at `/quiz/review/[quizId]` → `/progress`. Both `journey.spec.ts` and the exhibition capture spec walk this path.
2. It presumes a school-provisioned account. A child at home in the holidays cannot register themselves lawfully (no consent flow), and a parent cannot create the account. So the "meaningful learning at home" scenario is reachable **only** through a school.

**Tutor quality** was not evaluated qualitatively this session (no prompt/response sampling). What is verifiable: the service fails closed, retries exist (`utils/retry.py`), readability utilities exist (`utils/readability.py`), four SEN-specific prompt profiles exist (`prompts/adhd|autism|dyslexia|intellectual_disability.txt` + `none.txt`), and the adaptive rules have their own test modules. There is **no** output-safety filter and **no** usage quota; the brief's requirement that the AI never present itself as a substitute for a qualified teacher is a prompt-level claim, not an enforced control.

**Document-based learning** is the weakest link: teachers can upload, learners cannot, and no "tutor over my document" flow was found.

---

## 4. Onboarding assessment

| Role | Path | State |
|---|---|---|
| Student (self) | `/register` → `/onboarding/profile` (187 lines, learning goal + placement score) | Works; no consent/age gate |
| Student (school) | `/school/import` CSV → institution students | Works |
| Guardian | none | **Missing** |
| Teacher | created by school admin (`/admin/staff`) | Works, no invitation email in mock mode |
| School | `/school/onboarding` → `POST /institutions/register` | Works; duplicate-admin guarded |
| Platform admin | seed only | **No provisioning procedure** (see role matrix) |
| National admin | none | **Missing** |

The brief asks that a school be able to onboard its community through a controlled process. Today: school self-registers, then an admin creates staff, then CSV import creates learners. That chain is real and tested. The missing link is the **guardian invite**, which is what turns a school deployment into a home-learning deployment.

---

## 5. Gaps by role, ranked

1. **Guardian self-service** — no registration, no code-based child linking (blocks the product's core thesis).
2. **Learner document ownership** — no upload, no tutor-over-document.
3. **Platform/national administration** — no role, no user management, no tenant management, no audit viewer.
4. **Teacher lesson plans / schedule** — forms with no persistence.
5. **Kiswahili** — absent entirely.
6. **Teacher class management** — existing gate notes the class-management API lives only on an unmerged branch; today `/teacher/students` reads a roster but there is no create/edit class surface.
