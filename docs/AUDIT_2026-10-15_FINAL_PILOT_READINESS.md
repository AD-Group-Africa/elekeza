# Elekeza — Final Pilot-Readiness Audit (2026-10-15)

Overwrites nothing; new file. Companion to: `docs/PROJECT_STATE_DOSSIER.md`,
`docs/PRODUCTION_READINESS.md`, `docs/TESTING.md`, `docs/PILOT.md`.

> All evidence in this run was gathered locally (scratch DB, mock providers)
> and is reproducible with the documented local toolchain.

## A. Executive summary

The release state matches the target condition at branch `release/v0.1.0`
during this audit; actual repo path — `Flagship Projects/Elekeza` — with the
local scratch database and the exhibition release profile.

* Verified live: identity/auth RBAC + tenant isolation, admin journey,
  AI (good and degraded paths), guardian↔teacher messaging round-trip.
* One P1 defect found and fixed at this session (guardian thread showed no
  own-sent messages) — verified live after fix.
* Payment correctness is implemented and verified only in the MOCK provider
  (which the app honestly advertises with `mock:true`).

Verdict — **CONDITIONALLY READY** (see H; blockers are credentials/approval-only
and must be closed before any public money flows).

### Critical blockers
1. Real Daraja (M-Pesa) production credentials must be obtained and edge
   callbacks must be signed (provider signature not verified anywhere).

### Work completed
* Guardian thread sent-leg bug fix (Backend).
* Journeys re-verified live post-fix.

### Work not completed (outside the environment scope of this run)
* Real payment-provider transactions were intentionally not triggered.
* No E2E mobile/SMS/email sends (providers are intentionally mock in this
  environment).

### Recommended next decision
Accept pilot go-ahead with the two blockers above enforced as release gates:
payments stay MOCK until both blockers are closed in production.

## B. Verified repository state
* Branch `release/v0.1.0`; working tree preserved except the P1 fix (2 files).
* Build re-run: backend `bootJar` OK (exit 0); **full backend test suite re-run post-fix — BUILD SUCCESSFUL, exit 0**.
* Frontend re-run post-fix: vitest 20/20, `tsc --noEmit` clean.
* Backend log: Flyway 17 migrations validated; schema v17 up-to-date.
* DB in use: `elekeza_chain_scratch` (scratch/test; no production learners).

## C. Integration matrix

| Area | Status | Evidence |
|---|---|---|
| Auth/RBAC/Tenant isolation | VERIFIED — TEST ENV | 401 unauth, 403 cross-role, 403 cross-institution, 401 tampered session, CSRF-verified |
| Guardian↔Teacher messaging | VERIFIED — TEST ENV | Sent msgs now appear in guardian thread (ids 36,39,40,41); teacher inbox retains them (id 41) |
| Admin journey | VERIFIED — TEST ENV | 9/9 steps OK |
| AI degradation path (bad-key) | VERIFIED — TEST ENV | Clean UI, no crash, no secret-exposed in browser |
| AI healthy service | VERIFIED — TEST ENV | `:8001/health` 200 `{"status":"ok"}` |
| M-Pesa (real Daraja) | BLOCKED — credentials | No MPESA_CONSUMER_KEY present; mode honestly `mock:true` |
| M-Pesa (mock gateway) | VERIFIED — TEST ENV | Full STK→callback→replay flow; idempotency proven at DB (exactly 1 Payment row for replayed success) |
| Email/SMS/Storage (real providers) | MOCKED / SIMULATED | `EMAIL/SMS/STORAGE_PROVIDER=mock` |
| DB migrations | VERIFIED — TEST ENV | Flyway v17 validated; scratch DB |

## D. Manual E2E matrix

| Journey | Outcome |
|---|---|
| Learner | OK (earlier runs + regressions green) |
| Teacher | OK (`journey` scripts) |
| Guardian | OK after P1 fix; sent msgs visible to sender post-fix |
| Admin | OK 9/9 |
| AI | OK healthy + degraded (bad key) |
| Payment | OK in MOCK (never live) |
| Responsive/low-connectivity | not measured this run |
| Clean-environment | OK (scratch DB reseeded; migrations validated) |

