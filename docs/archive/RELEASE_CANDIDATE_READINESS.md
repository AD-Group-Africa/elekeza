# RELEASE CANDIDATE READINESS — Elekeza

Status: **PILOT READY (KNOWN LIMITATIONS) — code gates green 2026-09-17; two external/preflight items remain before a production tag**
Branch: `release/v0.1.0`. Every status below carries evidence from this gate; nothing is marked PASS merely because code exists.

## Update 2026-09-17 (late evening) — pilot handoff freeze

Release frozen for real-user handoff. Pilot documentation completed:
`docs/PILOT_READINESS.md` (verdict + evidence), `PILOT_RUNBOOK.md`, role guides
(`TEACHER_PILOT_GUIDE.md`, `GUARDIAN_PILOT_GUIDE.md`, `LEARNER_PILOT_GUIDE.md`),
`PILOT_FEEDBACK.md`, `PILOT_SUCCESS_CRITERIA.md`. Final verification of this freeze:

- Backend **220/220, 0 failed, 0 skipped**; tsc clean; **vitest 17/17**; `next build` green;
  **Playwright 31/31, 0 flaky** (12.4m clean run).
- Fresh PostgreSQL re-verified for the freeze: 12/12 migrations, boot 200, constraints checked
  (unique submission-per-learner, charge-number uniqueness, score/amount CHECKs, FK chains),
  zero orphan rows.
- Manual four-role API journeys re-verified with real logins incl. denials (guardian unlinked
  ward → 403, learner finance-create → 403, teacher finance-read → 403).
- Guardian surfaces migrated to the moss-green token system; fabricated "teacher note" mock
  data removed from the guardian dashboard and replaced by the real daily digest.
- Naming/contamination scan: no Freebuff/DukaPRO/BlueSky strings in product code, UI, docs
  or seed data (only `.freebuff/` tooling infrastructure paths, which are not product content).
- Production M-Pesa remains the single external gate (`docs/MPESA_PRODUCTION_CHECKLIST.md`).

**Next phase is learning, not building** — see `docs/PILOT_PLAN.md` and
`docs/PILOT_SUCCESS_CRITERIA.md`.

## Update 2026-09-17 (evening) — production gates closed + assignments + guardian digest

- **Gate 1 — fresh-PostgreSQL migration (PASSED):** virgin PostgreSQL 15.17 database,
  prod profile boot → **11 Flyway migrations applied** (`schema_version 11`), Hibernate
  `validate` OK, `/actuator/health` 200. V10 attendance and V11 finance confirmed on real PG.
- **Gate 2 — staging deploy exercise (PASSED):** `scripts/staging-gate.sh` runs the real
  production artifact path end-to-end on one machine: `next build` (prod, API URL baked in),
  fresh PG + migrations, boot JAR on the prod fail-fast env contract, `next start`, then
  smoke checks (health, HTTP 200, login round-trip through the production rewrite). Verified
  green; runbook updated. **Gate 3 — production M-Pesa credentials:** external/owner-side;
  `docs/MPESA_PRODUCTION_CHECKLIST.md` lists the exact Daraja env contract, callback
  requirements and verification steps. Explicitly NOT claimed configured.
- **Assignments domain (NEW):** V12 migration, `assignments` module — create/publish,
  learner submit/resubmit (single row update, no duplicates), staff grading with
  score-bounds validation, guardian read-only ward evidence, tenant isolation (cross-tenant
  reads/grades → 404, not 403, to prevent resource discovery). `AssignmentApiTest` 12/12.
  UI: learner `/assignments`, teacher `/teacher-assignments`, both in the sidebar.
- **Guardian daily digest (NEW):** `GET /api/guardian/wards/{id}/digest` — server-composed
  per-ward snapshot (learning, attendance incl. today's status, classwork due/missing/feedback,
  server-derived fee balance from charges minus allocations). `GuardianDigestTest` 3/3
  (ward boundary + role boundary). UI: “Today at a glance” card on the ward detail page.
- **Full-suite evidence (2026-09-17, current code):** backend `./gradlew test` →
  **220/220, 0 failed, 0 skipped** (27 suites); frontend `tsc --noEmit` exit 0,
  **vitest 17/17**, `next build` green (56 routes incl. `/assignments`);
  **Playwright 31/31 in a single clean run (9.1m), 0 failed, 0 flaky** — including the
  a11y (axe) gate, offline queue, exam, attendance, finance, guardian fees and all three
  route-crawls.
