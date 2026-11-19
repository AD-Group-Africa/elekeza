# ELEKEZA — UI/UX & DESIGN-SYSTEM REVIEW

**Date:** 14 Nov 2026 · **Branch:** `sprint-3-safe-config` @ `47d17f5`
**Method:** static review of every shell, layout, navigation component and page-class pattern, plus the route→shell mapping. **No viewport testing, no device testing and no visual screenshot review was performed this session.** Responsive claims below are therefore about *code structure*, not observed rendering, and are labelled accordingly.

---

## 1. Verdict

Elekeza does not yet look like one product. It looks like **three products sharing a database**:

| Shell | Visual language | Used by |
|---|---|---|
| `components/layout/SidebarLayout.tsx` | Dark, purple/glass, role-aware, mobile bottom navigation, Assist pill | `/admin`, `/super-admin`, all `/guardian/*`, all `/teacher/*` |
| `components/Sidebar.tsx` + `DashboardLayout.tsx` | Light slate/cyan gradient, fixed learner menu, top `Navbar` | `/dashboard*`, `/progress`, `/upload`, `/student-*`, `/lesson/[id]`, `/quiz/*`, `/notifications`, `/document/[id]`, `/learner/preferences`, `/onboarding/profile`, `/school/*`, `/not-found` |
| `components/roles/RoleLayout.tsx` | Light slate, "Role Profile" header, `DocuEase` footer | **nothing** (dead code) |

Plus **11 authenticated routes with no shell at all**. That is the root cause of "the sidebar disappears" and of the visual inconsistency, and it is an architecture problem, not a styling problem.

---

## 2. P1 findings

### UX-P1-01 — No application shell for 11 authenticated routes; three competing shells for the rest

- **Affected routes (no shell):** `/admin/staff`, `/analytics`, `/assignments`, `/attendance`, `/exam`, `/finance`, `/government`, `/marketplace`, `/school/onboarding`, `/teacher-assignments`, `/therapist`
- **Evidence:** The App Router tree contains exactly three layouts: `app/layout.tsx` (providers + `<html>` only), `app/guardian/layout.tsx`, `app/teacher/layout.tsx`. Every other route must import a shell itself; the import map shows 11 that do not.
- **Expected:** One shell inherited by every authenticated route, chosen by role.
- **Actual:** Pages either import one of three shells or float without navigation.
- **Remediation (concrete):**
  ```
  app/
    (public)/            login, register, forgot-password, reset-password, waitlist, page.tsx
    (learner)/           student-*, progress, assignments, lesson, quiz, learner, upload, dashboard
    (guardian)/          guardian/**
    (teacher)/           teacher/**, attendance, teacher-assignments
    (admin)/             admin/**, finance, analytics, super-admin
  ```
  Add `layout.tsx` in each group rendering a single `AppShell` component that reads `user.role` and selects the nav set. Delete `Sidebar.tsx` + `DashboardLayout.tsx` and `RoleLayout.tsx` + `roleConfig.ts`.
- **Acceptance criteria:** Every non-public route renders exactly one sidebar and one `<main>`; a test enumerates the route list and asserts shell presence; no page imports a layout component directly.

### UX-P1-02 — The same learner gets two different sidebars depending on which page they open

- **Evidence:** `SidebarLayout.studentItems` = AI Tutor, Dashboard, My Lessons, Assignments, Quizzes, Exams, Progress, How I Learn. `Sidebar.tsx` menu = Dashboard, Profile, Upload, History, Settings. Both are reachable by a `STUDENT` in one session (`/student-home` vs `/progress`).
- **Impact:** Navigation is unpredictable; a learner who learned where "My Lessons" lives cannot find it from the progress page. This is the single most disorienting defect in the product.
- **Remediation:** Folded into UX-P1-01: one nav per role.

### UX-P1-03 — Admin navigation advertises capabilities that do not exist

- **Evidence:** `roleConfig.adminConfig` → `/admin/users`, `/admin/classes`, `/admin/system-settings`, `/admin/reports`, `/admin/security`. Only `/admin` and `/admin/staff` exist.
- **Impact:** Latent 404s and a false picture of platform maturity. Anyone reading the design-system doc will believe admin tooling exists.
- **Remediation:** Delete `roleConfig` (preferred — it is unused) or point entries at real routes.

### UX-P1-04 — Wrong company in the product footer

- **Evidence:** `components/roles/RoleLayout.tsx` renders `Copyright 2026 DocuEase. All rights reserved.`
- **Impact:** If this shell is ever mounted, a partner school sees another company's copyright. It also signals an incomplete rebrand.
- **Remediation:** Delete the component; if kept, fix to Elekeza. Audit for other inherited brand strings (`DocuEase`, `ignal.`) before the pilot.

---

## 3. P2 findings

### UX-P2-01 — Two visual themes in one product, with no documented reason
Dark purple/glass (`SidebarLayout`, most pages using `text-purple-200`, `bg-white/10`) versus light slate/cyan (`Sidebar`, `DashboardLayout`, `RoleLayout`, and every `emerald/rose/amber/slate` status tone in attendance and finance). The brief asks for a clean, calm, trustworthy education feel and warns against forcing black-and-white styling. The current split reads as an unfinished migration rather than a design decision.

**Recommendation:** keep the **light** direction for the working surfaces (attendance, finance, staff, reports) because the status palettes and tables are designed for it and contrast is more reliable; keep a calm, low-chroma dark header/sidebar for the learner surfaces if the brand wants it — but pick one and apply it via tokens, not per-page classes.