## E. Performance
* API latency: uniformly ≈3.5–7ms across endpoints; no bottleneck.
* Warm dev-server pages 60–73ms; first hit compiles (Next dev JIT) — **not**
  a production CWV artefact.
* No targeted perf changes were justified at the attained baseline.

## F. Code changes
* `backend/.../notification/NotificationService.kt`, `MessageController.kt`
  — added the guardian-thread "sent" leg (own-outbound human messages).
  Verified live post-restart. Rollback: revert these two files.

## G. Security & accessibility
* Cross-role & cross-institution POSTs correctly rejected after CSRF tokens
  (session POST probes without tokens previously produced false-positives in
  some hand-runs — noted for future runs).
* Unauthenticated `/api/payments/callback` rejects unknown checkoutIds
  (`ResultCode 1`), skips terminal replays, enforces amount-match.
* No production learner data used/recorded.

## H. Pilot-readiness decision
**CONDITIONALLY READY** — unconditional on closing the two blockers in C
(real M-Pesa credentials + provider signature verification) and keeping
production on honest `mock:true` until then.

## J. Governance-hierarchy extension audit (2026-10-15, phase 2)

### J.1 Existing vs intended hierarchy

Implemented roles (`UserRole` enum): `STUDENT, TEACHER, GUARDIAN, ADMIN,
SCHOOL_ADMIN` — nothing else. Schema has **no geography**: no county /
sub-county / region columns on `institutions`; `country_configs` (V15) is
configuration only. The "Platform" role the brief asks about maps to
`ADMIN` (platform operator), with `superadmin@elekeza.app` as a seeded
dev-only account (Flyway V2, demo-seed-gated; absent from prod).

| Brief role | Exists? | Mapping / gap |
|---|---|---|
| Platform Superadmin | PARTIAL | ADMIN role; no separate privilege tier |
| AD operations (support/monitoring) | NOT IMPLEMENTED | would need scoped support role |
| National education oversight | NOT IMPLEMENTED | no role, no scope model |
| County officials | NOT IMPLEMENTED | no geography in schema |
| Sub-county officials | NOT IMPLEMENTED | no geography in schema |
| School leadership/admin | VERIFIED | SCHOOL_ADMIN, tenant-scoped |
| Teachers | VERIFIED | TEACHER, institution-scoped |
| Guardians | VERIFIED | GUARDIAN via lifecycle guardian_links |
| Learners | VERIFIED | STUDENT, own-data only |

Classifying oversight dashboards (county/national) as a **product gap**, not
implemented: building one now would be speculative without approval.

### J.2 Role & permission matrix (backend-enforced)

| Capability | STUDENT | TEACHER | GUARDIAN | SCHOOL_ADMIN | ADMIN |
|---|---|---|---|---|---|
| Own progress | ✓ | — | — | — | — |
| Ward data (linked only, lifecycle) | — | — | ✓ | — | — |
| Class/staff roster | — | own inst read | — | own inst CRUD | all |
| Tenant roster / cross-inst | 403 | 403 | 403 | **403** | ✓ |
| Platform audit log | 403 | 403 | 403 | 403 | ✓ |
| Payments STK / revenue | pay-own | 403 | pay-own | STK only | ✓ |
| Analytics /admin | 403 | 403 | 403 | **own inst only (fixed)** | platform-wide |

### J.3 Adversarial test results (live, CSRF-correct)

| # | Attack | Expect | Actual |
|---|---|---|---|
| 1 | School admin → other school's roster (+CSV import) | 403 | **403** ✓ |
| 4 | SCHOOL_ADMIN → platform overview/audit/revenue | 403 | **403** ✓ |
| 5 | Support-style data browse — N/A (no support role) | — | NOT IMPLEMENTED |
| 6 | Guardian → another family's ward (detail/progress/digest/support) | 403 | **403** ✓ (submissions 404) |
| 7 | Teacher → out-of-scope learner progress | 403 | **403** ✓ |
| 8 | Learner → other learner progress routes | 403/404 | **403/404** ✓ |
| 9 | Tampered JWT | 401 | **401** ✓ |
| 10 | Suspended account session reuse + refresh | 401 | **WAS 200 — P0 — FIXED → now 401** ✓ |
| 4b | SCHOOL_ADMIN analytics cross-tenant totals | own-only | **WAS platform-wide — P1 — FIXED → now own-institution** ✓ |
| 12 | Guardian-link revocation / expiry | enforced | code-verified (`currentlyActive()` used everywhere) |