- **Fixed during this gate:** E2E login race (helpers now wait for the post-login redirect);
  `.next-e2e` distDir so E2E and the live preview never contend for the Next build dir;
  `/dashboard/settings` hydration blank; school-admin E2E now uses real onboarding;
  **Fast-Refresh bounce during login** (dev HMR full-reload could land the page back on
  /login before the SPA redirect committed — traced to a 200 login + 200 /teacher RSC fetch
  followed by an HMR reload; helper now tolerates/retries the bounce deterministically).
- **Remaining before a production tag (explicit):** production M-Pesa Daraja credentials
  + HTTPS callback (external, owner-side, checklist above); one real-host staging deploy
  (script is proven locally). See `RELEASE_TEST_MATRIX.md` and `PRODUCT_STRATEGY_ASSESSMENT.md`.

## Update 2026-09-17 — P0 attendance + fees closed, full gate green

Both P0 blockers listed at the bottom of this document are now implemented and verified:

- **Attendance** — V10 migration, `attendance` module (entities/service/controller), teacher-class
  authorization, duplicate-session uniqueness, guardian-ward isolation, learner read-only,
  tenant isolation. `AttendanceApiTest` (12) green. UI `/attendance`; E2E register journey green.
- **School fees/payments** — V11 migration, `finance` module: academic periods, fee items,
  structures, learner charges, payments (manual + M-Pesa), allocations, server-derived balances,
  receipts. `FinanceApiTest` (14) green incl. M-Pesa callback replay idempotency and cross-tenant 403.
  UI `/finance` (admin), `/guardian/fees` (guardian); E2E green for both, using the REAL school
  onboarding flow to create the SCHOOL_ADMIN.
- **Full-suite evidence (2026-09-17):** backend `./gradlew test` → **205/205, 0 failed, 0 skipped**;
  frontend `tsc --noEmit` exit 0 (vitest/lint/build green earlier in this gate);
  **Playwright 31/31** (30 in full run + 1 selector fix re-verified in focused 4/4 run).
- **Fixed during this gate:** E2E login race (helpers now wait for the post-login redirect);
  `.next-e2e` distDir so E2E and the live preview never contend for the Next build dir;
  `/dashboard/settings` hydration blank; school-admin E2E now uses real onboarding.
- **Remaining before a production tag (explicit):** fresh-PostgreSQL migration gate including
  V10/V11 (H2 clean-migration is exercised every E2E run); production M-Pesa Daraja credentials
  + HTTPS callback (external); one staging deployment exercise. See `RELEASE_TEST_MATRIX.md`
  (2026-09-17 section) and `PRODUCT_STRATEGY_ASSESSMENT.md` for the roadmap.

## Gap matrix (historical — pre-P0-closure; superseded rows per 2026-09-17 update above)

