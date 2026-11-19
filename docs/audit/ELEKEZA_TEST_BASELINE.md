# ELEKEZA TEST BASELINE — Phase 4.2

**Date:** 5 Nov 2026 · **Branch:** `sprint-3-safe-config` @ `c56df6b` · Working tree: uncommitted deadline-security changes present (unchanged during testing)

Historical claims from `ELEKEZA_README.md` were **re-measured, not assumed**.

| Suite | Command | Result | Verdict |
|---|---|---|---|
| Backend | `cd backend && GRADLE_USER_HOME=backend/.gradle-user ./gradlew test --rerun` | **BUILD SUCCESSFUL in 3m51s — 54 suites, 357 tests, 0 failures, 0 errors, 0 skipped** (JUnit XML aggregate) | ✅ Historical "357" verified exactly. Includes the staged `DeadlineAuthorizationTest` + `GuardianDeadlineLinkLifecycleTest` |
| Frontend typecheck | `npx tsc --noEmit` | exit 0, clean | ✅ |
| Frontend units | `npx vitest run` | **4 files, 20/20 passed** (7.1s) | ✅ Historical "20" verified exactly (was 17 at Sep README — has since grown) |
| ai-elewa | `AI_TEST_BASE_URL=http://localhost:8001 .venv/Scripts/python -m pytest tests -q` (service started without secret override) | **606 passed, 55 deselected, 0 failed** (93 s), incl. live Groq smoke | ✅ (see ELEKEZA_AI_TEST_FAILURE_ANALYSIS.md; default command without a running service yields false failures — port 8000 is owned by PCEA Works) |
| Production build | `npm run build` | not yet re-run this session (`.next` was intentionally removed during storage cleanup; regenerable) | pending |
| Playwright E2E | `npx playwright test` | not yet run this session | pending (needs services) |

**Notes**
- First `./gradlew test` attempt returned `UP-TO-DATE` cache hit — not accepted as evidence; forced with `--rerun` for the numbers above.
- The new staged tests pass as part of the run: deadline INDIVIDUAL/INSTITUTION/CLASS/NATIONAL visibility policy and server-side creation authorization verified green together with the 355 existing tests.
- Backend test file count is 53; several suites parametrize to more tests, hence 54 XML suites / 357 tests.
- JDK 21 compiling Java-17 targets — no test impact observed (0 errors).
