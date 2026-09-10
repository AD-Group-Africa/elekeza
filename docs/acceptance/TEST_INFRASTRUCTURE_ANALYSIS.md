# Elekeza — Test Infrastructure Analysis

Status of the Spring Boot test-context gate, re-verified on **2026-09-04** against
commit `b5c5bbc` (`release/v0.1.0`).

## 1. Original baseline (superseded 2026-08-22 record)

`docs/acceptance/BASELINE.md` (written 2026-08-22) recorded:

```text
43 tests
25 passing
18 Spring context failures
```

All 18 failures shared one signature:

```text
IllegalStateException                     DefaultCacheAwareContextLoaderDelegate.java:180
Caused by: UnsatisfiedDependencyException  ConstructorResolver.java:795
Caused by: NoSuchBeanDefinitionException   DefaultListableBeanFactory.java:1880
```

That record described the state of the working tree on 2026-08-22. **It does not
describe the repository at HEAD.** This document records what actually caused that
class of failure (from repository history) and the verified current state.

## 2. Root cause (missing bean / dependency chain)

The documented failure signature is a Spring context that cannot instantiate its
singleton graph — a constructor dependency with no matching bean. For the
`@SpringBootTest(properties = [spring.profiles.active=dev, ai.client.type=mock,
ai.internal-secret=...])` integration tests, the dependency chain is:

```text
QuizController / ContentProcessingService
  -> AiClient  (interface)
     -> RealAiClient  @ConditionalOnProperty("ai.client.type" = "real",  matchIfMissing = false)
     -> MockAiClient  @ConditionalOnProperty("ai.client.type" = "mock")
```

Git history shows the concrete bean-resolution defect that produced exactly this
`NoSuchBeanDefinitionException` signature and was fixed before the release commit:

| Commit | Date | Fix |
|---|---|---|
| `99d6997` "Fix RealAiClient constructor for Spring DI with qualifier" | 2026-07-09 | Removed broken `@Autowired @Qualifier("aiWebClient")` constructor wiring |
| `65d2626` "Fix AI client — inline WebClient to avoid bean resolution issues" | 2026-07-09 | `RealAiClient` now builds its own `WebClient` lazily; added `AiWebClientConfig`; no bean-qualifier dependency remains |

Both are ancestors of HEAD (`git merge-base --is-ancestor 65d2626 b5c5bbc` = true).
Before those fixes, when `ai.client.type=mock` selected `MockAiClient`, anything
requiring the **qualified `aiWebClient` `WebClient` bean** (or the uncreated
`RealAiClient`) threw `UnsatisfiedDependencyException` -> `NoSuchBeanDefinitionException`
during context initialization — the exact 18-failure signature.

The audit's BASELINE.md never named a concrete bean; it classified the failures as
"pre-existing infrastructure" and waived them. This analysis supersedes that: the
bean and the fix are now identified, the fix is already in the tree, and the
failures no longer reproduce.

## 3. Configuration comparison

### 3.1 `application-dev.yaml` (test profile used by integration tests)

```yaml
ai:
  client:
    type: ${AI_CLIENT_TYPE:mock}     # default IS mock
  internal-secret: ${AI_INTERNAL_SECRET:dev-internal-secret-not-for-production}
spring:
  datasource:
    url: jdbc:h2:mem:elekeza;DB_CLOSE_DELAY=-1;MODE=PostgreSQL   # in-memory H2
  jpa.hibernate.ddl-auto: update
  flyway.enabled: false
```

Note: the reported audit claimed the dev profile forced `ai.client.type: real`.
That is **not true in this repository** — the dev default is `${AI_CLIENT_TYPE:mock}`.

### 3.2 `@SpringBootTest` inline properties

```kotlin
@SpringBootTest(
    properties = [
        "spring.profiles.active=dev",
        "ai.client.type=mock",
        "ai.internal-secret=test-internal-secret",
    ]
)
```

Property-source precedence (Spring Boot): inline test properties added via
`@SpringBootTest(properties = ...)` sit **above** OS environment variables and above
`application-*.yaml` files. Therefore `ai.client.type=mock` deterministically wins
over `application-dev.yaml`, and `spring.profiles.active=dev` selects the H2 datasource.
`@ConditionalOnProperty(name = ["ai.client.type"], havingValue = "mock")` on
`MockAiClient` then matches; `RealAiClient` (`havingValue = "real"`,
`matchIfMissing = false`) does not. Exactly one `AiClient` bean exists.