| Capability | Status | Evidence |
| --- | --- | --- |
| Authentication (login/logout/forgot) | **PASS** | E2E: browser login 200 → role redirect; wrong password → accessible `role="alert"` error; forgot-password neutral confirmation (no enumeration); logout clears session. Backend: `AuthAndInputSecurityTest` (15), `ForgotPasswordEndpointTest` (5). |
| Browser auth chain (CORS) | **PASS** | Fixed this gate: dev CORS only allowed :3000; browser login from any other dev port 403'd (masquerading as "Invalid email or password"). Instrumented request log proves the fix; curl had masked it (no Origin header). |
| Learner journey (home → lesson → quiz → score → progress) | **PASS** | E2E `learner journey` (25s, real server scoring, real persisted progress). Celebration dialog was undismissible (real trap bug) — fixed with a required `Continue` affordance + test. |
| Quiz / assessment integrity | **PASS** | Server-scored; duplicate submissions deduped server-side (verified in `QuizController` + prior suites); offline answers queue in IndexedDB and replay with Idempotency-Key. E2E answers + submits + reads server score. |
| Exam (server-authoritative timing, immutable submissions) | **PASS WITH LIMITATION** | Backend `ExamApiTest` (18) covers timing/immutability/integrity. Browser E2E for the exam runner is not yet scripted (deferred item below); flow verified live in earlier gates. |
| Mastery V1 (deterministic, explainable) | **PASS** | `MasteryEngineTest` (17): states, thresholds, single-attempt caution, determinism, explainability. `MasteryAuthorizationTest` (5): tenant isolation, 404-not-403, class-support ranking, student denial. Surfaced in learner progress + teacher support panel. |
| Adaptive next-step recommendations | **PASS** | Explainable per-state recommendations (`start/practice/support/challenge`); insufficient evidence → explicitly weak recommendation. Rendered on `/progress` ("What to do next"). |
| Teacher journey | **PASS** | E2E: students table, support panel with lesson-mastery evidence, progress dashboard. Authorization: `MultiTenantAuthorizationTest` (11), `SupportAuthorizationTest` (9). |
| Guardian journey | **PASS** | E2E: ward list → ward detail; cross-guardian ward access renders no foreign learner data. `GuardianRelationshipTest` (3) + `GuardianAnalyticsAuthorizationTest`. |
| Tenant isolation | **PASS** | Server-side institution checks everywhere (incl. new mastery endpoints); cross-tenant tests green in suite. |
| Personalization + safety | **PASS WITH LIMITATION** | Precedence EXPLICIT > TEACHER > GUARDIAN > OBSERVED > SYSTEM enforced (30 tests); adaptation is curriculum-safe, non-diagnostic. Limitation: a11y settings are client-persisted per device; deeper assistive-tech validation with real users is pilot work. |
| Gamification | **PASS WITH LIMITATION** | Points/levels/stars/achievements computed from persisted completions; anti-abuse: score dedup server-side. Limitation: no dedicated E2E for repeat-completion replay; covered indirectly by quiz E2E + backend scoring tests. |
| Offline / PWA | **PASS WITH LIMITATION** | next-pwa registered on production builds (regenerated this gate); IndexedDB queue with idempotent replay. Limitation: automated offline E2E not yet scripted (manual verification documented in report). |
| Accessibility (WCAG 2.1 AA baseline) | **PASS WITH LIMITATION** | Skip links, aria-current, focus-visible, reduced motion, aria-live, non-colour meaning (distinct icons), large targets — verified by E2E + unit tests. Limitation: axe-core automation and real screen-reader sessions still to be added. |
| Error/empty states | **PASS** | Error paths verified in E2E (401 alert, offline notice, empty states with guidance). No raw stack traces or blank screens in core flows. |
| Seed reproducibility | **PASS** | Fresh H2 per boot; seed assigns the demo lesson to the learner with a real completed attempt (score now on the true 0–100 scale — fixed this gate); E2E runs from clean DB every time. |
| M-Pesa / SMS / Email / AI / Storage | **PARTIALLY VERIFIED / EXTERNAL CONFIGURATION BLOCKERS** | M-Pesa has an STK/callback module, but it is not an institution-scoped learner-fee system. Live provider credentials are owner-side. |

## Expanded-sprint release blockers found 2026-09-16

- No attendance domain, API, migration, or test suite was found.
- Finance has `mpesa_transactions` only. It lacks institution and learner ownership plus fee structures, charges/invoices, allocations, balances, receipts, and manual-payment support. It must not be presented as the requested school fee collection workflow.
- The acceptance matrix predates the expanded brief. A fresh clean-start run of all five roles, the full backend suite, frontend gates, and E2E suite is still required for this release decision.

## Fixed during this gate (defects the release gate caught)

1. **Browser login 403 on non-3000 dev ports** — CORS allow-list; dev-only fix, production untouched.
2. **Undismissible celebration dialog** — learners were trapped after every quiz until reload; added required `Continue` affordance (a11y-correct alertdialog dismissal).
3. **Forgot-password double `/api` prefix** — the reset flow 404'd silently in the UI; one-line fix, swept for other instances (none).
4. **Seed didn't assign the demo lesson** — fresh learner home had no primary action; seed now completes the demo lesson for the seeded learner.
5. **Seed attempt score on wrong scale** (0.8 vs 0–100).

## Deferred (explicit, not hidden)

- Exam-runner browser E2E spec (backend coverage exists; browser script pending)
- Offline/offline-reconnect automated E2E (manual verification documented)
- axe-core automation in CI; screen-reader manual sessions
- Mastery per-skill granularity (questions are not yet skill-tagged; V1 is per-lesson by design)
