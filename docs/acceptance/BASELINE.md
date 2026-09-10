# Elekeza Production Acceptance — GATE 1: TEST BASELINE

> **REVISED 2026-09-04** — the original baseline below (dated 2026-08-22) recorded
> 43 tests / 25 passing / 18 Spring context failures and classified all 18 as
> "pre-existing infrastructure". That record described an earlier working-tree
> state. The repository at HEAD (commit `b5c5bbc`, `release/v0.1.0`) contains the
> AI bean-resolution fix and the complete test suite. Re-verification on
> 2026-09-04 shows **48/48 tests pass, 0 context failures**. See
> `TEST_INFRASTRUCTURE_ANALYSIS.md` for the root-cause chain and evidence.

---

## Baseline Verification Date

**2026-09-04** (revised) — original: 2026-08-22 (superseded, see note above)

## Commands Run

```bash
cd backend
GRADLE_USER_HOME="$(pwd)/.gradle-user" ./gradlew clean test
```

(Environment note: the machine-default Gradle cache `C:\Dev\gradle` fails with
`Failed to create Jar file gradle-api-8.14.4.jar`; the project-local
`backend/.gradle-user` home is used instead. This is a machine cache issue.)

## Result — 2026-09-04 (HEAD `b5c5bbc`)

```text
Total tests:      48
Passed:           48
Failed:            0
Skipped:           0
Context failures:  0
```

### Per class

| Test Class | # Tests | Result | Type |
|---|---|---|---|
| `AiQuizParserTest` | 14 | 100% PASS | Pure unit test — no `@SpringBootTest` |
| `SignalCalculatorTest` | 11 | 100% PASS | Pure unit test — no `@SpringBootTest` |
| `LessonViewTest` | 4 | 100% PASS | Pure unit test — no `@SpringBootTest` |
| `ContentProcessingFlowTest` | 1 | 100% PASS | `@SpringBootTest` context test |
| `GuardianAnalyticsAuthorizationTest` | 1 | 100% PASS | `@SpringBootTest` context test |
| `InstitutionRegistrationTest` | 2 | 100% PASS | `@SpringBootTest` context test |
| `QuizReviewTest` | 6 | 100% PASS | `@SpringBootTest` context test |
| `SupportAuthorizationTest` | 9 | 100% PASS | `@SpringBootTest` context test |
| **Total** | **48** | **100% PASS** | 5 context tests load the full Spring graph |

Every `@SpringBootTest` class loads the complete Spring context
(`spring.profiles.active=dev` → H2; `ai.client.type=mock` → `MockAiClient`), so the
context is exercised and healthy, not assumed healthy.

## Historical failure classification (2026-08-22 record — RESOLVED)

The 18 recorded failures (`GuardianAnalyticsAuthorizationTest` 1,
`InstitutionRegistrationTest` 2, `QuizReviewTest` 6, `SupportAuthorizationTest` 9)
were infrastructure failures whose root cause is now identified from repository
history: the AI client wiring previously depended on a qualified `WebClient` bean
that did not resolve (`NoSuchBeanDefinitionException` at context init in every
`@SpringBootTest` class). Commits `99d6997` and `65d2626` (2026-07-09) removed that
dependency (`RealAiClient` now builds its own `WebClient` lazily), and commit
`b5c5bbc` added the full suite with deterministic mock-AI test properties. None of
the 18 reproduced on 2026-09-04.

No tests were skipped, disabled, or mocked around to achieve this result; no
`@MockBean`, no security downgrade, no production behaviour change.

## Baseline Assessment

**STATUS: CLEAR — backend test gate passes at HEAD.**

- Verified 2026-09-04: 48 tests, 0 failures, 0 skipped, 0 context failures
  (evidence: `build/test-results/test/TEST-*.xml` after `clean test`).
- 5 of 8 test classes are full `@SpringBootTest` context tests (19 tests) and pass.
- Refer to `TEST_INFRASTRUCTURE_ANALYSIS.md` (root cause + fix history) and
  `DATABASE_INTEGRITY.md` (entity/migration integrity + backup/restore gate).
- CI parity note: `.gitlab-ci.yml` runs the same suite with PostgreSQL service env
  vars; this machine has no CI Postgres, and the tests target the dev profile's H2
  datasource. If the CI environment surfaces datasource conflicts, address them in
  CI configuration — none are present in the committed test code.
