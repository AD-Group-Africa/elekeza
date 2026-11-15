# Elekeza — Privileged Access & Audit Coverage Review (2026-10-16)

**Scope:** audit only. No application code, migration, role, or configuration was
changed by this review. Branch `feat/elekeza-pilot-completion` @ `1299c5b`.

Companion documents:
[GOVERNANCE-HIERARCHY-SPEC.md](GOVERNANCE-HIERARCHY-SPEC.md) ·
[GOVERNANCE-DECISION-REGISTER.md](GOVERNANCE-DECISION-REGISTER.md) ·
[INTEGRATION-READINESS-REPORT-2026-10-16.md](INTEGRATION-READINESS-REPORT-2026-10-16.md) ·
[RELEASE-ASSURANCE-REVIEW-2026-10-16.md](RELEASE-ASSURANCE-REVIEW-2026-10-16.md).

---

## 1. Executive verdict

**Authorization is broadly sound; audit coverage is materially incomplete for
privileged and bulk data access.**

- **Authorization (who may act):** consistently enforced server-side at both the
  filter chain (`SecurityConfig`) and method level (`@PreAuthorize`), with
  structured 401/403. Tenant scoping is applied and regression-tested. No
  authorization bypass was found in this review.
- **Audit (what was recorded):** **PARTIAL**. `audit_logs` captures a subset of
  **write/mutating admin actions** (staff lifecycle, billing, exams, devices,
  curriculum, tutor). It does **not** capture:
  - **any privileged read** (analytics, dashboards, rosters, audit-list itself);
  - **bulk data ingestion** (CSV student/guardian import);
  - **authentication events** (success or failure), even though a
    failed-login counter query exists and is therefore **dead code**;
  - **payment initiation / callback state changes** (only SLF4J log lines).
- **Integrity limits:** writes are `@Async` with **swallowed failures**, and a
  daily job **deletes records older than 90 days**. The log is therefore **not
  immutable, not tamper-evident, and not guaranteed-complete**.

**Readiness impact:** the missing privileged-read audit weakens incident
investigation ability, but it is a **monitoring/assurance gap**, not a
live-access breach. It does not block a controlled pilot; it does block any
claim of "audited access to learner data".

## 2. Access inventory & coverage matrix

Legend — Audit: `Y` recorded, `N` not recorded, `PART` partial. Evidence:
file/line or test.

### 2.1 Platform / institution aggregate reads

| Operation | Endpoint | Authorization | Audit event | Payload | Failure behaviour | Retention | Verdict | Evidence |
|---|---|---|---|---|---|---|---|---|
| Platform overview (all users/institutions) | `GET /api/analytics/admin/overview` | `@PreAuthorize hasRole('ADMIN')` + URL rule | **N** | — | n/a | — | **MISSING** (privileged read) | [AnalyticsController.kt](../backend/src/main/kotlin/com/elekeza/backend/analytics/AnalyticsController.kt) |
| Scoped/platform analytics | `GET /api/analytics/admin` | `hasAnyRole('SCHOOL_ADMIN','ADMIN')`; institution-scoped for SCHOOL_ADMIN | **N** | — | n/a | — | **MISSING** (privileged read) | `AnalyticsController.adminAnalytics`; test `GovernanceRegressionTest` |
| Institution list | `GET /api/institutions` | `hasRole('ADMIN')` | **N** | — | n/a | — | **MISSING** | [InstitutionController.kt](../backend/src/main/kotlin/com/elekeza/backend/institution/InstitutionController.kt) |
| Institution student roster | `GET /api/institutions/{id}/students` | `ADMIN`/`SCHOOL_ADMIN` + `requireInstitutionAccess` | **N** | — | n/a | — | **MISSING** (learner data read) | same |
| Payment revenue (platform-wide) | `GET /api/payments/revenue` | `hasRole('ADMIN')` | **N** | — | n/a | — | **MISSING** | [MpesaController.kt](../backend/src/main/kotlin/com/elekeza/backend/payments/MpesaController.kt) |

