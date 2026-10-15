# Elekeza — Role and Scope Matrix

**Date:** 2026-10-15
**Status:** PROPOSED — closes release gate B3 on owner approval. Not implemented.
**Authority:** Master prompt section 5.2; Additional Audit section 1.

**Rule:** No new privileged roles, no migrations, no dashboards until this is
approved. This document describes what exists and what is proposed. It does
not authorise building either.

---

## 0. Exists vs proposed

| Layer | Status |
|---|---|
| Platform role enum (STUDENT...SCHOOL_ADMIN) | IMPLEMENTED |
| Tenant isolation (institution-scoped access) | IMPLEMENTED |
| Platform admin (ADMIN role) | IMPLEMENTED (partial — see 1.5) |
| Geographic hierarchy (county / sub-county / national) | NOT IMPLEMENTED |
| Education-official roles | NOT IMPLEMENTED |
| Afrika Digitalis operations support role | NOT IMPLEMENTED |
| Curriculum / SEN / inspector specialists | NOT IMPLEMENTED — not yet justified |
| Approvals workflow (institution lifecycle etc.) | PARTIAL |

---

## 1. Implemented roles

### 1.1 STUDENT

| Field | Value |
|---|---|
| Purpose | Own learning experience |
| Permitted scope | Own records; own assigned content |
| Read | Own progress, assignments, own messages |
| Write | Own submissions / activity events |
| Sensitive data | Own only |
| Export rights | None |
| Approval required | N/A |
| Audit events | Learning activity events |

### 1.2 TEACHER

| Field | Value |
|---|---|
| Purpose | Deliver learning; manage assigned classes |
| Permitted scope | Assigned classes and learners within own institution |
| Read | Class rosters, learner progress, messages |
| Write | Assignments, grades, messages to guardians of assigned learners |
| Sensitive data | Assigned learners only |
| Export rights | None by default |
| Approval required | Class assignment by school admin |
| Audit events | Grade changes, message sends |

Adversarial T7: teacher cannot modify out-of-scope learner — 403.

### 1.3 GUARDIAN

| Field | Value |
|---|---|
| Purpose | Support linked learners |
| Permitted scope | Only linked learners via guardian_links |
| Read | Linked learner progress, attendance, fees, messages |
| Write | Messages to authorised school staff |
| Sensitive data | Linked learners only |
| Export rights | None |
| Approval required | N/A — link is the authorisation |
| Audit events | Message sends |

Adversarial T6: guardian blocked from other families on 4 routes — 403 x4.

### 1.4 SCHOOL_ADMIN

| Field | Value |
|---|---|
| Purpose | Operate a single school |
| Permitted scope | Own institution only |
| Read | Full roster, staff, classes, learner records within institution |
| Write | Staff create/suspend, class management, institution-scoped config |
| Sensitive data | Own institution |
| Export rights | Institution-scoped exports only |
| Approval required | None for routine; institutional changes may need platform approval |
| Audit events | Staff create/suspend, exports, config changes |

Adversarial T1: cross-tenant roster / staff / import — 403.
Former P1 defect (platform-wide analytics leak) — FIXED.

### 1.5 ADMIN (platform)

| Field | Value |
|---|---|
| Purpose | Operate the platform / Afrika Digitalis internal ops |
| Permitted scope | Platform-wide for operational functions |
| Read | Platform status, institutions list, audit log, revenue, aggregates |
| Write | Institution lifecycle, feature flags, admin provisioning |
| Sensitive data | Must not default to unrestricted access to learner / disability / family / payment data |
| Export rights | Platform exports — purpose-limitation review required |
| Approval required | For sensitive-record access — not yet modelled |
| Audit events | All privileged actions logged (read = ADMIN-only, 90-day retention) |

Gap: "ADMIN" conflates platform operator with education oversight.
The audit's rule stands: do not confuse platform Superadmin authority with
statutory education authority.

Finding: superadmin@elekeza.app is ADMIN with institutionId=1 (V16 seed).
Platform scoping must key on role, not on null institution. The analytics
fix honours this.

---

## 2. Proposed roles — NOT implemented, pending approval

Conceptual only. Do not build until product requirements are agreed and B3
is signed.

### 2.1 Platform SUPERADMIN (separate from ADMIN)

