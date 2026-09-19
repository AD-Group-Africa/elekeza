# RELEASE TEST MATRIX — Elekeza

## Pilot-freeze gate (2026-09-17, late evening) — CURRENT

Final regression for the real-user handoff freeze. Historical sections below.

| Area | Test | Result | Evidence |
| --- | --- | --- | --- |
| Backend | Full suite | **PASS — 220/220, 0 failed, 0 skipped** (27 suites) | `./gradlew test` |
| Frontend | tsc / vitest / build | **PASS** | tsc exit 0; vitest 17/17; `next build` exit 0 |
| E2E | Playwright full suite | **PASS — 31/31, 0 failed, 0 flaky (12.4m)** | clean single run incl. axe a11y, offline queue, exam, attendance, finance, route-crawls |
| Database | Fresh PostgreSQL V1–V12 re-verified | **PASS** | 12 migrations validated+applied; boot 200; constraints: `uq_submission_assignment_learner`, `learner_charges_charge_number_key`, score/amount CHECK constraints, FK chains intact; zero orphan rows (assignments→classes, allocations→charges) |
| Seed | Prod profile V2 accounts + auth smoke | **PASS** | `superadmin@elekeza.app` login 200 on fresh PG; dev profile full demo seed verified via preview boot log |
| Authorization | Four-role manual API journeys | **PASS** | learner: progress/assignments 200, finance-create 403; teacher: classes/students 200, finance-read 403; guardian: ward digest 200, unlinked ward 403; admin: summaries 200 |
| Accessibility | axe-core gate (in E2E) + token migration | **PASS (baseline)** | 7 a11y specs green; guardian surfaces migrated to tokens (0 legacy purple classes) |
| Naming | Contamination scan | **PASS** | no Freebuff/DukaPRO/BlueSky in product code/docs/seed |

## Expanded-release gate (2026-09-17, evening) — historical

> This section is the live evidence for the school-platform scope. Older sections below are historical.

| Area | Test | Result | Evidence (2026-09-17 evening) |
| --- | --- | --- | --- |
| Backend unit/integration/security | Full suite | **PASS — 220/220, 0 failed, 0 skipped (27 suites)** | `./gradlew test` — includes `AssignmentApiTest` 12, `GuardianDigestTest` 3, `AttendanceApiTest` 12, `FinanceApiTest` 14, tenant-isolation, M-Pesa idempotency |
| Production gate 1 | Fresh-PostgreSQL migration V1–V11 + validate + boot | **PASS** | virgin PG 15.17 DB, prod profile: 11 migrations applied, Hibernate `validate` OK, `/actuator/health` 200 |
| Production gate 2 | Staging deploy exercise | **PASS** | `scripts/staging-gate.sh`: `next build` (prod) → fresh PG migrations → boot JAR (fail-fast env) → `next start` → health/HTTP/login smoke checks, all green |
| Production gate 3 | Production M-Pesa Daraja credentials + HTTPS callback | **BLOCKED (external, owner-side)** | `docs/MPESA_PRODUCTION_CHECKLIST.md` — exact env contract + verification steps; NOT claimed configured |
| Assignments domain | V12 migration + create/submit/grade + authz | **PASS** | `AssignmentApiTest`: tenant create 403, cross-tenant reads/grades → 404, resubmission updates single row, score-bounds 400, guardian ward isolation, learner cannot create/grade |
| Guardian daily digest | Server-composed ward snapshot | **PASS** | `GuardianDigestTest`: all four sections present (learning/attendance/classwork/fees), unlinked-ward 403, learner role 403; fees balance derived charges − allocations |
| Frontend gates | tsc / vitest / build | **PASS** | `tsc --noEmit` exit 0; **vitest 17/17**; `next build` green, 56 routes incl. `/assignments` + digest on ward page |
| E2E | Playwright full suite, single clean run | **PASS — 31/31, 0 failed, 0 flaky (9.1m)** | a11y axe gate, offline queue, exam, attendance register, finance, guardian fees, school-admin onboarding, all 3 route-crawls |
| Login HMR-bounce hardening | Fast Refresh reload during SPA redirect tolerated | **PASS** | helper retried-bounce fix verified: full 31/31 run + focused `routes-crawl` 3/3 |

## Expanded-release gate (2026-09-17, morning) — historical