### 2.2 Learner & educational-performance reads

| Operation | Endpoint | Authorization | Audit | Verdict | Evidence |
|---|---|---|---|---|---|
| Learner own progress | `GET /api/analytics/student`, `/dashboard` | `authenticated()` / principal-scoped | N | MISSING (low sensitivity: own data) | `AnalyticsController` |
| Teacher → learner progress | `GET /api/teacher/student/{id}/progress` | `hasAnyRole('TEACHER','ADMIN','SCHOOL_ADMIN')` + institution check | N | **MISSING** (learner read) | [TeacherController.kt](../backend/src/main/kotlin/com/elekeza/backend/teacher/TeacherController.kt) |
| Guardian → ward | `/api/guardian/**`, guardian analytics | `GUARDIAN` + active link (`currentlyActive()`) | N | MISSING (guardian-own) | `GuardianAnalyticsAuthorizationTest` |
| Competency / mastery progress | `/api/curriculum/learners/**`, `/api/mastery/**` | role + institution checks | N | MISSING (learner read) | `CompetencyProgressController`, `MasteryController` |

> **Key point:** an audit event for *creating* a staff member does not prove that
> *viewing* a learner's records is audited. No learner-record read is audited.

### 2.3 Staff, account status, and credential workflows

| Operation | Endpoint | Authorization | Audit event | Payload | Verdict | Evidence |
|---|---|---|---|---|---|---|
| Create staff | `POST /api/institutions/{id}/staff` | `ADMIN`/`SCHOOL_ADMIN` + tenant | `STAFF_CREATED` (ADMIN) | role/email/institution | **COVERED** | [StaffManagementService.kt](../backend/src/main/kotlin/com/elekeza/backend/institution/StaffManagementService.kt) |
| Deactivate/reactivate | `PATCH .../staff/{userId}/active` | same | `STAFF_DEACTIVATED`/`REACTIVATED` | target id/email | **COVERED** | same |
| Admin password reset | `POST .../staff/{userId}/password-reset` | same | `STAFF_PASSWORD_RESET_REQUESTED` | target id/email | **COVERED** | same |
| List staff | `GET .../staff` | same | **N** | — | **MISSING** | `StaffManagementController` |
| Self-registration | `POST /api/auth/register` | public | **N** | — | MISSING | `AuthService` |

### 2.4 Bulk ingestion & export