| Field | Value |
|---|---|
| Purpose | Restricted internal platform operations |
| Permitted scope | Platform operations — least privilege |
| Read | Platform health, integration health, audit logs |
| Write | Deployment/config; institution lifecycle with approval |
| Sensitive data | No default access to learner/disability/family/payment records |
| Export rights | None by default |
| Approval required | For any sensitive-record access |
| Audit events | Mandatory — actor, timestamp, target, outcome, scope, reason |

Prohibited: hardcoded universal password; public registration; hidden
frontend-only privilege.

### 2.2 Afrika Digitalis operations / support role

| Field | Value |
|---|---|
| Purpose | Technical support, monitoring, deployment admin |
| Permitted scope | Operational telemetry; not learner records |
| Read | Service health, error logs (no PII), deployment diagnostics |
| Write | Diagnostics, ticket resolution |
| Sensitive data | None — support to sensitive records via audited approval only |
| Export rights | None |
| Approval required | Explicit grant + reason |
| Audit events | All privileged actions |

### 2.3 National education official

| Field | Value |
|---|---|
| Purpose | National-level aggregated oversight |
| Permitted scope | Aggregated, de-identified reporting |
| Read | Approved aggregate reports |
| Write | None |
| Sensitive data | Only where explicitly authorised — audited |
| Export rights | De-identified only, jurisdiction-scoped |
| Approval required | Purpose + scope + expiry |
| Audit events | Every export; every privileged read |

### 2.4 County education official
Same shape as national, scoped to assigned county.

### 2.5 Sub-county education official
Same shape, scoped to assigned sub-county.

### 2.6 Official lifecycle
- Explicit assignment: actor, scope, effective date, expiry.
- Reassignment revokes former scope (T12 code-verified for links; not for
  geographic scope — not implemented).
- Revocation must invalidate live sessions (enforced globally via
  user.active after P0 fix).

### 2.7 Specialists
NOT created. Audit rule: only where requirements justify. No justification
recorded yet.

---

## 3. Sensitive-data rules (all roles)

1. Least privilege — no role gets platform-wide learner data by default.
2. Purpose limitation — disability/family/payment data requires a named purpose.
3. Attributable actions — logged with actor, timestamp, target, outcome, scope.
4. Audit-log integrity — protected against unauthorised modification
   (write-integrity not yet reviewed).
5. Export parity — exports apply the same permissions as on-screen views.
6. Small-group protection — aggregates must not expose individuals through
   small counts.
7. Denial at backend — hidden button is not access control.

---

## 4. Adversarial test coverage

| # | Test | Status |
|---|---|---|
| 1 | School admin to other school | pass 403 |
| 2 | Sub-county to out-of-area | NOT IMPLEMENTED |
| 3 | County to other county | NOT IMPLEMENTED |
| 4 | National to platform op | NOT IMPLEMENTED |
| 5 | AD support to sensitive records | NOT IMPLEMENTED |
| 6 | Guardian to other family | pass 403 x4 |
| 7 | Teacher to out-of-scope learner | pass 403 |
| 8 | Learner to other progress | pass 403/404 |
| 9 | JWT / cookie / payload tamper | pass 401 |
| 10 | Suspended / revoked session reuse | pass FIXED (P0) |
| 11 | Export broadening | pass no broadening path found |
| 12 | Reassignment revokes former access | pass code-verified for links |

---

## 5. Governance journeys — classification

| # | Journey | Status |
|---|---|---|
| 1 | AD operator health check without learner data | Partially implemented |
| 2 | National official to aggregated report | NOT IMPLEMENTED |
| 3 | County official to county report | NOT IMPLEMENTED |
| 4 | Sub-county official to sub-county report | NOT IMPLEMENTED |
| 5 | School admin to own school | Implemented and verified |
| 6 | Teacher to assigned classes | Implemented and verified |
| 7 | Guardian to linked learners | Implemented and verified |
| 8 | Learner to own experience | Implemented and verified |
| 9 | Privileged user cross-scope denied | Implemented and verified |
| 10 | Revoked official loses access promptly | Implemented and verified |
| 11 | Export limited to scope and recorded | Partially implemented |
| 12 | Support access via approved path | NOT IMPLEMENTED |

---

## 6. What this authorises

Nothing. Documentation. Implementation requires:
- Owner approval (release gate B3).
- Per-role scoping ticket justified by product requirement.
- Migration design reviewed before execution.
- Adversarial tests extended per role before release.

---

## 7. Sign-off

| Role | Name | Date | Decision |
|---|---|---|---|
| Owner | __________________ | __________ | Approved / Changes requested |
| Technical Lead | __________________ | __________ | Approved / Changes requested |