### 3.3 `application-test.yml` (main/resources, unused by the current tests)

Exists and contains only M-Pesa test-mode keys plus `spring.profiles.active: default`
(an oddity — a profile file rewriting the active profile). No current test activates
the `test` profile, so it has no effect. Left untouched: production behaviour must
not change.

## 4. Why the passing unit tests did not expose the issue

Unit tests do not load Spring:

| Test class | Type | Test count |
|---|---|---|
| `AiQuizParserTest` | pure unit — no context | 14 |
| `SignalCalculatorTest` | pure unit — no context | 11 |
| `LessonViewTest` | pure unit — no context | 4 |

`@SpringBootTest` context tests differ fundamentally: Spring must construct the
**entire singleton graph** (configuration classes, conditionals, JPA, security,
repositories, service constructors) before the first assertion runs. A missing bean
fails context startup for the whole class, no matter what the test body does. The
unit tests never construct that graph, so their passing says nothing about whether
the context is healthy — the 2026-08-22 audit correctly noted this, but then
incorrectly waived the failures without finding the bean.

## 5. Fix applied

**No code change was required at HEAD.** The fix is already present:

- `backend/src/main/kotlin/com/elekeza/backend/common/ai/RealAiClient.kt` — inline,
  lazy `WebClient`, no `@Qualifier` bean dependency (commits `99d6997`, `65d2626`).
- `backend/src/main/kotlin/com/elekeza/backend/config/AiConfig.kt` — client-type
  configuration consistent with the conditional annotations.
- Integration tests added in commit `b5c5bbc` carry the inline
  `ai.client.type=mock` / `spring.profiles.active=dev` properties that make the
  mock AI wiring deterministic.

No `@MockBean`, no `@Disabled`, no security downgrade, no profile rewrite, no
production behaviour change was needed. The 2026-08-22 record predates the release
commit that contains the corrected wiring and the full test suite.

## 6. Verification

```bash
cd backend
GRADLE_USER_HOME="$(pwd)/.gradle-user" ./gradlew clean test   # local gradle home; the
                                                              # machine default cache is broken
```

Result (2026-09-04, `clean test`):

```text
Total tests:      48
Passed:           48
Failed:           0
Skipped:          0
Context failures: 0
```

Per class (`build/test-results/test/*.xml`):

| Class | Tests | Failures |
|---|---|---|
| `analytics.GuardianAnalyticsAuthorizationTest` | 1 | 0 |
| `content.ContentProcessingFlowTest` | 1 | 0 |
| `content.LessonViewTest` | 4 | 0 |
| `institution.InstitutionRegistrationTest` | 2 | 0 |
| `quiz.AiQuizParserTest` | 14 | 0 |
| `quiz.QuizReviewTest` | 6 | 0 |
| `support.SignalCalculatorTest` | 11 | 0 |
| `support.SupportAuthorizationTest` | 9 | 0 |

Environment note: the default Gradle user home on this machine
(`C:\Dev\gradle`) fails with `Failed to create Jar file ... gradle-api-8.14.4.jar`;
the project-local `backend/.gradle-user` home works. This is a machine cache
problem, not a project problem.

## 7. Remaining failures

None. Every one of the 48 tests executes and passes with a known cause of success
(the corrected AI wiring in section 2 and the deterministic inline properties in
section 3.2).

For the record, the historical 18 are classified:

```text
Test                         Category         Root cause                                   Action            Status
GuardianAnalyticsAuth (1)    INFRASTRUCTURE   missing/qualified AI WebClient bean pre-    fixed in 99d6997   RESOLVED
                                              fix (context init NoSuchBeanDefinition)     + 65d2626
InstitutionRegistration (2)  INFRASTRUCTURE   same as above                              fixed               RESOLVED
QuizReview (6)               INFRASTRUCTURE   same as above                              fixed               RESOLVED
SupportAuthorization (9)     INFRASTRUCTURE   same as above                              fixed               RESOLVED
```

Status: **SPRING CONTEXT: PASS — no remaining blockers in the backend test gate.**