### UX-P2-02 — Purple-on-dark body text is a contrast hazard
Many pages use `text-purple-200` and `text-purple-300` for body copy on `var(--bg-card)`/gradient backgrounds. `purple-300` on a dark gradient is borderline for 4.5:1 at small sizes; `text-purple-200/50` placeholders and `opacity-50` helper text (guardian dashboard) are likely to fail. Axe did not flag it on the seven scanned pages, which means either those specific combinations pass or the scanned elements were not the low-opacity ones. **This needs measurement, not opinion** — see acceptance criteria.

### UX-P2-03 — Empty, loading and error states are inconsistent in quality
Good examples exist: `/guardian` has a clear empty state with an explanation; `/dashboard/skeleton` component exists; `/attendance` sets a human error message. Weak examples: `/admin/staff` returns early from `load()` when `institutionId` is missing, leaving `loading=true` forever with no explanation; `super-admin` swallows failures with `.catch(() => {})` so a 403 renders as zeros/dashes rather than "not authorised" or "could not load".

**Remediation:** standardise on the existing `ui/` primitives (`PageShell`, `StatusBanner`, `ErrorModal`, `LessonLoading`, `ProgressStepper`) and forbid bare `.catch(() => {})` in pages — it converts real outages into plausible-looking empty data.

### UX-P2-04 — Two different top-level patterns: sidebar+bottom-nav vs sidebar+navbar
`SidebarLayout` has no top bar (only a right-aligned `NotificationBell`); `DashboardLayout` has a full `Navbar`. For a phone user the two feel unrelated. Pick one.

### UX-P2-05 — Legacy `/dashboard` and `/student-home` both exist as "home"
`Sidebar` points to `/dashboard`; `SidebarLayout` points to `/student-home`; login redirects to `/student-home` (E2E asserts `toHaveURL(/student-home/)`). Two homes with overlapping data sources.

---

## 4. P3 findings

- **UX-P3-01** — Inconsistent heading scale: `text-3xl` on `/upload` and `/dashboard/history`, `text-2xl` on `/attendance`-class pages, `text-xl` on super-admin. Define a type scale and use it.
- **UX-P3-02** — Placeholder routes are visible in navigation: `/government` and `/marketplace` render `ComingSoon`. Do not link to `ComingSoon` pages in a pilot build; hide them behind a feature flag (`V19__feature_flag_overrides.sql` exists and should be used).
- **UX-P3-03** — `/therapist` is reachable-by-URL only, with a heading and no content or role. Remove it or park it behind a flag.
- **UX-P3-04** — `next.config.ts` currently contains a **UTF-8 BOM and mojibake** (`â€”`) from a Windows encoding round-trip in the uncommitted working tree. Cosmetic today; it is exactly the kind of change that produces a spurious diff review. Normalise to UTF-8 without BOM before committing.

---

## 5. Responsive design — what the code says (not observed)

| Concern | Evidence in code | Assessment |
|---|---|---|
| Sidebar collapse | `SidebarLayout`: desktop `hidden md:block`, mobile overlay + hamburger, `collapsed` state | Structurally sound |
| Mobile navigation | Bottom bar for `STUDENT`/`GUARDIAN` with 56 px min height, `env(safe-area-inset-bottom)` | Good, and rare at this stage |
| Teacher/admin on mobile | No bottom bar (deliberate, documented in a comment: staff item sets are long) | Acceptable; overlay menu covers it |
| Tables | `/teacher/students` uses `<table>`; no card-collapse pattern found | **Risk:** wide tables will overflow on a 360 px phone; needs `overflow-x-auto` or a stacked card layout |
| Overflow | `overflow-x-auto` used on guardian child tabs | Partial |
| Touch targets | Bottom nav 56 px; icon-only buttons often `p-2` (≈36 px) | **Risk:** below the 24 px 2.2 minimum is unlikely, but 36 px is under the 44 px iOS guidance |
| Dialog sizing | `ConfirmActionDialog`, `ErrorModal` exist in `ui/` | Not measured at small viewports |
| Forms | Attendance and finance are long single-column forms | Likely fine; unverified |
| Text wrapping | Guardian cards use `truncate` on names | Watch for clipped names on narrow screens |

**Explicit "not tested":** no real viewport run on Android phone, iPhone, tablet, portrait/landscape. The existing release gate already states `Mobile responsiveness — NOT TESTED on device (emulation only)`. That statement remains true and should not be upgraded without a device pass.

---

## 6. Design-system recommendation

The brief asks for one coherent, professionally designed product. The shortest path:

1. **One shell** (`AppShell`) selected by route group and role (UX-P1-01).
2. **Tokens, not page classes.** `globals.css` already defines `--bg-card`, `--bg-gradient`, `--border-color`, `--ek-moss-600`. Extend that into a full token set (surface, text, muted, accent, success/warn/danger, focus ring) and stop hardcoding `text-purple-200` per page.
3. **Adopt the existing `ui/` primitives everywhere.** `PageShell`, `ActionBar`, `StatusBanner`, `ConfirmActionDialog`, `ErrorModal`, `ProgressStepper` already exist and are underused.
4. **One type scale and one spacing scale**, applied via utility tokens.
5. **Accessibility is a design constraint:** measure contrast on every token pair; never ship `opacity-50` for instructional text; give focus a visible, high-contrast ring.
6. **Date-appropriate learner surface.** The learner shell is already the strongest; keep it simple, large-type, few choices, and read-aloud everywhere.

Do not restyle page-by-page. The inconsistency is structural, and structural fixes are cheaper than 61 cosmetic ones.
