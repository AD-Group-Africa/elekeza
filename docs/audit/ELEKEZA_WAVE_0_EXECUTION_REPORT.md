# ELEKEZA — WAVE 0 EXECUTION REPORT

**Date:** 14 Nov 2026
**Branch:** `sprint-3-safe-config` @ `47d17f5` (no commits made — see §10)
**Scope:** Wave 0 only. No Wave 1 work was started.
**Rule applied:** every claim below is either a command that was run in this session with its exit status captured, or an inspection of a named file. Nothing is inferred and reported as tested.

---

## 1. Initial repository state (before any change)

| Item | Value |
|---|---|
| Branch | `sprint-3-safe-config` |
| HEAD | `47d17f5` `fix(elekeza): make guardian messaging accessible and verify delivery` |
| Upstream | 1 commit ahead, 0 behind (not pushed) |
| Stashes | 4, all intact |
| Modified | 9 tracked files (`ai-elewa/tests/test_full_pipeline.py`, `DeadlineController.kt`, `ShowcaseDataInitializer.kt`, `GuardianScheduleController.kt`, `application-dev.yaml`, `DevicesAndBillingApiTest.kt`, `GuardianSchoolDatesTest.kt`, `next.config.ts`, `public/sw.js`) |
| Staged new | `DeadlineAuthorizationTest.kt`, `GuardianDeadlineLinkLifecycleTest.kt` |
| Untracked | `.cloud-attachments/`, `Make-ClaudeAuditZip.ps1`, `Push-Sprint2.ps1`, `backend/flyway-validation/`, `application-dev.yaml.bak`, `docs/ELEKEZA_COMPLETION_AND_INTEGRATION_REGISTER.md`, `docs/audit/`, `ignal.` |
| Pre-Wave-0 test baseline | backend **357** tests / 54 classes / 0 failures; frontend tsc clean; Vitest **20**; AI 572 pass + 31 environmental |
| Backups | `backups/`, `release-evidence/`, `e2e-evidence/`, `artifacts/` untouched |

**Unrelated work preserved and deliberately excluded:** the `GuardianScheduleController` + `GuardianSchoolDatesTest` pair that removes REGIONAL school dates from the guardian schedule. Untouched, unstaged, and flagged for its own review (§9).

---

## 2. Findings selected for Wave 0

From `ELEKEZA_REMEDIATION_BACKLOG.md`, Wave 0 = R-01 … R-06, plus the navigation and copy items from the brief.

| ID | Finding | Selected? | Outcome |
|---|---|---|---|
| R-01 | SEC-P0-03 — demo seeding defaults ON | Yes | **Fixed** (§4.1) |
| R-02 | DEP-P1-01 — nginx `add_header` inheritance | Yes | **Fixed** (§4.2) |
| R-03 | SEC-P2-06 — binary/archive paths not ignored | Yes | **Fixed** (§4.3) |
| R-04 | UX-P3-04 — BOM + mojibake in `next.config.ts` | Yes | **Fixed** (§4.4) |
| R-05 | SEC-P2-03 — dead refresh generator, unchecked `type` claim | Yes | **Fixed** (§4.5) |
| R-06 | TEST-P1-01 — no admin E2E fixture | **Partial** | ADMIN fixture added; no SCHOOL_ADMIN exists in the dev seed — documented, not faked (§4.6) |
| UX-P1-01 | Shell-less priority routes | Yes | **Fixed for 5 routes** (§5) |
| FUNC-P1-03 | Role-blind / divergent navigation | **Partial** | Role mapping extracted and testable; full shell unification is Wave 2 |
| SEC-P1-05 | Learner `/upload` 403 | **Mitigated** | Link removed from learner navigation; real fix needs learner-owned documents (Wave 3) |
| FUNC-P2-02 | "wards" copy | Yes | **Fixed** (§5.3) |

---

## 3. Files modified

**Modified (10):**

