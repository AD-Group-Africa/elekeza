# Elekeza Governance Hierarchy — Specification (v2, 2026-10-16)

**Status:** PROPOSED — NOT APPROVED, NOT IMPLEMENTED.

Written against the actual repository state (`feat/elekeza-pilot-completion` @
`1299c5b`). Nothing in the geographic-education-official sections is implemented
or approved; they are for stakeholder sign-off **before any build**. The
platform-operations rows map to roles that **already exist**.

> v2 supersedes v1 (2026-10-16). Changes: revocation and account suspension are
> now separate operations (§5); the aggregate-privacy threshold is no longer
> presented as a guarantee (§6); role naming is `EDUCATION_OFFICIAL` throughout
> (§2); jurisdiction validity and integrity rules added (§7); administrative
> provisioning and audit claims re-stated against verified evidence (§8).

Every claim below carries an explicit evidence label:

- **VERIFIED** — demonstrated in the repository (file/line or test cited).
- **PARTIAL** — implemented for some paths only; gaps named.
- **PROPOSED** — designed here, not built; requires approval.
- **UNVERIFIED** — needs inspection or stakeholder confirmation; do not assume.

Companion to: [AUDIT_2026-10-15_FINAL_PILOT_READINESS.md](AUDIT_2026-10-15_FINAL_PILOT_READINESS.md),
[GOVERNANCE-REGRESSION-REVIEW-2026-10-16.md](GOVERNANCE-REGRESSION-REVIEW-2026-10-16.md),
[PROJECT_STATE_DOSSIER.md](PROJECT_STATE_DOSSIER.md), [PRODUCT.md](PRODUCT.md).

---

## 1. Ground truth: what actually exists today

| Level (intended) | Existing implementation | Status |
|---|---|---|
| Platform operations ("Superadmin") | `UserRole.ADMIN` — platform-wide analytics (`/api/analytics/admin` + `/overview`), cross-institution visibility. **No ADMIN-provisioning API exists**; ADMIN appears only via demo/showcase seeds (§8). No separate privilege tier. | IMPLEMENTED (single tier) |
| School administration | `UserRole.SCHOOL_ADMIN` — institution-scoped staff CRUD, tenant-isolated analytics (P1 fix), CSV roster import | IMPLEMENTED |
| Sub-county education oversight | Nothing — no role, no jurisdiction model | NOT IMPLEMENTED (PROPOSED) |
| County education oversight | Nothing | NOT IMPLEMENTED (PROPOSED) |
| National education oversight | Nothing | NOT IMPLEMENTED (PROPOSED) |
| AD internal support | Nothing — nearest concept is ADMIN, which is **too broad** for support work by design | PROPOSED (unapproved) |
| Teachers | `UserRole.TEACHER`, institution-scoped | IMPLEMENTED |
| Guardians | `UserRole.GUARDIAN`, lifecycle `guardian_links` | IMPLEMENTED |
| Learners | `UserRole.STUDENT`, own-data only | IMPLEMENTED |

Implemented role enum (**VERIFIED** — [UserRole.kt](../backend/src/main/kotlin/com/elekeza/backend/auth/UserRole.kt)):
`STUDENT, TEACHER, GUARDIAN, ADMIN, SCHOOL_ADMIN`. Nothing else.

### 1.1 Geography facts (**VERIFIED**)

- `institutions` **has `county` and `sub_county` columns** — `VARCHAR(255)`,
  nullable, free text ([V1__baseline_schema.sql](../backend/src/main/resources/db/migration/V1__baseline_schema.sql),
  lines 123–124). They are **not** foreign keys and have no enum/CHECK
  constraint. The demo seed populates them with free-text names (`'Central'`,
  `'Nairobi'`).
- **There is no geography reference table** (no `counties`, no `sub_counties`,
  no canonical code list). `country_configs` (V15) is configuration only.
- **No jurisdiction/assignment table joins any user to a geographic area**, and
  **no authorization logic reads the geographic columns** (grep: the only
  references are the two DDL lines and the demo seed).
- Therefore the National → County → Sub-county → School relationship is
  **modelled as free-text data, not as authorization**. This corrects the
  phase-2 audit's "no geography in schema" wording (see audit addendum L.1).

## 2. Proposed role-and-permission matrix (after approval)

