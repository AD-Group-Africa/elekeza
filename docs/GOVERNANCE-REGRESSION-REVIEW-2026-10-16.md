# Elekeza — Governance Regression & Verification Review (2026-10-16)

**Scope:** specification correction, repository verification, regression testing,
documentation. **No application code, migration, or role was changed.**

Companion documents:
[GOVERNANCE-HIERARCHY-SPEC.md](GOVERNANCE-HIERARCHY-SPEC.md) (v2) ·
[AUDIT addendum L](AUDIT_2026-10-15_FINAL_PILOT_READINESS.md).

---

## 1. Repository state

- **Branch:** `feat/elekeza-pilot-completion`
- **Starting commit:** `1299c5b` — matches the expected baseline reference.
- **Ending commit:** `1299c5b` — **no commit was made** (changes left uncommitted
  by design).
- **Initial working tree (preserved, not created by this review):**
  ```
   M docs/AUDIT_2026-10-15_FINAL_PILOT_READINESS.md
   M frontend/src/app/super-admin/page.tsx
  ?? backend/src/test/kotlin/com/elekeza/backend/governance/
  ?? docs/GOVERNANCE-HIERARCHY-SPEC.md
  ```
  These are the 2026-10-16 60-minute-sprint deliverables. They were **preserved
  and built upon**, never reset, discarded, or overwritten.

## 2. Files changed by this review

| Path | Change | Purpose |
|---|---|---|
| `docs/GOVERNANCE-HIERARCHY-SPEC.md` | **rewritten (v1 → v2)** | Separate revocation from suspension (§5); harden aggregate-privacy claims (§6); standardise `EDUCATION_OFFICIAL` (§2); add jurisdiction validity/integrity (§7); evidence-label provisioning & audit (§8). |
| `docs/AUDIT_2026-10-15_FINAL_PILOT_READINESS.md` | **addendum section L added** | Dated governance review addendum; corrects K.1/K.4 claims; no historical finding rewritten. |
| `docs/GOVERNANCE-REGRESSION-REVIEW-2026-10-16.md` | **new (this file)** | Branch/commit, verification evidence, commands, defects, unverified assumptions, confirmation of no implementation. |

No file under `backend/`, `frontend/`, or `db/migration/` was modified by this
review.

## 3. Security controls inspected (source, not report)

| # | Control | Source inspected | Finding |
|---|---|---|---|
| 1 | Suspended account's existing session rejected | `backend/.../auth/JwtAuthFilter.kt` — `if (user != null && user.active)` before setting authentication | **VERIFIED** — inactive principal never authenticated. |
| 2 | Suspended account's refresh rejected | `backend/.../auth/AuthController.kt` `refresh()` — `if (!user.active)` revokes token, clears cookie, 401 | **VERIFIED**. |
| 3 | Reactivation restores access | same filter/controller; `StaffManagementService.setActive` | **VERIFIED** (same cookie works again, test T10). |
| 4 | SCHOOL_ADMIN analytics institution-scoped | `backend/.../analytics/AnalyticsController.kt` `adminAnalytics()` — `platformWide = user.role == ADMIN`; else `institutionId == scope` | **VERIFIED**. |
| 5 | ADMIN analytics platform-wide | same method — role-keyed, not null-institution-keyed | **VERIFIED**. |
| 6 | `/api/analytics/admin/overview` rejects unauth/unauthorised | `SecurityConfig` URL rule + `@PreAuthorize("hasRole('ADMIN')")` + structured 401/403 handlers | **VERIFIED**. |
| 7 | `/super-admin` guard blocks unauthorised requests | `frontend/src/app/super-admin/page.tsx` — early return unless `role === 'ADMIN'`; effect guarded | **VERIFIED** as defence in depth. |
| 8 | Server-side authorisation is authoritative | `SecurityConfig` + method security + `JwtAuthFilter` | **VERIFIED** — frontend state cannot bypass. |
| 9 | Regression tests exercise real HTTP endpoints/boundaries | `backend/.../governance/GovernanceRegressionTest.kt` — real cookie login, CSRF dance, real staff API, structured body assertions | **VERIFIED** (3 tests, see §4). |