| File | Change |
|---|---|
| `backend/src/main/resources/application.yaml` | demo-seed placeholder default `TRUE` → `${DEMO_SEED_ENABLED:FALSE}` |
| `backend/src/main/resources/application-test.yml` | explicit `demoSeedEnabled: TRUE` opt-in for tests |
| `backend/src/main/kotlin/…/auth/JwtUtil.kt` | `validateToken` checks `type == "access"`; dead `generateRefreshToken` removed |
| `frontend/src/components/layout/SidebarLayout.tsx` | nav arrays + role switch replaced by `navConfig` import |
| `frontend/src/components/Sidebar.tsx` | learner `Upload` link removed (403 affordance) |
| `frontend/src/app/guardian/schedule/page.tsx` | "View your wards' classes" → "View your child's progress" |
| `frontend/e2e/helpers.ts` | `ADMIN` fixture added, with the SCHOOL_ADMIN gap documented |
| `infrastructure/nginx/nginx.conf` | security headers repeated in `/sw.js` and `/_next/static/` |
| `.gitignore` | ignores for `backend/flyway-validation/`, `.cloud-attachments/`, `*.bak` |
| `frontend/next.config.ts` | BOM + mojibake removed; `allowedDevOrigins` **preserved** |

**Created (11):**

| File | Purpose |
|---|---|
| `backend/src/main/kotlin/…/config/seed/DemoSeedGuard.kt` | fail-closed startup guard |
| `backend/src/test/kotlin/…/config/seed/DemoSeedGuardTest.kt` | 8 regression tests |
| `backend/src/test/kotlin/…/auth/JwtTokenTypeTest.kt` | 3 regression tests |
| `frontend/src/components/layout/navConfig.ts` | pure role→navigation module |
| `frontend/src/components/layout/navConfig.test.ts` | 9 regression tests |
| `frontend/src/lib/appShell.test.ts` | 5 shell-ownership invariant tests |
| `frontend/src/app/attendance/layout.tsx` | shell for the attendance register |
| `frontend/src/app/admin/staff/layout.tsx` | shell for staff administration |
| `frontend/src/app/finance/layout.tsx` | shell for finance |
| `frontend/src/app/analytics/layout.tsx` | shell for engagement analytics |
| `frontend/src/app/teacher-assignments/layout.tsx` | shell for teacher classwork |

**No page body was rewritten.** The five layouts are 4-line segment wrappers; no existing component was replaced and no route was moved.

---

## 4. Exact implementation changes

### 4.1 Priority A — secure demo seeding (SEC-P0-03)

**Before:** `application.yaml` → `demoSeedEnabled: "TRUE"`. Only `prod` and `docker` overrode it to `FALSE`. A bare `java -jar` with no profile therefore ran Flyway with seeding **on** and created `superadmin@elekeza.app` (`ADMIN`) and `admin@elekeza.app` (`SCHOOL_ADMIN`) from `V2__seed_demo.sql`, whose bcrypt hashes and plaintext passwords are in the repository.

**After — three layers:**

1. **Safe default.** `application.yaml`: `demoSeedEnabled: "${DEMO_SEED_ENABLED:FALSE}"`. Seeding is now opt-in everywhere.
2. **Explicit test opt-in.** `application-test.yml` sets `demoSeedEnabled: "${DEMO_SEED_ENABLED:TRUE}"`, so the demo fixtures the suite relies on stay available *only* in the test profile.
3. **Fail-closed guard.** `DemoSeedGuard` (`ApplicationRunner`) refuses to start when seeding is enabled and the active profiles are not `dev`/`test` — including the empty-profile case that caused the original defect. It also logs which mode is active on every boot.

**Demo initialization pathways, all verified:**

| Pathway | Condition | Can it create a privileged account outside dev/tests? |
|---|---|---|
| `V2__seed_demo.sql` | Flyway placeholder `demoSeedEnabled` | **No** — placeholder now defaults FALSE; guard blocks a forced TRUE |
| `V16__fix_demo_admin_institution.sql` | same placeholder | **No** — same gate |
| `DataInitializer` | `@Profile("dev")` | **No** — no `ADMIN` created; teachers/learners/guardians only |
| `AttendanceFinanceSeed` | `@Profile("dev")` | **No** — dev only (creates the dev `ADMIN`) |
| `ShowcaseDataInitializer` | `SHOWCASE_SEED=1` + dev context | **No** — env-gated demo data |

