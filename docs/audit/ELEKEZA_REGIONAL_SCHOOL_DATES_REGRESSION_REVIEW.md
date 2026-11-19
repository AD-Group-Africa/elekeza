# ELEKEZA — REGIONAL SCHOOL DATES: INDEPENDENT REGRESSION REVIEW

**Date:** 14 Nov 2026
**Branch:** `sprint-3-safe-config` @ `47d17f5`
**Mode:** **read-only.** Neither reviewed file was modified, staged, reverted or committed.
**Reviewers:** independent review requested after the change was flagged in the Wave 0 report.

---

## 0. Headline

**Classification: INTENTIONAL AND JUSTIFIED CHANGE** — with a **documentation defect** and one **genuine requirement ambiguity** for the product to settle.

It is *not* a confirmed regression. The flag that raised this review ("a behavioural narrowing of guardian visibility that must not travel inside a messaging change") was **half right**: it is a behavioural narrowing, but it is **not an isolated or uncoordinated edit**. It is one of four artifacts that all implement the same rule, including a staged test that already pins it. My earlier characterisation was formed from the guardian side alone and is corrected here.

What is genuinely wrong with the change set: **the comments and the sprint document still describe the opposite behaviour**, and the change bundles a security fix with a visibility change in a single uncommitted diff.

---

## 1. Repository state at review

| Item | Value |
|---|---|
| Branch | `sprint-3-safe-config` |
| HEAD | `47d17f510dd742919f956696506babe76cd5a561` |
| Both reviewed files | `M` (modified, **unstaged, uncommitted**) |
| Stashes | 4, intact |
| Origin of the change | **working tree only.** Last commits touching these files are `c56df6b` (HEAD~1) for both; no commit on this branch contains the REGIONAL removal. |
| Preservation | nothing reset, reverted, staged, committed or pushed |

---

## 2. The four artifacts that implement one rule

The removal is not a standalone edit. Four things changed together:

| # | Artifact | State | What it does |
|---|---|---|---|
| 1 | `calendar/DeadlineController.kt` | modified (+113) | Rewrites visibility to a `when(scope)` and maps **`REGIONAL -> false`**; restricts REGIONAL creation to `ADMIN` |
| 2 | `guardian/GuardianScheduleController.kt` | modified | Removes `REGIONAL` from the guardian deadline filter **so it matches #1**, and adds an active-link lifecycle filter |
| 3 | `guardian/GuardianSchoolDatesTest.kt` | modified | Inverts the assertion to assert regional absence |
| 4 | `calendar/DeadlineAuthorizationTest.kt` | **staged, new** | 11 tests covering the deadline endpoint, including two that create admin REGIONAL rows and assert they are not globally visible |

`GuardianScheduleController` states the coupling in its own comment: the schedule merges deadlines *"under the exact visibility rule of /api/deadlines"*. When #1 changed the rule, #2 had to change or the two endpoints would disagree. That is what a coordinated change looks like.

---

## 3. Original vs current behaviour

### 3.1 `/api/guardian/schedule` (the reviewed change)

**Original (HEAD):**
```kotlin
return deadlineRepo.findAll().filter { d ->
    d.scope == DeadlineScope.NATIONAL || d.scope == DeadlineScope.REGIONAL ||
        (d.institutionId != null && d.institutionId in linkedInstitutionIds) ||
        d.userId == user.id
}
```

**Current (working tree):**
```kotlin
return deadlineRepo.findAll().filter { d ->
    d.scope == DeadlineScope.NATIONAL ||
        (d.institutionId != null && d.institutionId in linkedInstitutionIds) ||
        d.userId == user.id
}
```

### 3.2 `/api/deadlines` (context — changed in the same working tree)

**Original (HEAD):** `scope == NATIONAL || scope == REGIONAL || institution match || own`.
**Current:** an explicit `when(scope)` where `NATIONAL -> true`, **`REGIONAL -> false`**, `INSTITUTION/CLASS ->` institution match, `INDIVIDUAL ->` own.

### 3.3 Bundled, unrelated-to-regional change in the same file

```kotlin
- val links = guardianLinkRepo.findAll().filter { it.guardianId == guardian.id }
+ val links = guardianLinkRepo.findAll().filter { it.guardianId == guardian.id && it.currentlyActive() }
```
This is a **security improvement**, not part of the regional question: revoked, expired and deactivated guardian links no longer surface a ward's pending lessons. `GuardianLink.currentlyActive()` = `isActive && revokedAt == null && (expiresAt == null || expiresAt.isAfter(now))`.

---

## 4. Root cause — why regional dates could not be scoped