Additional inspected (not claimed as tests): `StaffManagementService`
(ADMIN untouchable via API), `AuditLogService` (async + 90-day purge),
`AppConfig` (`@EnableAsync`, `@EnableScheduling`), `V1` geography/audit DDL,
`V2` seed, `V16`, `ShowcaseDataInitializer`.

## 4. Commands executed and exact outcomes

| Command | Execution | Result |
|---|---|---|
| `cd backend && ./gradlew test` (first run) | Gradle reported `:test UP-TO-DATE` (cached — **not** a real execution) | `BUILD SUCCESSFUL`, exit 0 — but **not** counted as evidence |
| `cd backend && ./gradlew cleanTest test` (forced rerun) | `> Task :test` **executed** | **BUILD SUCCESSFUL in 2m 49s, exit 0** |
| Backend test-result aggregation | 42 XML reports parsed | **tests=297, failures=0, errors=0, skipped=0** |
| `GovernanceRegressionTest` report | inspected | **tests=3, failures=0, errors=0**, timestamps 2026-10-16T18:26Z |
| `cd frontend && npx tsc --noEmit` | executed | **exit 0**, no diagnostics |
| `cd frontend && npx vitest run` | executed | **Test Files 4 passed, Tests 20 passed (20), exit 0** |

> The first `gradlew test` run was a cache hit (`UP-TO-DATE`). It is recorded for
> honesty and deliberately **excluded** from the pass evidence; the forced
> `cleanTest test` rerun is the basis for the numbers above.

## 5. Outstanding defects & unverified assumptions

### 5.1 Real, confirmed (documentation-level, no code defect found this review)
- **P3 cosmetic (already noted):** `/super-admin` still shows a hard-coded
  "Pending Approvals: 0" card — no data source. Cosmetic only.
- **Analytics scale (pre-existing):** scoped `adminAnalytics` does full-table
  `findAll()` + link scans; flagged for scale, not measured beyond pilot size.

### 5.2 Verified claims that CONTRADICT earlier draft language (corrected)
- "ADMIN's actions are **fully** audit-logged" — **false**. Coverage is PARTIAL,
  writes are `@Async` with swallowed failures, and a 90-day purge runs.
- "immutable audit row" (spec §5/§9) — no immutability exists today.
- "no geography in schema" — **overstated**; columns exist (free text), but no
  authorization and no canonical reference table.

### 5.3 Unverified — requires inspection or stakeholder confirmation
- **No production admin-provisioning path** exists; whether that is intended is a
  **founder decision**, not a code fact.
- **Canonical geography identifiers** do not exist; §7.2 is a recommendation.
- **All governance items** — `EDUCATION_OFFICIAL` role, `jurisdiction_assignments`,
  suppression constants, cache/invalidation strategy — are **PROPOSED, unbuilt,
  untested**.
- Whether a jurisdiction revoke must also revoke sessions/refresh tokens (§5.4)
  and whether revoking all assignments suspends the account (§5.3) — **policy**.

## 6. Explicit confirmation

- **No education-official role was added.** `UserRole` remains
  `{STUDENT, TEACHER, GUARDIAN, ADMIN, SCHOOL_ADMIN}` (unchanged).
- **No governance migration was created.** No `jurisdiction_assignments`,
  geography reference table, or new Flyway version exists. Migrations remain
  V1–V17.
- **No governance dashboard, endpoint, or assignment API was built.**
- **No authentication/role architecture was altered.** The P0 suspension
  protections (`JwtAuthFilter`, refresh leg) and the P1 school-admin tenant
  isolation are untouched and regression-tested (§3, §4).
- **No production data, credentials, or configuration were touched.**
- The governance hierarchy remains **PROPOSED, NOT APPROVED, NOT IMPLEMENTED**;
  implementation is gated on §10 of the spec.

## 7. Limitations

- All results are **local** (dev H2 test profile, mock providers). They are not
  evidence of production, national-scale, or ministry-approved readiness.
- No load test beyond the pilot fixture; no country-scale performance claim.
- The verification depends on the current HEAD; a future commit could change the
  behaviour these controls rely on (the governance tests exist to catch that).