| Operation | Endpoint | Authorization | Audit | Verdict | Evidence |
|---|---|---|---|---|---|
| **CSV student/guardian import** | `POST /api/institutions/{id}/students/import` | `ADMIN`/`SCHOOL_ADMIN` + tenant | **N** | **MISSING — highest-value bulk gap** (creates learner+guardian accounts and returns credentials) | [InstitutionService.importStudentsFromCsv](../backend/src/main/kotlin/com/elekeza/backend/institution/InstitutionService.kt#L145) |
| CSV / report export | — | — | — | **N/A — no export endpoint found** (`grep` for csv/export/download: no matches) | — |

### 2.5 Billing, payments, financial

| Operation | Endpoint | Authorization | Audit | Verdict | Evidence |
|---|---|---|---|---|---|
| Start subscription | billing controller | `SCHOOL_ADMIN`/`ADMIN` + tenant | `BILLING_SUBSCRIPTION_STARTED` | **COVERED** | [BillingController.kt](../backend/src/main/kotlin/com/elekeza/backend/billing/BillingController.kt) |
| Issue invoice | billing controller | same | `BILLING_INVOICE_ISSUED` | **COVERED** | same |
| M-Pesa STK push | `POST /api/payments/stkpush`, `/finance/payments/mpesa/initiate` | `ADMIN`/`SCHOOL_ADMIN` (school) or payer role (fees) | **N** (SLF4J only) | **MISSING** | [MpesaService.kt](../backend/src/main/kotlin/com/elekeza/backend/payments/MpesaService.kt) |
| Provider callback state change | `POST /api/payments/callback` | `permitAll` + CSRF-exempt | **N** (SLF4J only) | **MISSING** | same; see integration report |
| Manual fee payment | `POST /api/finance/payments/manual` | `ADMIN`/`SCHOOL_ADMIN` | **N** | **MISSING** (money-movement write) | [FinanceController.kt](../backend/src/main/kotlin/com/elekeza/backend/finance/FinanceController.kt) |
| Read payments/receipts | `/api/finance/payments`, `/receipts/{id}` | role + tenant | **N** | MISSING | same |

### 2.6 Devices, attendance, curriculum, exams, tutor, messaging

| Operation | Audit | Verdict | Evidence |
|---|---|---|---|
| Device pairing/status | `DEVICE` events | **COVERED** | [DeviceController.kt](../backend/src/main/kotlin/com/elekeza/backend/devices/DeviceController.kt#L124) |
| Attendance read/write | none | **MISSING** | `AttendanceController`/`Service` |
| Curriculum writes | `CURRICULUM` events | **COVERED** | [CurriculumController.kt](../backend/src/main/kotlin/com/elekeza/backend/curriculum/CurriculumController.kt#L218) |
| Exam lifecycle | `EXAM_*` events | **COVERED** | [ExamService.kt](../backend/src/main/kotlin/com/elekeza/backend/exam/ExamService.kt) |
| Tutor actions | `TUTOR_*` | **COVERED** | [TutorService.kt](../backend/src/main/kotlin/com/elekeza/backend/tutor/TutorService.kt#L226) |
| Guardian↔teacher messaging | none | **MISSING** | `MessageController` |

### 2.7 Audit log itself & privileged configuration

| Operation | Endpoint | Authorization | Audit of the read | Verdict |
|---|---|---|---|---|
| List audit log | `GET /api/admin/audit` | `hasRole('ADMIN')` | **N (reading the audit trail is not audited)** | MISSING |
| Privileged config changes | — | — | — | N/A — no runtime config-write endpoint found |

## 3. Audit-log integrity findings

| Question | Finding | Evidence |
|---|---|---|
| Synchronous or asynchronous? | **Asynchronous** (`@Async`) | [AuditLogService.kt](../backend/src/main/kotlin/com/elekeza/backend/common/AuditLogService.kt#L93); `@EnableAsync` in `AppConfig` |
| Can failures be swallowed? | **Yes** — `catch` logs and returns; the protected operation already succeeded | `AuditLogService.log` try/catch; also `runCatching {}` wrappers in Device/Curriculum |
| Persisted before or after the operation? | **After** (best-effort); a crash between the operation and the async write loses the record | same |
| Actor/target/timestamp/outcome captured? | Partially — `userId`, `action`, `category`, `detail`, `success`, `createdAt`, optional `ip`/`requestId`. Institution is only embedded in free-text `detail` for some events, not a column | V1 `audit_logs`; event call sites |
| Secrets/PII risk in logs? | `detail` is free text; staff events include **email addresses** (PII). No token/password is passed today, but nothing structurally prevents it | `StaffManagementService` detail strings |
| Can an admin modify/delete audit rows? | **No update/delete API exists**, but the **scheduled purge deletes >90 days**, and DB-level access can delete → **not immutable** | `purgeOldAuditLogs` (cron `0 0 2 * * *`) |
| Actual retention | **90 days**, daily hard delete | same |
| Are audit reads/exports audited? | **No** | §2.7 |
| Are failed authorization attempts recorded? | **No** application audit event (403 is emitted by the security handler but not written to `audit_logs`) | `SecurityConfig.accessDeniedHandler` |
| Correlatable with payment callbacks? | **Weakly** — `requestId` exists as a column (MDC), but payment/callback paths do not write audit rows, and payment tables carry no audit linkage | §2.5 |

**Not audited at all (summary):** all privileged reads, CSV import, authentication
(success/failure), M-Pesa initiation/callback/manual payments, attendance,
messaging, and audit-log reads.

## 4. Authorization boundary tests (verified present)

Existing HTTP-level tests that exercise real endpoints and boundaries
(`backend/src/test/kotlin/...`):

| Test | What it asserts |
|---|---|
| `governance/GovernanceRegressionTest.kt` | Suspension 401 (session+refresh), SCHOOL_ADMIN scoping, ADMIN-only overview, structured 401/403 |
| `analytics/GuardianAnalyticsAuthorizationTest.kt` | Guardian sees only linked wards |
| `institution/MultiTenantAuthorizationTest.kt` | Cross-institution denial |
| `institution/StaffManagementApiTest.kt` | Tenant staff CRUD boundaries; ADMIN untouchable |
| `content/ContentAuthorizationTest.kt`, `mastery/MasteryAuthorizationTest.kt`, `support/SupportAuthorizationTest.kt` | Role/scope boundaries |
| `auth/AuthAndInputSecurityTest.kt` | Authentication/input security |

**Not covered by any test:** audit-event emission for the operations above
(there is no audit assertions anywhere). No test asserts that a privileged read
or a CSV import produces a record.

> **Tests were not added this sprint.** Section 4 of the brief permits adding
> tests *"only after identifying gaps and confirming the intended policy."* No
> audit policy is approved (see the decision register), so adding assertions
> now would encode an unapproved policy. The gap is documented instead.

## 5. Confirmed vs unverified

**Confirmed (code-evidenced):**
- Authorization is enforced server-side; no bypass found.
- Audit coverage is PARTIAL (§2 matrix); the missing categories are enumerated.
- Audit is asynchronous, failure-tolerant, pruned to 90 days, and read-unaudited.
- `USER_LOGIN_FAILED` queries exist with **no writer** → dead counter.
- CSV import is unaudited.

**Unverified / needs confirmation:**
- Whether specific privileged reads *must* be audited for regulatory reasons
  (policy — decision register Q-series).
- Whether the 90-day retention is acceptable for incident forensics.
- Whether `detail` free-text PII is acceptable or must be structured/redacted.

## 6. Prioritized remediation plan

**P0 (before handling real learner data / real money):**
1. Add provider **signature verification** for the M-Pesa callback (see
   integration report) — an unauthenticated, unaudited state-changing endpoint.
2. Add a **durable, same-transaction audit row** for sensitive admin writes that
   today only hit SLF4J (manual payments; and a decision on CSV import).

**P1 (before a multi-school pilot):**
3. Audit **privileged reads**: platform/institution analytics, rosters, audit-log
   access.
4. Audit **CSV import** (bulk learner/guardian creation + credential handover).
5. Make audit writes **fail-visible** (or use an outbox) rather than silently
   swallowing failures; ensure the row is durable before responding to a
   sensitive write.
6. Record **authentication success/failure** (or delete the dead counter).

**P2 (hardening):**
7. Structured audit columns (institution_id, target_id, outcome) instead of
   free-text `detail`; define a PII policy for `detail`.
8. Audit-read auditing and export auditing.
9. Revisit retention vs. forensic needs.

## 7. Evidence index

- Authorization: `config/SecurityConfig.kt`, all `*Controller.kt` `@PreAuthorize`
  annotations, `institution/StaffManagementService.kt`,
  `institution/InstitutionController.kt`.
- Audit: `common/AuditLogService.kt`, `common/AuditLogService.kt#purgeOldAuditLogs`,
  `config/AppConfig.kt` (`@EnableAsync`, `@EnableScheduling`),
  `db/migration/V1__baseline_schema.sql#L162` (`audit_logs`).
- Call sites: `TutorService`, `StaffManagementService`, `BillingController`,
  `DeviceController`, `ExamService`, `CurriculumController`.
- Bulk: `institution/InstitutionService.kt#L145`.
- Payments: `payments/MpesaService.kt`, `payments/MpesaController.kt`,
  `finance/FinanceService.kt#L380`.