| Area | Test | Result | Evidence (2026-09-17) |
| --- | --- | --- | --- |
| Backend unit/integration/security | Full suite | **PASS — 205/205, 0 failed, 0 skipped** | `./gradlew test` (JAR of XML results; includes `AttendanceApiTest` 12, `FinanceApiTest` 14, tenant-isolation, M-Pesa idempotency) |
| Attendance domain | Migration V10 + entities + API + authz | **PASS** | `AttendanceApiTest`: teacher-class scoping, duplicate-session uniqueness, guardian-ward isolation, tenant isolation, learner read-only, cross-class 403 |
| Finance domain | Migration V11 + charge→payment→allocation→balance→receipt | **PASS** | `FinanceApiTest`: manual payment, explicit allocation, oldest-due auto-allocation, server-derived balances, receipt, M-Pesa callback replay idempotency (one payment), cross-tenant 403 |
| M-Pesa | Mock mode + idempotent callback→payment | **PASS (mock) / BLOCKED (production)** | `MpesaGateway` mock deterministic; `MpesaPaymentListener` replay-safe; production Daraja credentials + HTTPS callback not configured (UI states "Production M-Pesa not configured") |
| Seed | Deterministic attendance+finance demo data, idempotent | **PASS** | `AttendanceFinanceSeed` runs in base dev seed; log `Attendance + finance seed complete` on every boot; E2E depends on it |
| Frontend gates | tsc / vitest / lint / build | **PASS** | `npx tsc --noEmit` exit 0 (2026-09-17); vitest/lint/build green in this gate (see RELEASE_CANDIDATE_READINESS.md) |
| E2E | Playwright, real stack (JAR + Next dev, fresh H2 per run) | **PASS — 31/31** | 30 passed in full run + 1 selector fix (`Next →` vs dev-tools button) re-verified 4/4 in focused run; specs: auth, journey, exam, offline, a11y (axe), routes-crawl, attendance register, guardian finance, school-admin finance onboarding |
| Attendance E2E | Teacher marks register → save → counts | **PASS** | `attendance-finance.spec.ts` "teacher marks and saves the register" + "history reachable" |
| Guardian finance E2E | Ward fees, balance, history | **PASS** | `attendance-finance.spec.ts` guardian test |
| School-admin finance E2E | Real onboarding → finance dashboard honest zeros | **PASS** | `attendance-finance.spec.ts` school onboarding test |
| Clean migration | Fresh H2 applies V1→V11 every E2E run | **PASS (H2)** | Playwright webServer boots JAR from empty datadir each run; fresh-PostgreSQL gate still required before tagging (historical V1→V5 gate passed 2026-09-03; V10/V11 not yet re-gated on real PG) |
| Login race hardening | Auth cookie guaranteed before navigation | **PASS** | `helpers.login()` + `journey.spec.ts` wait for post-login redirect (fixes 2026-09-17 flake); `.next-e2e` distDir decouples E2E from live preview |

**Remaining for release tag:** fresh-PostgreSQL migration gate incl. V10/V11; production M-Pesa credentials (external); staging deploy exercise.

---

## Historical evidence (learner-learning gate)

Evidence from this release gate. Exact commands in `RELEASE_CANDIDATE_REPORT.md`.

| Area | Test | Result | Evidence |
| --- | --- | --- | --- |
| Auth | Login (browser) | PASS | E2E #1: login 200 → `/student-home` |
| Auth | Logout | PASS | E2E #4: returns to `/login`, session cleared |
| Auth | Recovery (forgot password) | PASS | E2E #3: neutral confirmation, no enumeration |
| Auth | Invalid credentials | PASS | E2E #2: accessible `role="alert"` error |
| Security | IDOR / cross-guardian ward | PASS | E2E #8: no foreign learner data rendered |
| Security | Tenant isolation (backend) | PASS | `MultiTenantAuthorizationTest` (11), mastery auth tests (5) |
| Security | Teacher cross-institution | PASS | Mastery test: teacher A → learner B = 403 |
| Learner | Lesson flow | PASS | E2E #5: read sections → practice gate → quiz |
| Learner | Quiz (browser, server-scored) | PASS | E2E #5: answer → submit → score → review |
| Learner | Progress page (real data) | PASS | E2E #5 + `/progress` assertions |
| Learner | Mastery "What to do next" | PASS | Rendered from `/mastery/learner`; explainable reasons |
| Learner | Accessibility preferences page | PASS | E2E #6: "Make lessons work for you" loads |
| Learner | Celebration dismissible | PASS | Unit + E2E: `Continue` closes the dialog |
| Learner | Exam | PASS WITH LIMITATION | Backend `ExamApiTest` (18); browser spec deferred |
| Learner | Offline | PASS WITH LIMITATION | SW + IndexedDB queue verified in build/code; automated offline E2E deferred |
| Teacher | Students + support panel | PASS | E2E #9: table + mastery evidence panel |
| Teacher | Progress tracking | PASS | E2E #10: dashboard renders |
| Teacher | Intervention (learning preferences) | PASS | Support panel guidance save (409 on learner-set prefs verified in backend tests) |
| Guardian | Ward list + detail | PASS | E2E #7 |
| Guardian | Notifications | PASS WITH LIMITATION | Notification chain verified live in earlier gates; not in current E2E spec |
| Mastery | Skill calculation | PASS | 22 backend mastery tests (engine + authorization) |
| Mastery | Explainability | PASS | Rationale asserted in tests; plain-language reasons in UI |
| Gamification | Completion reward | PASS WITH LIMITATION | Points/stars from persisted completions; replay-abuse E2E deferred |
| PWA | Service worker | PASS | Regenerated by production build (`npm run build`) |
| E2E | Full journey suite | PASS | **12/12 Playwright tests** |
| Unit (frontend) | Critical components | PASS | **17/17 Vitest tests** |
| Unit (backend) | Full suite | PASS | **173 tests, 0 failures, 0 skipped** |
| Mobile | Tablet viewport | PASS WITH LIMITATION | Learner UI is tablet-first by design (92–112px targets); automated viewport E2E deferred |
| Performance | Slow network | DEFERRED | No automated perf gate in this RC; no N+1 known on learner path |
| Attendance | Teacher mark/save/guardian visibility/report | BLOCKED | No attendance backend domain or API found |
| School finance | Fee → charge/invoice → payment → allocation → balance | BLOCKED | Current M-Pesa transaction table is not learner- or institution-scoped and has no invoice/allocation/manual-payment model |
| Five-role clean start | Learner, teacher, guardian, school admin, super admin | BLOCKED | Needs a fresh environment and complete ERP scope |
| Build | Production build | PASS | `NEXT_PUBLIC_API_URL=… npm run build` — all routes |
| Typecheck | `tsc --noEmit` | PASS | exit 0 |
| Lint | `npm run lint` | PASS | 0 errors (26 pre-existing warnings) |