New role: **`EDUCATION_OFFICIAL`** (single enum value; jurisdiction rows carry
the level). Optional second role: **`AD_SUPPORT`** (platform staff, see §3).

> **Naming:** the canonical name is `EDUCATION_OFFICIAL`. The token
> `ED_OFFICIAL` used in v1 of this document and in the audit's K.4 section is an
> **obsolete draft alias** and must be removed wherever it appears. Neither name
> is added to the application's `UserRole` enum until approval.

| Capability | STUDENT | TEACHER | GUARDIAN | SCHOOL_ADMIN | AD_SUPPORT | EDUCATION_OFFICIAL | ADMIN |
|---|---|---|---|---|---|---|---|
| Own learning data | ✓ | — | — | — | — | — | — |
| Ward data (linked) | — | — | ✓ | — | — | — | — |
| Class + learner ops | — | own inst | — | own inst | — | — | ✓ |
| Analytics: own institution | — | agg | wards | ✓ (forced) | — | — | ✓ |
| Analytics: jurisdiction summary (aggregated, de-identified) | — | — | — | — | — | ✓ (own county/sub-county only) | ✓ |
| Identifiable learner records | own | own inst | linked | own inst | **never by default** | **never by default** | only via a signed, audited approval flow (PROPOSED) |
| Institution onboarding/status | — | — | — | — | read (PROPOSED) | read (PROPOSED) | ✓ |
| Audit log | — | — | — | — | ✓ read (PROPOSED) | own-jurisdiction events, read (PROPOSED) | ✓ |

Hard rules:

1. **Geographic scope NEVER implies identifiable learner data.** Officials
   receive counts and rates; individual records would require a separately
   logged approval flow (§9) — and even then, minimum necessary fields.
2. Jurisdiction is a **separate table** (`jurisdiction_assignments`), never an
   enum-level guess (schema proposed in §7).
3. **Query rules:** an official's query must be filtered to their active
   jurisdiction **before** counting; a NATIONAL official sees aggregates across
   all counties but never the learner table directly. Denial by scope is 403; an
   empty jurisdiction is an explicitly labelled "no jurisdiction assigned" —
   never a full-platform view.
4. **De-identification:** cells with a denominator below a provisional threshold
   are suppressed or merged (§6). This is **PROPOSED**, not implemented, and the
   threshold is **not** a guarantee of anonymity.
5. **Revocation and suspension are distinct operations** — see §5. Do **not**
   deactivate a user's whole account merely because one jurisdiction assignment
   ends.
6. **Cross-scope denial:** URL/ID/body manipulation that crosses jurisdiction is
   401/403 at the backend; scope is derived from the authenticated principal,
   never from a request parameter. Export uses the same filter as the on-screen
   view (shared query builder; no separate "export-all" path).

## 3. Roles NOT being introduced (decisions against)

- No `MINISTRY_OFFICIAL` or any org-mapping to real Ministry of Education
  structures — Elekeza models jurisdiction levels generically and makes **no
  claim of ministry approval**.
- No Super-admin / ADMIN split for the pilot. A second tier (e.g.
  `PLATFORM_OWNER`) is deferred; today ADMIN's sensitive actions are only
  **partially** audited (§8).
- **No support role that can see learner data, even "temporarily".** By default
  support stays out of learner data entirely. `AD_SUPPORT` remains **optional
  and unapproved**; if ever granted, any sensitive access must be least
  privilege, time-boxed, reason-logged, and visible to the school, and must
  **not** inherit access to identifiable learner records by default.

## 4. Platform Superadmin / AD operations assessment (existing)

**VERIFIED** by HTTP-level regression tests
([GovernanceRegressionTest.kt](../backend/src/test/kotlin/com/elekeza/backend/governance/GovernanceRegressionTest.kt))
and source inspection:

- `ADMIN` gets platform-wide analytics; `SCHOOL_ADMIN` is forced to institution
  scope (T4/P1).
- `/api/analytics/admin/overview` is `@PreAuthorize("hasRole('ADMIN')")` —
  SCHOOL_ADMIN hits the method-level 403.
- Suspended accounts: session 401 **and** refresh 401, performed through the
  real staff API (T10/P0).
- Unauthenticated privileged access → structured 401 `AUTH_REQUIRED`; wrong role
  → structured 403 `ACCESS_DENIED` (`SecurityConfig` entry point / handler).