Verified across every layer that would need a region key:

| Layer | Region key? | Evidence |
|---|---|---|
| `Deadline` entity | **No** | `DeadlineEntities.kt` fields: `id, institutionId, userId, title, deadlineType, scope, dueAt, description, createdBy, createdAt` |
| `deadlines` table (`V4`) | **No** | columns: `institution_id`, `user_id`, `title`, `deadline_type`, `scope`, `due_at`, `description`, `created_by`, `created_at` |
| `User` | **No** | no region/county field |
| `Institution` | Geographic strings only | `subCounty: String?`, `county: String?`, `type`, `plan`, `maxStudents`… |
| `country_configs` (`V15` §2) | Country-level only | `country_code`, `country_name`, `currency_code`, `timezone`, `default_language`, providers — **not** a region table |

So a `REGIONAL` row has **no column that identifies which region it belongs to**. `institutionId` is null for it, `userId` is null. The only "scope rule" that could apply is "everybody sees every region", which is exactly what the original filter did.

**Consequence:** before this change, a guardian in Nairobi saw a Kisumu county event, and a guardian with no relationship to the county saw it too. That is the defect being fixed. It is a correctness/relevance defect rather than a privacy breach — county school-event dates are public information — but it is a real one, and it is the same defect `DeadlineController` fixes in the same working tree.

---

## 5. Test analysis

### 5.1 What the original test protected

`schedule includes national regional and linked-institution school dates` — it proved that all three scopes reached a guardian: a NATIONAL exam, a REGIONAL science fair, and the guardian's own-institution sports day.

### 5.2 What the modified test protects

```kotlin
fun `schedule includes national and linked-institution school dates, regional excluded until region model exists`() {
    ...
    assertTrue(titles.contains("National Exam Day"))
    // Regional deadlines are not globally visible until a region model exists.
    assertTrue(!titles.contains("Regional Science Fair"),
        "regional deadline must not be globally visible, got $titles")
    assertTrue(titles.contains("Term Closing Day"))
```

**Assessment:** this is an **honest pin of a known limitation**, not an assertion weakened to hide a bug:
- the regional fixture is still created (`deadline("Regional Science Fair", …, REGIONAL, null, …)`), so the negative assertion is real rather than vacuous;
- the positive assertions for national and own-institution dates are unchanged, so the test still proves what the feature does do;
- the rationale is written into the test name and an inline comment, so the next reader cannot mistake it for intended permanence.

The one weakness: **it asserts absence, not a rule.** No test can currently prove "a guardian in the same county sees the regional date", because that behaviour does not exist. When county scoping lands, this assertion must be replaced rather than deleted.

### 5.3 Do other tests cover regional behaviour?

| Test | Tests | Covers regional? |
|---|---|---|
| `DeadlineAuthorizationTest` (staged, new) | 11 | **Yes** — teacher cannot create REGIONAL (403), admin can (200), and regional rows are not globally visible |
| `GuardianDeadlineLinkLifecycleTest` (staged, new) | 4 | Covers the **lifecycle** change: revoked / expired / deactivated links do not yield ward data |
| `GuardianSchoolDatesTest` | 3 | Regional absence; another school's dates invisible; past dates excluded + sorted |
| `GuardianLinkLifecycleTest` | 4 | Link lifecycle for other guardian surfaces |

The regional rule is therefore covered on **both** endpoints, and the bundled lifecycle fix has its own dedicated test file.

---

## 6. Expected product behaviour — where the ambiguity is

Three defensible positions, and the repository does not decide between them:

**(a) Regional dates should reach guardians, scoped by county.** `Institution.county` already exists and the guardian's institution is known through the active link. Scoping `REGIONAL` by `institution.county == learner's institution.county` is achievable **without a full region model**, which makes the test's justification ("until a region model exists") narrower than the truth. This is the position most consistent with the product intent — county science fairs and county athletics are exactly the school-calendar events a Kenyan parent expects to see.

**(b) Regional dates stay hidden until a proper region/ministry model exists.** The safest position, and the one implemented. Defensible because no ministry/region administrator role exists to own those rows (see the role matrix: `NATIONAL_ADMIN` is missing), so nobody is authorised to publish authoritative county calendars yet.

**(c) `REGIONAL` becomes explicitly platform-public by design** (an announcement, not a geography claim), and is renamed so the scope name stops implying a region it cannot enforce.

**Documentation currently supports (a) and contradicts the code.** `docs/SPRINT-3-COMPLETION-2026-10-23.md` line 18 states: *"NATIONAL/REGIONAL are public"* — the pre-change rule. Under review, that is a stale spec, not a requirement.

**Recommendation:** adopt **(b) now** (it is what the code does and is the safe default), record it as an explicit product decision, and schedule **(a)** for the wave that introduces the national/regional administrator role. Do not leave (a) implied by documentation.

---

## 7. Impact assessment

| Dimension | Impact |
|---|---|
| **REGIONAL schools** | Regional dates no longer appear in guardian schedules. Intended. |
| **National schools** | Unaffected — `NATIONAL` remains visible. |
| **Other school categories** | Unaffected — `INSTITUTION` still requires an active link to a learner of that institution (covered by the existing "another school's dates are not visible" test). |
| **Guardians with children in different institutions** | Unaffected by the regional change. The `linkedInstitutionIds` set is built from **all** active links, so a guardian with two children in two schools sees both schools' institution-scoped dates. Not separately tested — see §9. |
| **Date filtering** | Unchanged: upcoming-only (`>= LocalDate.now()`), sorted by date. |
| **Timezone** | **Pre-existing weakness, not introduced here:** "today" is computed with `ZoneId.systemDefault()` on the server, so a UTC host is 3 hours behind Kenya and can misclassify a same-day event. `country_configs.timezone = 'Africa/Nairobi'` exists but is not used for this filter. P3. |
| **Demo/seed data** | **No loss.** No `REGIONAL` deadline rows are seeded in any migration, so no demo guardian loses a visible date. Only an `ADMIN` (the only role that may create REGIONAL) can produce one. |
| **Frontend** | Single consumer, `/guardian/schedule` (`page.tsx:19`). No frontend code assumes regional dates exist. |
| **Regression in the security dimension** | **None — this is an improvement.** The active-link filter closes a real gap: a revoked or expired guardian link could previously still surface a ward's pending lessons. |

---

## 8. Findings

| ID | Finding | Severity | Class |
|---|---|---|---|
| **REG-01** | REGIONAL deadlines have no scoping key, so including them showed every county's dates to every guardian. Removal is correct. | — | **Intentional and justified** |
| **REG-02** | `GuardianScheduleController` contains **two stale comments** still claiming "NATIONAL, REGIONAL are public" (the block comment above the merge loop and the KDoc on `visibleDeadlines`). Code and comment now contradict. | **Low** | **Defect** |
| **REG-03** | `docs/SPRINT-3-COMPLETION-2026-10-23.md` still documents the pre-change rule as the design. | **Low** | **Defect** |
| **REG-04** | The "until a region model exists" justification understates available data — `Institution.county` would support county scoping without a region table. | Medium | **Requirement ambiguity** |
| **REG-05** | A security fix (active-link lifecycle) and a visibility change (REGIONAL) are bundled in one uncommitted diff on one file. | **Low** | **Process** |
| **REG-06** | Timezone: "today" uses `ZoneId.systemDefault()` rather than the configured country timezone. Pre-existing, untouched by this change. | P3 | **Pre-existing defect** |
| **REG-07** | Multiple-children-across-institutions is not covered by a dedicated test. | Low | **Coverage gap** |

**No defect found in the logic itself.** The filter is correct, matches the other endpoint, and is tested on both surfaces.

---

## 9. Regression test results (executed this session)

```
cd backend
./gradlew test --console=plain \
  --tests com.elekeza.backend.guardian.GuardianSchoolDatesTest \
  --tests com.elekeza.backend.guardian.GuardianDeadlineLinkLifecycleTest \
  --tests com.elekeza.backend.calendar.DeadlineAuthorizationTest \
  --tests com.elekeza.backend.guardian.GuardianLinkLifecycleTest
