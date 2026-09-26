# ELEKEZA — E2E & FULL TEST REPORT

**Run date:** 23 September 2026 (final verification run; earlier same-release runs on 22 September)
**Branch:** `release/v0.1.0` · HEAD `8aae18b` (plus this session's uncommitted fixes)
**Environment:** Windows 11, Git Bash; backend boot JAR (dev profile, H2 seed per run) + Next.js dev server, launched by Playwright itself.

## Summary counts (actual runs, no estimates)

```text
Backend (Gradle, 37 suites):  Passed: 269   Failed: 0   Skipped: 0   (re-run 23 Sep after onboarding wiring)
Frontend TypeScript:          clean (exit 0)                                   (re-run 23 Sep)
Frontend Vitest:              Passed: 17    Failed: 0   Skipped: 0             (re-run 23 Sep)
Production build:             green (64 routes, .next/BUILD_ID, 22 Sep)
E2E (Playwright, real stack): Passed: 31    Failed: 0   Skipped: 0   (10.2 min, 23 Sep)
AI service (credential-free): Passed: 453   Failed: 0   Deselected: 55 (live-marked)
Fresh PostgreSQL gate:        15/15 migrations, Hibernate validate OK, health 200 (22 Sep)
Docker Compose:               config valid (6 services, healthchecks)
Backup/restore drill:         PASSED (2026-09-19 drill, evidence in docs/reliability/)
```

> **23 September note:** a backend re-run initially failed twice with
> `IOException: There is not enough space on the disk` (C: at 100%) and a
> `GradleWorkerMain` executor crash from two accidental concurrent Gradle
> launches — both environmental, zero test failures in JUnit XML. After
> stopping daemons and clearing regenerable build artifacts (~690 MB of
> `.next` directories), the clean re-run passed **269/269** and `bootJar`
> succeeded. E2E was then re-run on ports 8097/3100 (8090 was occupied by an
> unrelated project on this machine) — **31/31 passed in 10.2m**, including
> both previously-flaky crawls (teacher crawl 1.8m) and the full a11y gate.

## E2E results per test (final run)

| # | Test | Result | Notes |
|---|---|---|---|
| 1 | a11y: login page (WCAG 2.1 AA) | ok | axe-core, 11.7s |
| 2 | a11y: learner home | ok | |
| 3 | a11y: progress page (mastery) | ok | |
| 4 | a11y: learner preferences | ok | |
| 5 | a11y: exams page | ok | |
| 6 | a11y: teacher students page | ok | |
| 7 | a11y: guardian dashboard | ok | |
| 8–11 | attendance-finance: teacher register save/counts, learner history, guardian fees+balances, school onboarding + finance zeros | ok ×4 | |
| 12–14 | exam: journey (timer/autosave/submit/score), immutability (409 on replay), maxAttempts honored | ok ×3 | |
| 15 | learner login → learning home | ok | 5.5s (was failing in the contaminated run) |
| 16 | wrong password shows accessible error | ok | |
| 17 | forgot-password never reveals account existence | ok | |
| 18 | logout returns to login, clears session | ok | |
| 19 | learner journey: home → lesson → read → quiz → score → progress | ok | 30.8s |
| 20 | learner preferences save | ok | |
| 21 | guardian sees ward, opens ward detail | ok | |
| 22 | guardian cannot open another guardian's ward | ok | |
| 23 | teacher sees learners, support panel w/ mastery evidence | ok | |
| 24 | teacher progress dashboard | ok | |
| 25 | authenticated shell: skip link + main landmark | ok | |
| 26 | learner home no console errors | ok | |
| 27 | offline: queue answers, saved-offline state, reconnect & sync | ok | |
| 28 | offline quiz submit stays honest (no fake score) | ok | |
| 29 | learner route crawl | ok | |
| 30 | teacher route crawl | ok | **1.8m in 23 Sep run** (was timing out at 240s pre-fix) |
| 31 | guardian route crawl | ok | |

**RBAC/security journeys covered by the suite:** guardian cross-ward 404
(#22), wrong-password failure (#16), forgot-password anti-enumeration (#17),
exam immutability (#13), unauthenticated route handling via route crawls.
Broader RBAC/tenant matrices (learner/teacher/admin/guardian across two
institutions, fees, payments, receipts, submissions, grading) are covered by
the 269 backend tests, including cross-tenant 404 assertions.

## Session 2 additions (22 Sep 2026, later)

| # | Symptom | Root cause | Fix | Verification |
|---|---|---|---|---|
| 4 | Self-registered learner: every onboarding call → 404 | `/api/auth/register` created no `learners` row | `OnboardingService.findLearnerByEmail` get-or-create | live register→profile→placement→guardian→complete all 200; `SelfRegisteredOnboardingApiTest` 3/3 |
| 5 | Onboarding calls → 500 (learners.email overflow) | `Authentication.name` = `User.toString()`, not the email | controller reads `user.email` off the principal | same suite + live chain |
| 6 | Invalid placement score → 500 | no handler for `IllegalArgumentException`/`IllegalStateException` | GlobalExceptionHandler → 400 with safe message | same suite |
| 7 | Teacher route crawl budget consumed by unbounded `networkidle` | per-link waits had no timeout | bounded `crawlLink` helper (45s goto / 15s waits) + Playwright retry 1 (CI 2) | crawl suites green in final run |

Google OAuth disposition: verified NOT IMPLEMENTED server-side (no endpoint,
no starter dependency, no client-id consumer); dead button/stub/config
(incl. a baked-in real client id) removed. Not a defect — a dead surface.

## Defects found & fixed this session

| # | Symptom | Root cause | Fix | Verification |
|---|---|---|---|---|
| 1 | Floating "N" badge bottom-left on every dev page (flagged in manual inspection) | Next.js dev-tools indicator enabled by default | `devIndicators: false` in `frontend/next.config.ts` (typed `false as const` for Next 16 TS) | typecheck clean; badge gone; prod builds never rendered it |
| 2 | Teacher route-crawl E2E timeout (240s), `net::ERR_ABORTED` mid-crawl; reproduced twice | recharts default entry animations keep the teacher dashboard's chart container in a continuous animation loop on `next dev`, starving the crawl's `networkidle` wait | `isAnimationActive={false}` on `<Bar>`/`<Pie>` in `teacher/page.tsx` and `teacher/progress/page.tsx` (also a visual-noise reduction, consistent with calm-mode principle) | isolated rerun: passed in 2.0m; full suite: 31/31 in 12.8m |
| 3 | (Earlier same-day run) all logins timing out with backend `NoClassDefFoundError: ch/qos/logback/classic/spi/ThrowableProxy` in a detached E2E session | contaminated JVM/environment state of that specific detached process — verified **not** a product defect: fresh JAR boots clean (19.4s), health 200, CSRF+login 200 with zero errors, and 36/36 suites + 31/31 E2E green afterwards | none required (environmental); documented to prevent mis-diagnosis | smoke test + full green runs |

## What the AI-service job proves

The `ai-elewa` CI job boots uvicorn with dummy provider env and runs
`pytest -m "not live"`: **453 passed / 55 deselected**. The 55 deselected are
`live`-marked pipeline tests that require a real provider key — they are the
only AI tests that cannot run without credentials.

## Regression evidence trail

* `backend/build/test-results/test/TEST-*.xml` (37 files, 23 Sep re-run)
* `E2E final run 23 Sep: "31 passed (10.2m)" (Playwright list reporter, ports 8097/3100)`
* `frontend/.next/BUILD_ID` (production build 22 Sep)
* `scripts/staging-gate.sh` output: "Flyway: 15/15 migrations applied;
  Hibernate validate OK; health 200" (fresh-PG gate, run 2026-09-22)
