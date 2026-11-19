# ELEKEZA — TEST & QUALITY REPORT

**Date of execution:** 14 Nov 2026, ~09:12–09:25 EAT
**Branch:** `sprint-3-safe-config` @ `47d17f5`
**Host:** Windows, 8 GB RAM class machine (relevant — see TEST-P2-03)
**Rule applied:** passing tests are reported as passing only where the command was run in this session and its exit status was captured without a pipe swallowing it.

---

## 1. Executed in this session

| # | Suite | Command | Result | Counts | Time | Exit |
|---|---|---|---|---|---|---|
| 1 | Backend unit + integration | `cd backend && ./gradlew test --console=plain` | **BUILD SUCCESSFUL** | **357 tests / 54 classes / 0 failures / 0 errors / 0 skipped** | 5m 53s | **0** |
| 2 | Frontend type-check | `cd frontend && npx tsc --noEmit` | **clean** | — | ~35s | **0** |
| 3 | Frontend unit (Vitest) | `cd frontend && npx vitest run` | **all passed** | **4 files / 20 tests** | 6.85s | **0** |
| 4 | AI service (Pytest) | `cd ai-elewa && venv/Scripts/python.exe -m pytest -q --ignore=tests/test_live_smoke.py` | **partial — 31 environmental failures** | **572 passed / 31 failed / 55 deselected** | 147.85s | non-zero |

Raw logs: `docs/audit/evidence-backend-test.log` (suite 1). Suites 2–4 were captured to temp logs and are summarised here; the failure mode for suite 4 is reproduced in §4.

### Backend suite detail
- Slowest classes: `ExamApiTest` 13.7 s, `PersonalizationIntegrationTest` 11.3 s, `MultiTenantAuthorizationTest` 8.5 s, `DeadlineAuthorizationTest` 7.7 s, `AccessibilityProfileApiTest` 5.5 s.
- Compiler warnings only: 6 × "variable is never used" in test sources. No errors.
- The suite runs against H2 in PostgreSQL compatibility mode with Flyway migrations applied; it is **not** a real-PostgreSQL run (TEST-P2-04).

### Frontend unit detail
```
✓ src/lib/pluralize.test.ts              (3 tests)
✓ src/lib/masteryDisplay.test.ts         (4 tests)
✓ src/components/learner/LearningCompanion.test.tsx (4 tests)
✓ src/components/learner/Celebration.test.tsx       (9 tests)
Test Files  4 passed (4)      Tests  20 passed (20)
```
**Caveat discovered:** `npx vitest run --reporter=basic` fails with `ERR_LOAD_URL` under Vitest 5 (the reporter name no longer exists). The project's own script (`"test": "vitest run"`) is correct; anyone adding `--reporter=basic` in CI will see a crash that looks like a code failure.

---

## 2. NOT executed in this session (and why)

| Suite | Status | What exists instead |
|---|---|---|
| Playwright E2E (7 specs) | **Not re-run** | Authoritative prior evidence: `frontend/e2e-full-2-2026-11-08.log` → **38 passed (19.4m)**, `FINAL E2E EXIT: 0`, zero failed/flaky/skipped. Not repeated because it needs a live backend + Next dev server on :8090/:3100 and takes ~20 min on an 8 GB host; the brief forbids claiming unrun results, so this is prior evidence, not a fresh pass. |
| Production Next build | **Not run** | Prior evidence in `docs/audit/ELEKEZA_DEPLOYMENT_READINESS.md`: prod build compiles (67 routes). Type-check passing today is consistent with that but does not prove it. |
| AI live smoke | **Deselected** | Requires a provider API key and network; `tests/test_live_smoke.py` excluded from suite 4. |
| Migration test against real PostgreSQL | **Not run** | `backend/flyway-validation/` exists (untracked) from earlier work; no Postgres server is listening on :5432 this session. |
| Device / responsive / screen-reader testing | **Not run** | No device access; see `ELEKEZA_ACCESSIBILITY_AUDIT.md` and `ELEKEZA_UI_UX_REVIEW.md`. |
| Dependency vulnerability scan | **Not run** | No `npm audit`/Trivy run this session; GitLab CI mirror is said to run Trivy. |

---

## 3. Coverage shape (the real quality story)

| Layer | Tests | Verdict |
|---|---|---|
| Backend | 357 across 54 classes, including `MultiTenantAuthorizationTest`, `GuardianRelationshipTest`, `AuthAndInputSecurityTest`, 6 × M-Pesa, `ContentUploadSecurityTest`, `AccessibilityProfileApiTest` | **Strong.** This is the trustworthy part of the test estate. Authorization and payment paths are genuinely covered. |
| Frontend unit/component | 20 across 4 files, all in `lib/` and `components/learner/` | **Very thin.** 61 routes and roughly a hundred components have no unit coverage. |
| E2E | 7 specs, 38 tests | **Meaningful but narrow** — 3 of 5 roles, ~14 routes. No admin/school-admin. |
| Accessibility | axe over 7 routes, WCAG 2.1 tags | **Floor only**, and below the 2.2 target. |
| AI | 603 selected tests | Broad, but not hermetic (§4). |

**Ratio worth stating plainly:** backend has ~18× more tests than the frontend, while the frontend holds the navigation, layout and accessibility defects found in this audit. The defect distribution matches the coverage distribution exactly.

---

## 4. Suite 4 failure analysis — environmental, not a regression

Every one of the 31 failures is `httpx.ConnectError: [WinError 10061] No connection could be made because the target machine actively refused it`.