### J.4 Governance findings & fixes

* **P0 (fixed)** — `JwtAuthFilter` did not re-check `user.active`; suspended
  accounts kept a working session AND `/api/auth/refresh` minted fresh tokens
  (previously incl. one-time passwords) until expiry. Both legs now enforced.
* **P1 (fixed)** — `/api/analytics/admin` leaked platform-wide aggregates to
  every SCHOOL_ADMIN. Now scoped: SCHOOL_ADMIN sees own institution (learners,
  teachers, link-based guardians, 1 institution); ADMIN remains platform-wide
  (role-keyed; note seed V16 assigns institutions to ADMIN accounts, so the
  role, not null-institution, decides scope).
* **P0-adjacent (credentialed admin hygiene)** — demo/dev seeded accounts
  (`superadmin@`, `admin@` — `teacher123` in scratch) MUST be replaced/rotated
  before any deployment beyond the scratch environment; no hardcoded
  passwords were added by this audit.
* **P3** — `/super-admin` page has no client-side route guard (backend 403
  protects data; page renders empty cards for non-ADMIN). Cosmetic.
* **Product gaps (NOT IMPLEMENTED, by design this run):** education-official
  roles (national/county/sub-county), geographic scope model, support-role
  least-privilege workflows, audit-approval workflows for sensitive exports.
  Recommendations: add a geography table (county/sub_county on institutions),
  an `EDUCATION_OFFICIAL` role with jurisdiction rows and read-only aggregated
  report endpoints; consider minimal Super–ADMIN separation only if
  requirement justifies it.

### J.5 Regression evidence (post-governance fixes)

* Backend `./gradlew test` — **BUILD SUCCESSFUL, exit 0** (full suite).
* `bootJar` rebuilt; backend restarted; live re-probes above all green.
* Frontend untouched this phase; prior vitest 20/20 + tsc clean still valid.

### J.6 Performance (governance endpoints, local scratch fixture)

Fixture: 35 users, 7 guardian_links, 9 institutions, 3 payments (scratch DB).
Metrics are local steady-state, warm treatments, not field data.

| Endpoint (warm) | p-range |
|---|---|
| `/api/analytics/admin` — SCHOOL_ADMIN (scoped) | 24–35 ms (first-hit 88 ms JIT) |
| `/api/analytics/admin` — ADMIN (platform-wide) | 20–35 ms |
| `/api/institutions/1/staff` (scoped list) | 20–25 ms (first-hit 208 ms JIT) |

The scoped endpoint does one `findAll()` filter + one `findAll()` link scan —
acceptable at pilot scale but both are full-table loads. **Flagged for scale**
(add `findByInstitutionId` for users, `findByLearnerIdIn` for links) before a
multi-school deployment with thousands of users; no premature index added
without a larger fixture to measure against. Latency deterioration with
growing fixture size was not tested beyond this size.

Pilot-readiness impact: **CONDITIONALLY READY supersedes** — now with three
release gates: (1) Daraja credentials + callback signature, (2) rotating all
demo credentials at/first deployment, (3) governance hierarchy remains a
documented product gap until approved and specified.

## I. Next actions
1. P0: Procure Daraja (production) credentials — owner: Harry/ops; AC:
   stkPush 200 + signed callback in prod.
2. P0: Implement/verify provider callback signature verification at edge.
3. P1: Real-provider sandbox round-trip (transaction→callback) before pilot.
4. P2: Mobile-connectivity/responsive run at 3G/CPU-throttled conditions.
5. P3: AI-response caching dedupe (no perf numerics justify code change now).
6. P2: Specify & approve the education-official hierarchy (geography schema +
   EDUCATION_OFFICIAL role, read-only aggregated reporting) before build.
