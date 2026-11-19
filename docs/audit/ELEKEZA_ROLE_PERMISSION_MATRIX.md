# ELEKEZA — ROLE & PERMISSION MATRIX

**Date:** 14 Nov 2026 · **Branch:** `sprint-3-safe-config` @ `47d17f5`
**Method:** enumeration of `UserRole`, every `@PreAuthorize` in `backend/src/main/kotlin`, every `hasAnyRole` rule in `SecurityConfig`, and every role branch in the frontend shells.

---

## 1. What exists today

`backend/src/main/kotlin/com/elekeza/backend/auth/UserRole.kt`:

```kotlin
enum class UserRole { STUDENT, TEACHER, GUARDIAN, ADMIN, SCHOOL_ADMIN }
```

**Five roles. No `SUPER_ADMIN`. No national/government role. No scoped-permission model.**

Scoping is achieved not by role but by a nullable `institutionId` on `User` plus runtime checks inside controllers:

| Mechanism | Where |
|---|---|
| Institution scoping | `institutionId` on `User`; controllers compare against the principal, never against request input |
| Guardian→learner scoping | `guardian_links` filtered by `currentlyActive()` |
| Role gate (coarse) | `SecurityConfig` filter rules + `@PreAuthorize` per endpoint |
| Suspension | `User.active`, re-checked in `JwtAuthFilter` and on refresh |

---

## 2. Required hierarchy vs actual

| Required role | Exists? | Mapped to | Consequence |
|---|---|---|---|
| Super Administrator (platform ownership) | **NO** | `ADMIN` doubles as this | A single role holds platform-wide power with no separation from operational admin |
| Platform Administrator (operations) | **NO** | `ADMIN` | Cannot delegate operations without granting super-admin |
| National / Government Administrator | **NO** | — | `/government` is a `ComingSoon` placeholder; no role, no data path, no scoping |
| School Administrator | **YES** | `SCHOOL_ADMIN` + `institutionId` | Correct and well-enforced |
| Teacher | **YES** | `TEACHER` + `institutionId` | Correct |
| Parent / Guardian | **YES** | `GUARDIAN` + `guardian_links` | Correct scoping; **no self-registration path** |
| Student | **YES** | `STUDENT` | Correct; **no age gate** |

**Verdict:** the middle of the hierarchy is solid; both **ends** are missing. Least privilege is structurally impossible at the top because `ADMIN` is the only privileged role and it is all-powerful; and the government tier the brief asks for has no representation at all.

---

## 3. Endpoint permission matrix (as enforced in code)

Legend: ✔ allowed · — denied · **scope** = further restricted to own institution/learner.

| Endpoint group | STUDENT | TEACHER | GUARDIAN | SCHOOL_ADMIN | ADMIN | Notes |
|---|---|---|---|---|---|---|
| `POST /api/auth/register` | ✔ (creates STUDENT) | ✔ | ✔ | ✔ | ✔ | **Role is always STUDENT** regardless of caller |
| `POST /api/auth/login` / `refresh` / `logout` | ✔ | ✔ | ✔ | ✔ | ✔ | Rate-limited (see SEC-P1-03) |
| `GET /api/auth/me` | ✔ | ✔ | ✔ | ✔ | ✔ | |
| `POST /api/payments/callback` | ✔ | ✔ | ✔ | ✔ | ✔ | permitAll by necessity; payload-verified |
| `/api/analytics/teacher/**` | — | ✔ scope | — | ✔ scope | ✔ | |
| `/api/analytics/admin/**` | — | — | — | ✔ | ✔ | Platform overview |
| `/api/analytics/guardian` | — | — | ✔ scope | ✔ | ✔ | |
| `/api/analytics/student`, `/api/analytics/dashboard` | ✔ scope | ✔ | ✔ | ✔ | ✔ | authenticated + principal-scoped |
| `/api/analytics/**` (other) | — | — | — | — | ✔ | |
| `/api/teacher/**` | — | ✔ scope | — | ✔ scope | ✔ | |
| `/api/guardian/**` | — | — | ✔ scope | ✔ | ✔ | |
| `/api/institutions/**` | — | — | — | ✔ scope | ✔ | |
| `/api/curriculum/tree`, `/learners/**` | ✔ | ✔ | ✔ | ✔ | ✔ | authenticated |
| `/api/curriculum/**` (other) | — | ✔ | — | ✔ | ✔ | |
| `/api/engagement/**` | ✔ | ✔ | ✔ | ✔ | ✔ | authenticated |
| `/api/accessibility-profiles/**` | ✔ | ✔ | ✔ | ✔ | ✔ | authenticated; profile keyed by learnerId |
| `/api/timetable/**` | ✔ | ✔ | ✔ | ✔ | ✔ | authenticated |
| `GET /api/billing/plans`, `/api/countries*` | ✔ | ✔ | ✔ | ✔ | ✔ | **public** read-only catalogue |
| `/api/billing/**` (writes) | — | — | — | ✔ | ✔ | |
| `/api/devices/mine` | ✔ | ✔ | ✔ | ✔ | ✔ | authenticated |
| `/api/devices/**` (other) | — | — | — | ✔ | ✔ | |
| `POST /api/content/upload/file` | **—** | ✔ scope | — | ✔ | ✔ | **Learner upload missing** (SEC-P1-05) |
| `POST /api/guardian/messages` | — | — | ✔ scope | ✔ | ✔ | Recipient must be TEACHER at guardian's institution |
| `POST /api/notifications/send` | — | ✔ scope | — | ✔ | ✔ | CSV recipients, same-institution enforced |
| `GET /api/teacher/messages`, `/guardian/messages` | — | ✔ own | ✔ own | ✔ own | ✔ own | received + own sent leg |
| `/api/mastery/learner/{id}` | ✔ own | ✔ scope | ✔ scope | ✔ | ✔ | |
| Any other `/api/**` | ✔ (authenticated) | ✔ | ✔ | ✔ | ✔ | `anyRequest().authenticated()` |