- These are HTTP-level tests that talk to a **running** AI service (`http://localhost:8001` by default). No such service was started in this session.
- Sample: `tests/test_edge_cases.py::TestSecurityEdgeCases::test_health_requires_no_auth` → `ConnectError` while trying to GET `/health`. A test asserting that `/health` needs no auth cannot itself connect; the failure is transport, not behaviour.
- Running service tests in `docs/audit/evidence-backend-test.log` context: the backend on :8085 boots fine; the AI service is a separate process and was not running.

**Correct classification:** 572/603 of the selected AI tests pass without a server; 31 require one. This is a **test-design defect** (below), not evidence that the AI service is broken.

---

## 5. Findings

### TEST-P1-01 — The entire school-admin and platform-admin experience has no automated test account

- **Evidence:** `frontend/e2e/helpers.ts` exports exactly three fixtures: `LEARNER` (`student@elekeza.app`), `TEACHER`, `GUARDIAN`. The seed **does** contain `admin@elekeza.app` (`SCHOOL_ADMIN`) and `superadmin@elekeza.app` (`ADMIN`), but no spec uses them. `a11y.spec.ts` and `routes-crawl.spec.ts` therefore cannot reach `/admin`, `/admin/staff`, `/finance`, `/attendance`, `/analytics`, `/super-admin`.
- **Impact:** the five routes that render **without a shell**, and the four most form-dense pages in the product, are the ones with zero automated coverage. A regression in staff management or finance would ship undetected.
- **Remediation:** add `SCHOOL_ADMIN` and `ADMIN` fixtures; add a crawl + axe pass for each; add one journey each for "admin creates staff" and "admin records a payment".
- **Acceptance criteria:** every role in `UserRole` has at least one authenticated crawl; admin journeys appear in the E2E report with timings.

### TEST-P1-02 — Frontend component coverage is effectively zero outside two learner widgets

- **Evidence:** 4 test files, 20 tests. `src/app/**` has no tests at all.
- **Impact:** the layout/navigation/shell defects found in this audit are exactly the class of bug a 10-line component test would have caught ("for role TEACHER, the nav renders 15 items and one `<main>`").
- **Remediation:** add per-role shell snapshot tests, a route↔shell presence test driven by the inventory, and tests for the two known-broken pages (`/upload` role guard, `/admin/staff` missing-institution state).
- **Acceptance criteria:** a shell test fails if any authenticated route loses its layout.

### TEST-P2-01 — The AI test suite is not hermetic

- **Evidence:** 31 tests require a live server; without it they fail with `ConnectError`. `tests/conftest.py` only loads `.env` — it does not provision a TestClient or fixture server.
- **Impact:** CI must start the service before pytest, and any developer running pytest alone sees a red suite that means nothing. This trains people to ignore failures.
- **Remediation:** either convert the HTTP tests to an in-process `TestClient` (FastAPI supports this natively) or add a session fixture that boots the app; mark genuinely external tests with `@pytest.mark.integration` and deselect by default.

### TEST-P2-02 — Accessibility gate is below target and narrow
Cross-ref `A11Y-P1-01` / `A11Y-P1-02`: 7 routes, WCAG 2.1 tags, no admin surfaces.

### TEST-P2-03 — E2E reliability depends on host memory, and the config leaves a competing Gradle daemon resident
- **Evidence:** the 8 Nov run 1 recorded **3 failed / 3 flaky / 32 passed (1.2 h)**, run 2 recorded **38/38 (19.4 m)** on the same code. The documented cause is RAM contention from `globalSetup`'s `gradlew bootJar` leaving a Gradle daemon resident on an 8 GB host. `playwright.config.ts` uses `workers: 1`, `retries: 1`, `timeout: 240_000`.
- **Impact:** a green suite is currently a function of machine state. Retries:1 can also mask a genuine intermittent defect as "flaky then pass".
- **Remediation:** `./gradlew --stop` after `globalSetup`; assert free memory or reduce concurrency; record the host profile alongside the result; fail the run if any test needed a retry, so flakiness stays visible.

### TEST-P2-04 — No migration verification against real PostgreSQL
- **Evidence:** backend tests use H2 in PostgreSQL mode; `V2__seed_demo.sql`'s own header warns that editing it changes the Flyway checksum and that existing databases need `flyway repair`. No server is on :5432.
- **Impact:** H2-compatibility is not PostgreSQL. Column types (`JSONB` via hypersistence), partial indexes, and placeholders can behave differently; the demo-seed gate itself is a Flyway placeholder whose prod resolution is unverified in this session.
- **Remediation:** add a CI job that boots `postgres:16-alpine` (the compose file already defines it) and runs `flyway migrate` + the suite against it; keep the existing `backend/flyway-validation` work but bring it under version control with a README.

### TEST-P3-01 — JaCoCo is configured but no coverage gate exists
`build.gradle.kts` configures `jacocoTestReport` (XML + HTML) but nothing enforces a threshold, and no report was generated for this run. Coverage is therefore a number nobody looks at.

### TEST-P3-02 — No lint gate in the reviewed evidence
`package.json` defines `"lint": "eslint"` but no `jsx-a11y` rule set was found enforcing accessible names. That is why the guardian send button shipped unlabelled (fixed in `47d17f5`) and why `RoleLayout` can ship a footer naming another company.

---

## 6. Quality verdict

| Question | Answer |
|---|---|
| Is the backend trustworthy? | **Yes, for its covered paths.** 357/357 green in this session, with genuine authorization and payment coverage. |
| Is the frontend trustworthy? | **No — not yet.** 20 unit tests for 61 routes; the defects found in this audit are precisely in the untested 90 %. |
| Is the E2E suite a release gate? | **Partially.** It gates the learner/teacher/guardian core loop well; it does not gate the admin half of the product. |
| Can a green run be trusted as "production ready"? | **No.** It does not cover admin roles, does not test WCAG 2.2, does not run against PostgreSQL, and depends on host memory. |