**Remaining gaps (NOT built):** operational health dashboards for platform
service status/integration health, an export-approval workflow, and any
attributable "support impersonation" concept do **not** exist. Any support
workflow must not default to viewing learner records (§2 rule 1).

Frontend note (**VERIFIED**): `/super-admin` previously rendered an empty admin
shell for non-ADMIN users. It now renders an explicit "not authorized" state and
does not fire privileged data requests unless `user.role === 'ADMIN'`
([super-admin/page.tsx](../frontend/src/app/super-admin/page.tsx)). This is
**defence in depth only** — the backend remains the authoritative boundary and
re-checks every request.

## 5. Jurisdiction revocation vs. account suspension (distinct operations)

Revoking one jurisdiction assignment must **never** implicitly deactivate the
user's whole account. These are five separate operations with distinct
outcomes. **All are PROPOSED — none is implemented.**

### 5.1 Revoke / deactivate a single jurisdiction assignment
- Effect: `jurisdiction_assignments.is_active = false`, `revoked_at` set.
- Account stays active; the user keeps any other active assignments and any
  non-official access they hold.
- If it was their **only** active assignment, they get the explicit "no
  jurisdiction assigned" state (403-equivalent), **not** a full-platform view.

### 5.2 Suspend the user's entire account (explicit, separate authorisation)
- Effect: `users.active = false`.
- Requires a specific, separately authorised action — **never** a side effect of
  §5.1. This is the operation already enforced end-to-end: the JWT filter refuses
  a suspended principal and the refresh leg refuses to mint new tokens
  (**VERIFIED**, T10/P0).
- Reactivation (`users.active = true`) restores the same credentials; this is
  the currently verified behaviour.

### 5.3 Revoke all assignments at once
- An explicit administrative action (e.g. "this person left the agency") that
  executes §5.1 for every active row of the user. It does **not** by itself
  perform §5.2; whether it also deactivates the account is a **policy decision**
  (§10), and if adopted it must be logged as two distinct events.

### 5.4 Invalidate sessions/tokens when required
- Access tokens are short-lived (900 s) and carry no jurisdiction claim yet, so
  **revocation latency is a design decision, not an accident** (see §5.5).
- Password reset already revokes refresh tokens (**VERIFIED** in
  `AuthController.resetPassword` flow). Suspension already cuts the refresh leg
  (**VERIFIED**).
- Whether a jurisdiction revoke must additionally revoke refresh tokens is a
  **policy decision** (§10); if yes, it reuses the existing
  `refreshTokenRepository` revocation path, never a new mechanism.

### 5.5 Authority-source resolution (revocations must take effect promptly)
- Preferred model: resolve active jurisdiction assignments **server-side on
  every protected request** (single indexed lookup by `official_user_id` +
  `is_active`). Correctness over micro-optimisation.
- If a cache is ever introduced, it must have a **documented invalidation
  strategy** with a bounded TTL and explicit invalidation on §5.1/§5.2/§5.3 —
  otherwise a revoked official could keep reading aggregates. Any cache is
  **UNVERIFIED** until built and tested; the default is no cache.
- Explicitly rejected: encoding jurisdiction level into the JWT. Tokens outlive
  assignments, and a stale claim would defeat revocation.

## 6. Aggregate-data privacy (threshold is NOT a guarantee)

> **Do not treat `kMinDenominator = 5` as anonymity protection.** Any single
> threshold is a weak heuristic. The value 5 is **provisional and subject to
> stakeholder approval** (§10), and must be configurable per pilot, enforced
> server-side (never in the frontend).

**NONE of these controls exist yet** — the whole section is PROPOSED.

Documented risks that a fixed threshold alone does **not** neutralise:

