# TEST RESULTS — 2026-11-19

**Tree under test:** `sprint-3-safe-config` @ `47d17f5` + 24 modified / 18 untracked paths
**Machine:** Windows 11, Git Bash · JDK 21.0.9 (Temurin) · Node 24.19.0 / npm 11.14.1 · Python 3.14.4 (venv 3.12) · Docker 29.2.1
**Raw logs:** `artifacts/audit-2026-11-19/`

> Every figure below was produced by a command run today. No historical result was carried forward. Where something could not be run, it is marked **NOT RUN** rather than assumed.

---

## 1. Summary

| Suite | Command | Result | Duration | Log |
|---|---|---|---|---|
| Backend unit + integration | `cd backend && ./gradlew test --console=plain` | ✅ **397 passed / 0 failed / 0 skipped** (59 classes) | 9 m 07 s | `backend-test.log` |
| Backend production build | `cd backend && ./gradlew bootJar` | ✅ **BUILD SUCCESSFUL** | 21 s | `backend-bootjar.log` |
| Frontend typecheck | `npx tsc --noEmit` | ✅ **pass** (exit 0) | — | `frontend-checks.log` |
| Frontend unit tests | `npx vitest run` | ✅ **34 passed / 34** (6 files) | 17.45 s | `frontend-vitest.log` |
| Frontend lint | `npx eslint .` | ❌ **17 errors, 24 warnings** (exit 1) | — | `frontend-checks.log` |
| Frontend production build | `npm run build` | ✅ **exit 0** (Next 16.3.3, PWA `sw.js`) | ~90 s | `frontend-build.log` |
| AI service tests | `pytest tests -q -m "not live and not live_full"` (uvicorn :8000, `INTERNAL_SECRET` pinned) | ✅ **603 passed / 58 deselected** | 2 m 13 s | `ai-tests-final.log` |
| AI live-provider suite | `pytest -m live_full` | ⛔ **NOT RUN — no real API key** | — | — |
| Frontend E2E (Playwright) | `npx playwright test` | ⛔ **NOT RUN this session** | — | — |
| Android build | `./gradlew assembleRelease` | ⛔ **NOT RUN this session** | — | — |
| PostgreSQL (real DB) migration run | — | ⛔ **NOT RUN — suite uses H2** | — | — |

**Totals executed: 1,034 automated tests passed (397 + 34 + 603), 0 failed. 1 lint gate failing.**

---

## 2. Backend — `./gradlew test`

```
BUILD SUCCESSFUL in 9m 7s
5 actionable tasks: 2 executed, 3 up-to-date
```
Aggregated from 59 JUnit XML reports in `backend/build/test-results/test/`:

| Metric | Value |
|---|---|
| Test classes | 59 |
| Tests | **397** |
| Failures | **0** |
| Errors | **0** |
| Skipped | **0** |

Notable classes exercised in this run include the new work on this branch: `DeadlineAuthorizationTest`, `GuardianDeadlineLinkLifecycleTest`, `DeadlineCountyMigrationTest`, `RegionalCountyVisibilityTest`, `JwtTokenTypeTest`, `GuardianSchoolDatesTest`, plus the pre-existing authorization/tenant-isolation suites.

### What this proves
- All 21 Flyway migrations apply cleanly in the test profile.
- Role-based authorization and cross-school isolation behave as asserted.
- Guardian→learner link lifecycle (create/unlink/deny) is covered.

### What this does **not** prove
- Behaviour against **PostgreSQL 16** (the suite runs on H2). The Postgres path was not re-verified today.
- The five-role journeys against a **live server** — no backend process was started this session.

### Backend build
`bootJar` succeeded; artefact produced under `backend/build/libs/`. The Dockerfile compiles with JDK 17 while this run used JDK 21 — the build is valid on both, but production remains pinned to 17.

---

## 3. Frontend

### 3.1 Typecheck — PASS
`npx tsc --noEmit` → exit **0**, no diagnostics.

### 3.2 Unit tests — PASS
```
Test Files  6 passed (6)
     Tests  34 passed (34)
  Duration  17.45s
```
Files: `navConfig.test.ts` (9), `LearningCompanion.test.tsx` (4), `Celebration.test.tsx` (9), plus three further suites.

> Note: a first run failed with `ERR_LOAD_URL` because I passed `--reporter=basic`, which Vitest 5 no longer ships. That was a **harness error on my side**, not a product failure; the corrected invocation above is the baseline.

### 3.3 Lint — FAIL (the one red gate)
`npx eslint .` → **17 errors, 24 warnings**. CI (`.github/workflows/ci.yml`) runs `npm run lint`, so **CI is red on this tree**.

| Rule | Count | Nature | Fix |
|---|---|---|---|
| `@typescript-eslint/no-explicit-any` | 10 | `any` in API/provider shapes | Type properly (preferred) or narrow to `unknown` |
| `react/no-unescaped-entities` | 5 | Raw `'` in JSX copy | Escape as `&apos;` |
| `react-hooks/set-state-in-effect` | 1 | `setState` synchronously in an effect | Guard or derive state |
| `@next/next/no-html-link-for-pages` | 1 | `<a href="/guardian/wards/">` | Use `<Link />` |
| `@typescript-eslint/no-unused-vars` (warnings) | 24 | Unused imports/vars | Cleanup |