**Important correction to the audit:** the dev profile runs with **Flyway disabled** (`application-dev.yaml: flyway.enabled: false`, `ddl-auto: update`). Dev and test accounts therefore come from the Kotlin seeders, not from Flyway. Changing the Flyway placeholder cannot affect them, which is why the 368-test suite is unaffected.

**Migration history preserved:** `V2` and `V16` were **not edited**. No checksum changed, so no `flyway repair` is required for existing databases.

**Safe administrator provisioning procedure (documented now; automation is backlog R-21):**
1. Never use a seeded account outside dev/test.
2. Provision through the application where possible — a school admin is created by `/admin/staff`, which validates the role and derives the institution from the principal.
3. For a platform account, create the user through a reviewed, single-purpose migration or an ops run with a freshly generated bcrypt hash; never commit the hash or the password.
4. Record the actor, target, role, reason and timestamp in the change log of the deployment.
5. Require MFA for `SUPER_ADMIN` once the role split (R-20) lands.
6. Rotate any credential that has ever existed in a demo seed before a production account is created.

### 4.2 Priority A/B — nginx header inheritance (DEP-P1-01)

`add_header` directives are **not inherited** into a `location` block that declares its own. `/sw.js` and `/_next/static/` each declared `Cache-Control`, so both responses shipped without HSTS, `X-Frame-Options`, `nosniff` and `Referrer-Policy`. Fixed by repeating the four headers in those two locations.

They were **inlined rather than moved to an include file** deliberately: `docker-compose.yml` mounts `nginx.conf` as a single file at `/etc/nginx/nginx.conf`, so an `include` of a sibling file would not exist in the container and nginx would fail to start.

### 4.3 Ignore rules (SEC-P2-06)

`.gitignore` gained `backend/flyway-validation/`, `.cloud-attachments/`, `*.bak`. Verified: `git status` no longer lists them. The files remain on disk untouched.

### 4.4 Encoding corruption (UX-P3-04)

`next.config.ts` had a UTF-8 BOM and a mojibake em dash (`â€”`) from a Windows code-page round-trip. Both removed; the `allowedDevOrigins: ['192.168.1.25']` change was **preserved**, and the file now differs from HEAD only by that intentional addition. Verified by byte inspection (`od -c` shows no BOM) and by `git diff`.

### 4.5 Token-type hardening (SEC-P2-03)

- `JwtUtil.validateToken` now requires `type == "access"` rather than checking only signature and expiry.
- `generateRefreshToken` (a dead JWT refresh generator with a 7-day lifetime) was removed. Refresh tokens are opaque UUIDs, so nothing depended on it; leaving it was a trap.

### 4.6 E2E admin fixture (TEST-P1-01) — partial by design

`ADMIN` (`admin@elekeza.app` / `admin123`, created by `AttendanceFinanceSeed` under the dev profile) was added to `frontend/e2e/helpers.ts`.

**No `SCHOOL_ADMIN` fixture was added, because no school administrator exists in the dev seed.** Flyway `V2` creates one, but the dev profile disables Flyway, and the Kotlin seed uses that same address for the platform `ADMIN`. Inventing a fixture that cannot log in would have been worse than documenting the gap. Seeding a dev `SCHOOL_ADMIN` is backlog R-06/R-27.

---

## 5. Routes corrected

### 5.1 Shell added (5 routes)

| Route | Before | After |
|---|---|---|
| `/attendance` | no layout, no sidebar, no skip link | `app/attendance/layout.tsx` → `SidebarLayout` |
| `/admin/staff` | no layout | `app/admin/staff/layout.tsx` → `SidebarLayout` |
| `/finance` | no layout | `app/finance/layout.tsx` → `SidebarLayout` |
| `/analytics` | no layout | `app/analytics/layout.tsx` → `SidebarLayout` |
| `/teacher-assignments` | no layout | `app/teacher-assignments/layout.tsx` → `SidebarLayout` |

`SidebarLayout` was chosen because it is the existing role-aware shell with the skip link, `<main id="main-content">`, `aria-current`, mobile overlay and 56 px bottom navigation. **No fourth shell was introduced.**

### 5.2 Corrections to the audit's own route findings

Re-inspecting each page before editing (as instructed) showed three audit statements were wrong, and they are corrected here rather than acted on:

- `/admin`, `/school/import` and `/school/payment` **already** wrap themselves in `SidebarLayout`. They were never shell-less; the audit misread its own import grep.
- `/school/onboarding` is a **public** registration page with no `useAuth` — it correctly has no shell, exactly like `/register`. Wrapping it would have shown a logged-out visitor a learner menu.
- Consequence: `app/school/layout.tsx` and `app/admin/layout.tsx` were **not** created, because they would have produced double shells. The new `appShell.test.ts` now enforces that invariant.

Still shell-less after Wave 0, and deferred: `/assignments` (learner, not in the approved route list), `/government`, `/marketplace`, `/therapist` (placeholders — hiding them behind flags is R-15).

### 5.3 Navigation and copy

- **Role mapping extracted** from `SidebarLayout` into `navConfig.ts` with `navItemsFor(role)`. Behaviour is unchanged for all five roles, and `SCHOOL_ADMIN` still never receives `/super-admin`. The difference is that it is now covered by tests.
- **Learner `Upload` link removed** from `Sidebar.tsx`. Both `/api/content/upload/file` and `/api/content/upload/text` are `@PreAuthorize("hasAnyRole('TEACHER','SCHOOL_ADMIN','ADMIN')")`, so the link was a guaranteed 403. The `/upload` route itself is untouched — the real fix is learner-owned documents (R-16).
- **Parent copy:** "View your wards' classes" → **"View your child's progress"**. Verified no user-facing "wards" string remains (the `/guardian/wards` page heading already read "My Children").

### 5.4 Broken navigation, not fixed

`components/roles/roleConfig.ts` still lists five non-existent admin routes (`/admin/users`, `/admin/classes`, `/admin/system-settings`, `/admin/reports`, `/admin/security`) and `RoleLayout.tsx` still renders a `DocuEase` copyright. **Neither file is imported by any route**, so nothing user-facing is broken today. Deleting dead components is a Wave 2 decision (R-11/R-13), not a Wave 0 edit — flagged, not forgotten.

---

## 6. Tests executed

| # | Command | Result | Exit |
|---|---|---|---|
| 1 | `cd backend && ./gradlew test --console=plain` | **BUILD SUCCESSFUL**, **368 tests / 56 classes / 0 failures / 0 errors / 0 skipped**, 3m30s | **0** |
| 2 | `cd frontend && npx tsc --noEmit` | clean | **0** |
| 3 | `cd frontend && npx vitest run` | **6 files / 34 tests passed** | **0** |
| 4 | `cd frontend && NEXT_PUBLIC_API_URL=http://localhost:8085 npm run build` | `✓ Compiled successfully in 35.0s`, **61 routes** emitted, `.next/BUILD_ID` written, 0 errors | 0 |
| 5 | `./gradlew test --tests DemoSeedGuardTest` (first, isolated) | BUILD SUCCESSFUL | 0 |

**Evidence files:** `docs/audit/evidence-wave0-backend-test.log` (suite 1), and `docs/audit/evidence-backend-test.log` (pre-Wave-0 baseline, 357).

### New regression tests (14 new frontend + 11 new backend = 25)