- **Differencing between overlapping reports.** Two "safe" aggregates over
  nearly identical populations can be subtracted to isolate an individual
  (e.g. county total minus sub-county total = one school's remainder).
- **Repeated queries over time.** The same cell re-queried before/after a single
  enrolment change reveals that learner's contribution.
- **Small or overlapping geographic populations.** Real sub-counties can have
  fewer than `k` learners; overlapping official jurisdictions compound this.
- **Suppression bypass through exports.** A CSV that applies no suppression, or
  different suppression than the dashboard, leaks exactly what the screen hid.
- **Re-identification via attribute combinations.** Aggregate breakdowns by
  grade + gender + school of a small cohort can single out a learner even when
  each cell passes the threshold.

Complementary controls **recommended** (still PROPOSED):

- **Complementary suppression** — suppress enough cells that no published
  marginal allows reconstruction of a suppressed cell; round or band values.
- **Consistent filtering across dashboards and exports** — one query builder,
  identical suppression on every output path.
- **Controlled breakdowns** — restrict the number and depth of dimensions
  (grade, gender, …) an official may cross-tabulate; cap report frequency.
- **Differencing protection** — deny or rate-limit repeated/overlapping queries,
  and consider query auditing.

Do **not** claim any of these controls already exist unless a future test proves
it. Today, jurisdiction reporting does not exist at all.

## 7. Jurisdiction validity & data-integrity rules (PROPOSED)

Proposed schema (name for illustration; **no migration is created here**):
`jurisdiction_assignments(official_user_id, level, county, sub_county,
is_active, assigned_by, assigned_at, revoked_at, reason)`.

### 7.1 Validity by level
- **`NATIONAL`** — no county restriction, no sub-county restriction.
- **`COUNTY`** — exactly one valid county; no sub-county restriction.
- **`SUB_COUNTY`** — exactly one valid sub-county **that belongs to the stated
  county**.

### 7.2 Canonical geography identifiers (recommendation)
- Relying on free-text `county`/`sub_county` names is fragile (typos, case,
  renames) and cannot anchor authorization. **Recommend** introducing canonical
  geography identifiers (a reference table with stable codes, or at minimum a
  normalised code column) **before** any jurisdiction assignment is stored.
- This is a **new table** that does **not** exist today (§1.1). Until it does,
  jurisdiction validation cannot be trusted — mark any interim name-based
  matching **UNVERIFIED**.

### 7.3 Constraints: database- vs service-enforced

Enforce in the **database** (hard, cannot be bypassed):
- `level` is one of the allowed values (CHECK / enum-like).
- Non-null county for `COUNTY` and `SUB_COUNTY`; non-null sub-county for
  `SUB_COUNTY` (composite CHECK).
- **Uniqueness of active assignment**: a partial unique index preventing two
  active rows with the same `(official_user_id, level, county, sub_county)`.
- `revoked_at` set iff `is_active = false` (CHECK), preserving assignment history.

Enforce in the **service** (needs authorization context / cross-row logic):
- **Reassignment** deactivates the prior row and inserts a new one in one
  transaction; never an in-place destructive update (history is kept).
- Only **ADMIN** (per §10 decision) may create/revoke assignments.
- Sub-county-belongs-to-county verification when a reference table exists.
- Every §5 operation writes its audit row (§8).

Say explicitly which layer owns each rule, and test both. **None of this is
implemented.**

## 8. Administrative provisioning & audit status (evidence-labelled)

### 8.1 How ADMIN accounts are created — **VERIFIED (partial by design)**
- Self-registration **always** creates `STUDENT`
  ([AuthService.register](../backend/src/main/kotlin/com/elekeza/backend/auth/AuthService.kt)).
- Staff management can grant **only** `TEACHER` or `SCHOOL_ADMIN`
  (`StaffManagementService.assignableRoles`); `ADMIN` is explicitly rejected,
  and `setActive` refuses to modify an ADMIN target with 403
  ([StaffManagementService.kt](../backend/src/main/kotlin/com/elekeza/backend/institution/StaffManagementService.kt)).
- Therefore **ADMIN accounts exist only via seeds**: the V2 demo seed
  (`superadmin@elekeza.app`, gated by the `demoSeedEnabled` placeholder, **TRUE
  by default in `application.yaml` but set OFF in prod/docker**),
  `ShowcaseDataInitializer` (`SHOWCASE_SEED=1`), and `AttendanceFinanceSeed`.
- **Conclusion:** there is **no production administrator-provisioning workflow
  and no approval workflow**. In production (`demoSeedEnabled` off) no ADMIN is
  created at all. Any statement implying a supported provisioning path would be
  **UNVERIFIED**.

### 8.2 Audit logging — **PARTIAL**
- `audit_logs` table exists (**VERIFIED** — V1 L162) with user/action/category/
  detail/ip/request_id/success/created_at and indices.
- `AuditLogService.log(...)` is called from **some** paths: staff create /
  deactivate / reactivate / password-reset-request (StaffManagementService),
  billing, curriculum, devices, exams, tutor.
- **Gaps / caveats (VERIFIED):**
  - Writes are `@Async` (`@EnableAsync` confirmed) and **failures are swallowed**
    (logged, never bubbled) — an audit write can silently not happen.
  - A scheduled job `purgeOldAuditLogs` **deletes records older than 90 days**
    (`@EnableScheduling` confirmed) — the log is **NOT immutable**.
  - Privileged **reads are not audited**: there is no audit call on
    `/api/analytics/admin`, `/api/analytics/admin/overview`, or
    `/api/admin/audit` itself. Merely *viewing* platform data leaves no trace.
  - The audit list endpoint is ADMIN-only (**VERIFIED**
    `@PreAuthorize("hasRole('ADMIN')")`).
- **Conclusion:** do **not** describe audit as "fully logged", "immutable", or
  "tamper-evident". It is best-effort, asynchronous, partially scoped, and
  pruned after 90 days. A future sensitive-access workflow would require a
  **separate**, same-transaction, durable audit path (§9) — **PROPOSED**.

### 8.3 Control status summary

| Control | Status |
|---|---|
| ADMIN cannot be created via any API | VERIFIED |
| ADMIN exists only via demo/showcase seeds | VERIFIED |
| Production admin-provisioning workflow | PROPOSED (does not exist) |
| `audit_logs` table + admin-only read endpoint | VERIFIED |
| Audit coverage across privileged actions | PARTIAL |
| Audit immutability / tamper-evidence | NOT IMPLEMENTED (90-day purge) |
| Auditing of privileged data *reads* | NOT IMPLEMENTED |
| Sensitive-access approval workflow | PROPOSED |

## 9. Approval workflow for sensitive access (PROPOSED, not built)

Requirements before any individual-learner access by ADMIN or
`EDUCATION_OFFICIAL`: a reason field, target scope, expiry, a four-eyes check
for cross-institution access, and an **immutable** audit row (actor, timestamp,
target, outcome, scope) written server-side **in the same transaction** — a
stricter path than today's async, pruned `audit_logs` (§8.2). View-only
overrides must not grant write. This is a **policy decision** for founder
sign-off; nothing ships until signed.

## 10. Explicit policy decisions requiring founder/stakeholder approval

1. Whether education officials ever need identifiable learner data at all
   (recommended: no, aggregates only).
2. Who assigns/revokes jurisdiction (recommended: platform ADMIN only).
3. Whether sub-county officials may see school-level breakdowns or only
   aggregate totals (recommended: school-level aggregates, k-suppressed).
4. `kMinDenominator` value — **provisional, must be approved** (§6).
5. Data-retention and export rules for jurisdiction reports (CSV scope: the
   same jurisdiction filters as on-screen; retention: per `country_configs`).
6. Whether a jurisdiction revoke must also invalidate sessions/refresh tokens
   (§5.4) and whether revoking all assignments also suspends the account (§5.3).
7. Whether `AD_SUPPORT` is needed for the pilot at all, or support stays out of
   learner data entirely (recommended: the latter, until a signed, time-boxed
   policy exists).

## 11. Implementation plan when approved (smallest coherent increments)

1. Canonical geography reference table/identifiers (§7.2) — **prerequisite**.
2. Migration: `jurisdiction_assignments` with the §7.3 DB constraints.
3. `EDUCATION_OFFICIAL` role in `UserRole` (additive; no existing role changed).
4. Server-side jurisdiction resolver (§5.5) + `/api/oversight/summary`
   (aggregate-only, suppression per §6, 403 cross-scope).
5. Assign/revoke endpoints implementing §5 as **separate** operations, each
   audited durably.
6. Minimal oversight pages (national/county/sub-county) sharing one component.
7. Backend tests: scope isolation, revocation-vs-suspension independence,
   suppression/complementary rules, export-parity, cache-invalidation — mirroring
   `GovernanceRegressionTest`.
8. Only then: dashboards become reachable; navigation is role-aware.

**Until approved: no migration, no role changes, no dashboards.** This file is
the specification of record, kept deliberately separate from any build.