```

| Test class | Tests | Failures | Errors |
|---|---|---|---|
| `DeadlineAuthorizationTest` | 11 | 0 | 0 |
| `GuardianDeadlineLinkLifecycleTest` | 4 | 0 | 0 |
| `GuardianLinkLifecycleTest` | 4 | 0 | 0 |
| `GuardianSchoolDatesTest` | 3 | 0 | 0 |
| **Total** | **22** | **0** | **0** |

`BUILD SUCCESSFUL in 1m 6s`, **exit code 0**.

Full-suite context from the same session: **368 tests / 56 classes / 0 failures** at HEAD + Wave 0 + this working tree.

**Coverage scenarios requested by the brief:**

| Scenario | Covered? | Where |
|---|---|---|
| REGIONAL school dates | Yes (absence rule) | `GuardianSchoolDatesTest` test 1; `DeadlineAuthorizationTest` |
| National school dates | Yes | `GuardianSchoolDatesTest` test 1 |
| Mixed calendar scenario | Yes | test 1 mixes NATIONAL + REGIONAL + INSTITUTION + personal in one response |
| Guardian access permissions | Yes | `@PreAuthorize('GUARDIAN','ADMIN')`; `GuardianRelationshipTest`, `GuardianLinkLifecycleTest` |
| Date boundaries | Partially | past dates excluded (test 3). No test for "due today" vs "due tomorrow" at the timezone edge |
| Empty calendars | **No** | No test asserts the empty-list response renders/serialises correctly |
| Multiple linked children (different institutions) | **No** | `linkedInstitutionIds` is a set built from all active links, but only single-institution is asserted |

---

## 10. Recommended correction

**Do not revert the logic.** Reverting would restore the cross-region leak. Four small corrections, in order:

1. **Fix the stale comments (REG-02).** In `GuardianScheduleController`, the block comment above the merge loop and the `visibleDeadlines` KDoc must drop "REGIONAL", and state why: *"REGIONAL deadlines are intentionally excluded: the model has no region key, so including them would expose every county's dates to every guardian. See the role matrix — no national/regional administrator exists yet."*
2. **Correct the sprint document (REG-03).** Amend `SPRINT-3-COMPLETION-2026-10-23.md` line 18 to record the revised rule, so the written design and the code stop disagreeing.
3. **Record the product decision (REG-04).** Choose (a), (b) or (c) in §6. If (b), say so explicitly and name the wave that revisits it; if (a), implement county scoping via `Institution.county`.
4. **Split the commit (REG-05).** Two path-scoped commits: one for the active-link lifecycle security fix (with `GuardianDeadlineLinkLifecycleTest`), one for the REGIONAL visibility rule (with `DeadlineController`, `DeadlineAuthorizationTest`, `GuardianSchoolDatesTest`). They are independently reviewable and independently revertable.

Optional, low cost (REG-07): add a test with two children in two institutions and one shared `REGIONAL` row, asserting both institutions' dates appear and the regional row does not. Add an empty-calendar test.

---

## 11. Evidence index

| Claim | File / command |
|---|---|
| Original filter included REGIONAL | `git show HEAD:…/GuardianScheduleController.kt`; diff in §3.1 |
| Deadline endpoint changed in the same tree | `git diff -- …/DeadlineController.kt` (`REGIONAL -> false`) |
| No region key in the model | `DeadlineEntities.kt`; `V4__support_interventions_deadlines.sql` |
| No region table; country-level only | `V15__devices_regions_billing.sql` §2 `country_configs` |
| Institution carries county only | `institution/Institution.kt` |
| Staged test pins the same rule | `DeadlineAuthorizationTest.kt:95,100,165-180` |
| Lifecycle change is tested | `GuardianDeadlineLinkLifecycleTest.kt:62,74,86,118` |
| No seeded REGIONAL rows | `grep -rn REGIONAL db/migration/*.sql` → schema comments only |
| Stale doc | `docs/SPRINT-3-COMPLETION-2026-10-23.md:18` |
| Stale comments | `GuardianScheduleController.kt` ~line 63 and the `visibleDeadlines` KDoc |
| Test results | command in §9, exit 0, 22/22 |

---

## 12. Authorization (as originally recorded)

This was a read-only review. **Neither file has been modified.** The proposed corrections in §10 — comment fixes, document amendment, commit split, and any county-scoping implementation — require separate approval and are explicitly **excluded from any Wave 0 commit**.

---

## 13. APPROVED DECISION AND IMPLEMENTATION (14 Nov 2026, later same day)

Option **(a) from §6 was approved**: regional dates are scoped by county. This section records the implementation. It supersedes the "intentional exclusion" state described in §0–§12.

### 13.1 Data-model decision

| Option | Verdict |
|---|---|
| Resolve county through an institution relationship | **Rejected** — a REGIONAL date is cross-institution by definition; attaching it to one institution would misrepresent it and would still leave the "which county?" question unanswered |
| Free-text `county` on the deadline compared to `institutions.county` | **Rejected** — `"Nairobi"`, `"NAIROBI "`, `"Nairobi County"` and `"Taita-Taveta"` vs `"Taita Taveta"` would silently fail to match |
| **Nullable normalised `county_code` on `deadlines`** | **Adopted** — one explicit, comparable key, backward compatible, no invented taxonomy |

`CountyKey.normalize` reduces a county name to a stable key: lowercase, apostrophes removed, non-alphanumerics collapsed to spaces, a trailing `" county"` stripped. `" Murang'a "` → `muranga`; `"Taita-Taveta"` → `taita taveta`. It is a *consistency* guarantee, not a validation list — a county name the system has never seen is still a usable key, it simply matches nobody.

### 13.2 Migration (V20)

`V20__deadline_county_scope.sql` adds `deadlines.county_code VARCHAR(64) NULL` plus `idx_deadline_county`.

- **No backfill.** Existing REGIONAL rows keep `NULL` and are therefore invisible. Assigning them a county from the creator, the institution or the operator's location would invent a fact about a school calendar.
- V20 also documents the maintenance query an administrator should run to find and correct those rows.
- V2/V4/V16 are **not** touched, so no Flyway checksum changes and no `flyway repair` is required.

### 13.3 Shared rule

`DeadlineVisibility` is now the single implementation, injected into both `DeadlineController` and `GuardianScheduleController`. Scoping happens in repository queries (`findByScopeOrderByDueAtAsc`, `findByScopeAndCountyCodeInOrderByDueAtAsc`, `findByScopeInAndInstitutionIdInOrderByDueAtAsc`, `findByUserIdOrderByDueAtAsc`) rather than by loading every row and filtering in memory.

Entitlement is derived from the viewer, never from request input: a guardian's institutions come from **currently active** guardian links only; staff and learners use their own institution.

### 13.4 Visibility matrix — before and after

| Scope | Before V20 (HEAD) | After V20 |
|---|---|---|
| `NATIONAL` | every authenticated user | every authenticated user (unchanged) |
| `REGIONAL` | HEAD: served to nobody (temporary fail-closed). Uncommitted working tree: `/api/guardian/schedule` served **every** regional to **every** guardian while `/api/deadlines` served none — the inconsistency of REG-01 | only when `county_code` matches a county of an entitled institution; **NULL county = nobody**; both endpoints identical |
| `INSTITUTION` / `CLASS` | own institution / any actively linked ward's institution | unchanged |
| `INDIVIDUAL` | targeted user only | unchanged |
| `ADMIN` | everything | everything (unchanged) |
| Revoked / expired / inactive guardian link | ward's **institution** dates already required an active link; the ward-lesson section did not | no ward-linked dates at all (lifecycle fix retained) |

### 13.5 Findings from §8 — status

| ID | Status |
|---|---|
| REG-01 (regional unscopable) | **Resolved** — county key supplied |
| REG-02 (stale comments) | **Fixed** — both comments now describe county scoping; the rule is no longer described as "public" |
| REG-03 (stale sprint doc) | **Fixed** — `SPRINT-3-COMPLETION-2026-10-23.md` marks the old rule superseded |
| REG-04 (county scoping achievable without a region table) | **Adopted as the implementation** |
| REG-05 (bundled security + visibility change) | **Still open** — remains two concerns in one working-tree diff; split at commit time |
| REG-06 (timezone) | **Still open**, pre-existing |
| REG-07 (multi-institution coverage) | **Partially closed** — `RegionalCountyVisibilityTest` now covers a guardian with wards in two counties |

### 13.6 Evidence

`backend/src/test/kotlin/com/elekeza/backend/guardian/RegionalCountyVisibilityTest.kt` — 16 tests covering national across counties, matching county, non-matching county, two-county guardian, institution isolation, NULL deadline county, NULL institution county, revoked link, expired link, endpoint authorization (401/403), date boundaries, both endpoints agreeing, county normalisation on create, county rejected on non-regional scope, blank county rejected.

`backend/src/test/kotlin/com/elekeza/backend/calendar/DeadlineCountyMigrationTest.kt` — executes V20 against H2 in PostgreSQL mode (the only engine available here) and asserts the column, its nullability for existing rows, and the index.

Results: `./gradlew test` → **385 tests / 58 classes / 0 failures / 0 errors / 0 skipped, exit 0** (3m 3s), up from the 368-test baseline. Raw output: `docs/audit/evidence-county-scope-backend-test.log`.

### 13.7 Known limitations

1. **PostgreSQL 16 is not verified.** V20 runs on H2/PG-mode only; no Postgres server exists in this environment. Run it through `scripts/staging-gate.sh` before production.
2. **`"Nairobi County"` vs `"Nairobi"` is handled; `"Nairobi Central"` vs `"Nairobi"` is not.** The key is exact-after-normalisation. Institutions should store the bare county name.
3. **The 47-county reference list is not enforced.** An operator can mistype a county and create a date nobody sees; the WARN log on uncoded creation and the V20 maintenance query are the only guard rails today.
4. **Existing regional rows are invisible until corrected** — by design, and they are enumerated by the query in V20.
5. **Timezone filtering is unchanged** (`ZoneId.systemDefault()`); REG-06 remains open.