| Suite | Tests | Pins |
|---|---|---|
| `DemoSeedGuardTest` | **8** | guard matrix (off always allowed; on only for dev/test; rejected for prod/docker/staging/**no profile**); runner throws/allows; `application.yaml` default is FALSE; `application-test.yml` opts in |
| `JwtTokenTypeTest` | **3** | access token validates; `type=refresh` JWT rejected; untyped JWT rejected |
| `navConfig.test.ts` | **9** | per-role nav; `SCHOOL_ADMIN` never sees `/super-admin`; learners get no `/upload`; unknown role gets `[]`; no duplicate or unlabelled items |
| `appShell.test.ts` | **5** | every audited authenticated route resolves a shell; **no route nests two shells**; public routes inherit none; the shell still delegates to `navConfig` |

### Coverage of the required regression areas

| Area | Evidence |
|---|---|
| Authentication | `AuthAndInputSecurityTest`, `ForgotPasswordEndpointTest`, `PasswordResetLifecycleTest` + new `JwtTokenTypeTest` |
| Refresh rotation / logout revocation | `PasswordResetLifecycleTest`, `AuthController` rotation asserted in suite 1 |
| Student / guardian / teacher / school-admin access | `MultiTenantAuthorizationTest`, `GuardianRelationshipTest`, `TeacherStudentsApiTest`, `StaffManagementApiTest`, `GuardianAnalyticsAuthorizationTest` |
| Institution isolation | `MultiTenantAuthorizationTest` (8.5 s), `GovernanceRegressionTest` |
| Payments | 6 × `Mpesa*` classes |
| Navigation | new `navConfig.test.ts` + `appShell.test.ts` |
| Migration integrity | Flyway runs inside the test context (`validate-on-migrate: true`); **not** verified against real PostgreSQL (§8) |

---

## 7. Security configuration — before and after

| Setting | Before | After |
|---|---|---|
| Base `demoSeedEnabled` | `"TRUE"` | `"${DEMO_SEED_ENABLED:FALSE}"` |
| Test `demoSeedEnabled` | inherited `TRUE` | explicit `"TRUE"` in `application-test.yml` |
| Prod / docker `demoSeedEnabled` | `FALSE` (unchanged) | `FALSE` (unchanged) |
| Startup with seeding ON outside dev/test | **allowed** — app booted with a live platform admin | **`IllegalStateException`, app refuses to start** |
| Startup with seeding ON and no profile | **allowed** — the original defect | **refused** |
| `validateToken` acceptance | any signed JWT | only `type == "access"` |
| Dead JWT refresh generator | present (7-day lifetime) | removed |
| `next.config.ts` encoding | BOM + mojibake | clean UTF-8, LAN origin preserved |
| HSTS/nosniff on `/sw.js`, `/_next/static/` | **absent** (header inheritance) | **present** |
| Committable binary/archive paths | 4 untracked, unignored | ignored |

---

## 8. Outstanding defects

Deliberately **not** attempted in Wave 0, with the reason:

| Finding | Why it remains | Backlog |
|---|---|---|
| SEC-P0-01 — no age gate / parental consent | Requires product + legal design and a consent data model | R-07 |
| SEC-P0-02 — no DPA artefacts, no erasure | Legal workstream + `consent_records` schema | R-08, R-09 |
| FUNC-P1-01 — no guardian self-registration | Needs the link-code flow; forcing it in Wave 0 would be a rushed redesign | R-10 |
| UX-P1-01 (rest) — 4 shells still coexist | Full route-group unification is Wave 2; Wave 0 fixed the five approved routes only | R-11 |
| FUNC-P1-03 — learner still sees two menus on some pages | Requires Wave 2 shell unification | R-12 |
| SEC-P1-01 — no SUPER_ADMIN / national role | Schema + authorization refactor | R-20 |
| SEC-P1-04 — upload sniffing, malware scan, R2 | Storage migration | R-17 |
| SEC-P1-05 — learner documents | New ownership model | R-16 |
| SEC-P2-05 — no AI quotas | Metering design | R-19 |
| DEP-P1-02 — no monitoring/alerting | Needs accounts + host | R-31 |
| DEP-P1-03 — no real-PostgreSQL migration run | Needs a Postgres service (none on :5432) | R-30 |
| A11Y-P1-01/02 — gate is WCAG 2.1 on 7 routes | Extending the gate is Wave 5 | R-24 |
| TEST-P1-01 — no SCHOOL_ADMIN fixture | No such account exists in the dev seed | R-06/R-27 |
| `roleConfig` dead links + `DocuEase` footer | Dead code; delete with the other shells in Wave 2 | R-11/R-13 |
| `application-docker.yml` default `JWT_SECRET` | Out of Wave 0 scope; flagged below | — |

### Additional defect noticed during Wave 0 (not in the audit)

**`application-docker.yml` contains `jwt.secret: ${JWT_SECRET:change-me-32-char-minimum-secret-key}`.** A docker deployment that omits `JWT_SECRET` boots with a **publicly known signing key**, which allows anyone to forge an access token for any user, including `ADMIN`. `docker-compose.yml` passes `JWT_SECRET` through, and an empty value would already fail key derivation — so this is only reachable when the variable is entirely absent — but it is the same class of defect as SEC-P0-03 and should be closed by removing the default. It was **not** changed in Wave 0 because it alters deployment behaviour and is outside the approved scope. **Recommend adding it to Wave 1 as a P0-adjacent fix.**

---

## 9. Deferred findings and the flagged unrelated change

**Excluded from all Wave 0 work, preserved in the tree:**

- `backend/…/guardian/GuardianScheduleController.kt` + `GuardianSchoolDatesTest.kt` — **removes REGIONAL school dates** and inverts the test to assert their absence. This is a behavioural product change to guardian visibility. It is unrelated to messaging and unrelated to Wave 0. **It requires its own review before it enters any commit.**
- `DeadlineController.kt` (+113), `DevicesAndBillingApiTest.kt` (+81), `ShowcaseDataInitializer.kt`, `ai-elewa/tests/test_full_pipeline.py` — pre-existing, untouched.
- `frontend/public/sw.js` — regenerated by the build in this session (precache manifest only); it remains a build artifact and should not be committed.
- `application-dev.yaml` and its `.bak` — the LAN CORS origin is preserved; the `.bak` is now ignored but still on disk.

---

## 10. Change control compliance

- **No commit, no push, no deploy, no domain, no secret change, no payment configuration.** Branch and HEAD are unchanged at `47d17f5`.
- All 4 stashes intact.
- The two staged new backend tests from earlier work remain staged and were not touched.
- `git diff --name-only` shows only the 10 intended files plus the 9 pre-existing modified files.
- Two rounds of verification were run after the final edits (frontend tsc/Vitest, production build; backend full suite).

---

## 11. Wave 0 exit criteria

| Criterion | Status |
|---|---|
| Demo seeding has secure defaults | **MET** — placeholder defaults FALSE, guard fails closed, 8 regression tests |
| Production demo-seeding safeguards verified | **MET at unit/config level** — guard matrix tested; a real `prod`-profile boot was **not** performed because no PostgreSQL is available on this host |
| Selected navigation defects corrected | **MET** for the 5 approved routes, enforced by an invariant test |
| Critical broken links / user-facing defects corrected | **MET** — learner 403 upload affordance removed; parent copy fixed |
| Regression tests pass | **MET** — 368 backend, 34 frontend, tsc clean, production build clean |
| No unexplained changes in the working tree | **MET** — audited file by file |
| Execution report complete | **MET** — this document |
| Remaining P0/P1 identified | **MET** — §8 and §12 |

**Wave 0 is complete.** Two caveats are recorded rather than glossed: the production-profile boot was verified by unit test and configuration assertion only, and the E2E suite was not re-run (its last full evidence is 38/38 on 8 Nov 2026).

---

## 12. Remaining security blockers

**P0 (unchanged by Wave 0 — these still block an external pilot):**

1. **SEC-P0-01** — no age gate, no parental consent, no DOB on open registration.
2. **SEC-P0-02** — no privacy policy, DPIA, retention schedule, DSAR/erasure path.

**P0-adjacent (newly identified):**

3. **Default `JWT_SECRET` in `application-docker.yml`** — remove the fallback so a missing secret fails to start (§8).

**P1:** no `SUPER_ADMIN`/national role · no erasure/export endpoints · login limiter keyed on the proxy IP · upload validation/storage · learner documents · no AI quotas · no monitoring/alerting.

---

## 13. Recommended Wave 1 entry criteria

Wave 1 is the **lawful-processing** wave (R-07 … R-10). It should not start until:

1. **Legal advice is engaged** on the consent standard and the DPIA scope — it is the longest lead time and the true critical path.
2. **A product decision is recorded** on the guardian joining model (self-registration + link code, or school-invite only). R-07 and R-10 are the same decision seen twice and must be built together.
3. **The flagged `GuardianScheduleController` change is reviewed and either committed or reverted** — a shared working tree with an unreviewed behavioural change will contaminate every later commit.
4. **A PostgreSQL 16 instance is available** (compose already defines it) so R-30 can verify migrations before any schema change in Wave 1.
5. **The Wave 0 changes are reviewed and committed** — they are currently uncommitted, and Wave 1 will touch the same configuration files.

**Do not treat Wave 0 as a signal that Elekeza is pilot-ready.** It removed an open-administrator footgun, gave five operational pages their navigation back, and converted three classes of defect into regression tests. The product-level blockers — consent, guardian access, and the single application shell — are all still ahead.