**Positive observations:** the filter chain does not shadow method-level `@PreAuthorize` (explicitly commented and ordered for analytics/curriculum); `SCHOOL_ADMIN` is separated from cross-tenant access throughout; the client-side `role !== 'ADMIN'` guard on `/super-admin` is backed by a real server check.

**Negative observations:** `ADMIN` appears in *every* allow-list, so there is no endpoint an operational admin cannot reach, and no audit trail of privileged reads. `SCHOOL_ADMIN` is granted `GUARDIAN`, `TEACHER` and `analytics/guardian` access — reasonable operationally, but it means a school admin can read any guardian's message thread at their institution; that should be an explicit, logged "support access" rather than an ambient permission.

---

## 4. Frontend role routing

| Role | Post-login home | Sidebar source | Notes |
|---|---|---|---|
| STUDENT | `/student-home` (asserted by E2E) | `SidebarLayout.studentItems` **or** `Sidebar` depending on page | Contradiction — see FUNC-P1-03 |
| TEACHER | `/teacher` | `SidebarLayout.teacherItems` (15 items) | Consistent |
| GUARDIAN | `/guardian` | `SidebarLayout.guardianItems` (6 items) | Consistent |
| SCHOOL_ADMIN | `/admin` | `SidebarLayout.adminItems` minus `/super-admin` | Consistent |
| ADMIN | `/admin` | `SidebarLayout.adminItems` incl. `/super-admin` | Consistent |

`ROLE_HOME` in `frontend/e2e/helpers.ts` accepts `/(student-home|teacher|admin|guardian|school)/` — note it does **not** accept `/government`, because no such role can log in.

---

## 5. Recommended target model

```
SUPER_ADMIN        platform ownership; break-glass only; every action audited
PLATFORM_ADMIN     operations: tenants, plans, flags, support; cannot read learner content
NATIONAL_ADMIN     scoped to region/ministry; aggregate reporting only; no PII
SCHOOL_ADMIN       scoped to institution_id
TEACHER            scoped to institution_id + assigned classes
GUARDIAN           scoped to active guardian_links
STUDENT            scoped to self
```

Add an explicit scope claim so authorization is decided once:

| Role | Scope | Can read learner PII? | Can mutate other tenants? |
|---|---|---|---|
| SUPER_ADMIN | `platform` | only via audited break-glass | yes, audited |
| PLATFORM_ADMIN | `platform` | **no** | no |
| NATIONAL_ADMIN | `national:<region>` | **no** — aggregates only | no |
| SCHOOL_ADMIN | `institution:<id>` | yes, own institution | no |
| TEACHER | `institution:<id>` + classes | yes, own classes | no |
| GUARDIAN | active links | yes, linked learners | no |
| STUDENT | self | own data only | no |

**Migration caution:** do not `UPDATE users SET role='SUPER_ADMIN' WHERE role='ADMIN'` blindly. Enumerate the `ADMIN` rows, decide per row (the demo `superadmin@elekeza.app` is super; a future ops hire is platform), and record the decision.

---

## 6. Administrator provisioning (currently undefined)

The brief requires controlled provisioning and forbids public super-admin registration. Current state:

- Public registration **cannot** create a privileged account (hard-coded `STUDENT`) — good.
- School admins are created by `/admin/staff`, which validates the requested role against an allowlist and the institution.
- **Platform/national administrators have no provisioning procedure at all.** The only way an `ADMIN` exists today is the demo seed or manual SQL.

**Required:** a documented, audited provisioning path — e.g. a CLI/ops command run by a named operator, producing an `ADMIN` account plus an audit row (`actor`, `target`, `role`, `reason`, `timestamp`), plus MFA for `SUPER_ADMIN`. Until that exists, any production `ADMIN` account is created by hand outside the application, which is neither attributable nor reviewable.

---

## 7. Audit logging of privileged actions

`GovernanceRegressionTest` and the privileged-access audit document show suspension and role changes are considered. What is **not** present: a general, queryable audit trail of privileged reads and writes (who opened which learner's record, who exported what). For a platform holding children's educational records and facing a government-oversight requirement, "administrative actions are recorded and attributable" is a pilot prerequisite, not a later enhancement.