Estimated effort: **~2 hours**, low risk. Caution: two `any` sites feed API response typing; widening to `unknown` can cascade — verify with `tsc` after each change.

### 3.4 Production build — PASS
```
✓ Compiled successfully in 39.2s
BUILD_EXIT=0
```
- Next.js **16.3.3** (webpack), PWA service worker emitted to `public/sw.js`, scope `/`.
- 61 `page.tsx` routes prerendered/registered (static ○ or dynamic ƒ), including all five role areas.
- Build was run with `NEXT_PUBLIC_API_URL=http://localhost:8085`, matching the CI value.

---

## 4. AI service

### 4.1 Correct execution method
The suite contains **live-server tests**. Running plain `pytest` without a server produced **31 failures / 572 passed** — every failure a connection/401 artefact. Executed as CI does (uvicorn on :8000, `INTERNAL_SECRET` exported), the result is:

```
603 passed, 58 deselected, 4 warnings in 133.79s
```

**Root cause of the earlier 401s (recorded so nobody repeats it):** `tests/test_edge_cases.py` resolves its key as `os.environ.get("INTERNAL_SECRET", "elekeza-test-internal-key-not-a-secret")`, and `conftest` loads `ai-elewa/.env`, so a server booted with a *different* secret yields valid 401s. Pinning `INTERNAL_SECRET` on both sides makes all 31 pass (`31 passed in 77.80s`).

> **Defect worth fixing (process, not product):** the suite is environment-coupled and reports 31 false failures unless the operator remembers to export the secret and boot the server. Recommend a `conftest` fixture that boots/points at the server, or marking the file `live` so it is excluded by default like the other live suites.

### 4.2 Service startup — PASS
```
INFO: Application startup complete.
INFO: Uvicorn running on http://127.0.0.1:8000
GET /health → {"status":"ok"} HTTP 200
```
Providers configured: `groq`, `openai`, `anthropic`, `google` (per-stage model map in `config.py`). Endpoints: `simplify`, `quiz`, `process`, `tutor`.

Observed in the startup log (non-blocking, but note it):
```
WARNING:langfuse:Authentication error: Langfuse client initialized without public_key. Client will be disabled.
INFO:langfuse_client:✅ Langfuse connected successfully
```
The two lines contradict each other — Langfuse reports success after disabling itself. Observability noise; fix the log assertion before trusting traces.

### 4.3 NOT RUN — real provider
All 603 tests use `AI_API_KEY=audit-dummy-not-real`. `test_full_pipeline.py` is marked `live_full` (54+ real LLM calls) and was **deselected**. **Therefore: "the AI tutor returns real, age-appropriate, Kiswahili/English responses from a live provider" is IMPLEMENTED BUT UNTESTED.** It needs a genuine key and ~10 minutes.

---

## 5. Cross-service (frontend → backend → AI) — NOT RUN

No backend process was started this session, so no end-to-end journey was executed. Prior evidence exists in the repo (`e2e-evidence/`, `docs/ELEKEZA_COMPLETION_AND_INTEGRATION_REGISTER.md`), but per this mandate it is **not** treated as current. To close Gate 4/5, run:

```bash
cd backend && ./gradlew bootRun --args='--spring.profiles.active=prod'   # needs .env contract
cd frontend && npx playwright test
```

---

## 6. Failed tests and their causes (complete register)

| # | Failure | Cause | Status |
|---|---|---|---|
| 1–31 | `test_edge_cases.py` (all) — HTTP 401 instead of expected 422 | Live-server suite run without uvicorn and/or without matching `INTERNAL_SECRET` | **Resolved** — 31/31 pass when run correctly |
| 32 | Vitest `ERR_LOAD_URL` | My `--reporter=basic` flag; reporter removed in Vitest 5 | **Resolved** — 34/34 pass |
| 33 | ESLint 17 errors | Real code quality issues on this tree | **OPEN** — blocks CI |
| 34 | `live_full` AI matrix | No real provider key available | **OPEN — BLOCKED BY CREDENTIALS** |
| 35 | Playwright E2E | Not attempted (no live stack this session) | **OPEN — NOT RUN** |

**Zero genuine product-logic test failures were observed.**

---

## 7. Reproduce this exact baseline

```bash
# Backend
cd backend && ./gradlew test --console=plain && ./gradlew bootJar

# Frontend
cd frontend && npx tsc --noEmit && npx vitest run && npm run build

# AI (must boot the server first — it is a live-server suite)
cd ai-elewa
AI_PROVIDER=groq AI_API_KEY=<key> INTERNAL_SECRET=elekeza-test-internal-key-not-a-secret \
  ./venv/Scripts/python.exe -m uvicorn main:app --port 8000 &
INTERNAL_SECRET=elekeza-test-internal-key-not-a-secret \
  ./venv/Scripts/python.exe -m pytest tests -q -m "not live and not live_full"
```
