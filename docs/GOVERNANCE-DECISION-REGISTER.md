# Elekeza — Governance Decision Register (2026-10-16)

**Purpose:** the single register of the **seven** outstanding governance policy
decisions, with options, consequences, recommended defaults, approving
stakeholder, and status. Source of record:
[GOVERNANCE-HIERARCHY-SPEC.md](GOVERNANCE-HIERARCHY-SPEC.md) §10.

**Status vocabulary:** `OPEN` (no recommendation yet) · `PROPOSED` (a
recommended default exists, awaiting approval) · `APPROVED` (signed by an
authorized stakeholder).

> **No decision is marked APPROVED.** Approval requires the founder or an
> explicitly authorized delegate; nothing here has been signed. Recommendations
> are **proposals only**, not existing policy.

**Approving stakeholder (all rows):** Founder / CTO (Harrison Muturi), with
legal/privacy review where noted. **Date opened:** 2026-10-16.

---

## D1 — May education officials ever access identifiable learner data?

| Field | Content |
|---|---|
| **Question** | Do county/sub-county/national officials ever receive identifiable learner records (names, IDs, per-learner results), or only aggregate, disclosure-controlled data? |
| **Why it matters** | This is the single highest-impact privacy decision. It determines whether the oversight layer can ever touch the `users`/learner tables or is hard-constrained to aggregates. |
| **Options** | (a) Never — aggregates only. (b) Only via an audited, approved, time-boxed, minimum-fields workflow. (c) Broad access. |
| **Consequences** | (a) Strongest privacy; needs suppression engineering. (b) Adds an approval/audit subsystem (not built) and a legal basis. (c) High re-identification and breach risk; not recommended. |
| **Recommended default** | **(a) Never by default**; if ever required, only path (b) after legal sign-off. |
| **Status** | **PROPOSED** |
| **Spec section** | §2 (matrix), §6, §9 |

## D2 — Who may assign, reassign, and revoke jurisdiction access?

| Field | Content |
|---|---|
| **Question** | Which role administers `jurisdiction_assignments` (create/revoke/reassign)? |
| **Why it matters** | Whoever controls assignment controls access to aggregate regional data; assign/revoke must be a privileged, audited action. |
| **Options** | (a) Platform ADMIN only. (b) A dedicated governance role. (c) School-level admins. |
| **Consequences** | (a) Simple, reuses existing authz; concentrates privilege in ADMIN (which is seed-only today — see spec §8.1). (b) More roles/migrations, more approval surface. (c) Unacceptable — schools cannot govern regions. |
| **Recommended default** | **(a) Platform ADMIN only**, with every change audited durably. |
| **Status** | **PROPOSED** |
| **Spec section** | §2 rule 2, §7.3, §5 |

## D3 — May reports include school-level breakdowns?

| Field | Content |
|---|---|
| **Question** | May sub-county (and above) officials see per-school breakdowns, or only jurisdiction totals? |
| **Why it matters** | School-level cells in small areas are the most re-identifiable. Granularity directly trades utility against privacy. |
| **Options** | (a) Totals only. (b) School-level **only** with suppression/differencing controls (spec §6). (c) Unrestricted drill-down. |
| **Consequences** | (a) Safest, least useful. (b) Useful if §6 controls are actually built and tested (they are not yet). (c) Unacceptable. |
| **Recommended default** | **(b) school-level aggregates, k-suppressed and differencing-controlled** — conditional on §6 being implemented and tested first. |
| **Status** | **PROPOSED** |
| **Spec section** | §6, §10(3) |

## D4 — Minimum denominator (`kMinDenominator`) value

| Field | Content |
|---|---|
| **Question** | What minimum cell size is used for suppression, and is it treated as a guarantee? |
| **Why it matters** | A threshold alone does not prevent differencing, temporal differencing, small-population, export, or attribute-combination re-identification (spec §6). |
| **Options** | (a) `k=5`, provisional, configurable. (b) Higher (e.g. k=10). (c) No threshold. |
| **Consequences** | (a) Common default; must be combined with complementary suppression. (b) Stronger but suppresses more. (c) Not acceptable. |
| **Recommended default** | **(a) provisional, configurable, and explicitly NOT a guarantee** — to be paired with complementary suppression before any reporting ships. |
| **Status** | **PROPOSED** |
| **Spec section** | §6, §10(4) |

## D5 — Export and retention rules for jurisdiction reports

| Field | Content |
|---|---|
| **Question** | What may be exported, under what authorization/filtering, and how long are reports/audit retained (per country policy)? |
| **Why it matters** | Exports are a classic suppression bypass; retention must satisfy Kenya data-protection expectations without losing incident evidence. |
| **Options** | (a) Exports inherit the dashboard's authz, filtering and suppression; retention per `country_configs`. (b) Separate export path with its own rules. (c) No exports. |
| **Consequences** | (a) Consistent, no bypass; requires shared query builder. (b) High bypass risk. (c) Limits legitimate use. |
| **Recommended default** | **(a) same authorization + filtering + suppression as the dashboard** (no separate "export-all" path). |
| **Status** | **PROPOSED** |
| **Spec section** | §2 rule 6, §10(5) |

## D6 — Effect of jurisdiction revocation on sessions and whole-account status

| Field | Content |
|---|---|
| **Question** | Must a jurisdiction revoke also invalidate sessions/refresh tokens, and does revoking all assignments also suspend the account? |
| **Why it matters** | Revocation latency determines exposure; conflating revoke with account suspension would wrongly deactivate people (spec §5). |
| **Options** | (a) Revoke invalidates sessions immediately; account status **independent** of assignments. (b) Revoke does not touch sessions; rely on short TTL. (c) Revoke auto-suspends the account. |
| **Consequences** | (a) Safest and clearest; session invalidation reuses the existing refresh-revocation path. (b) Up-to-15-min residual access. (c) Unsafe — conflates the two operations. |
| **Recommended default** | **(a): revoke invalidates the official's refresh tokens; account suspension remains a separate operation.** |
| **Status** | **PROPOSED** |
| **Spec section** | §5.3, §5.4, §10(6) |

## D7 — Is an `AD_SUPPORT` role needed for the pilot?

| Field | Content |
|---|---|
| **Question** | Do we introduce a platform support role now, or keep support out of learner data entirely? |
| **Why it matters** | A support role creates a durable, tempting path to learner records; least privilege must be explicit and documented before it exists. |
| **Options** | (a) No support role now — support has no learner-data access. (b) `AD_SUPPORT` with least-privilege, time-boxed, reason-logged, school-visible access (requires the §9 approval subsystem). (c) `AD_SUPPORT` with broad access. |
| **Consequences** | (a) Lowest risk; may slow some support tasks. (b) Requires building the approval/audit subsystem first. (c) Unacceptable. |
| **Recommended default** | **(a) no `AD_SUPPORT` for the pilot**; revisit only with a documented operational need and least-privilege permission set. |
| **Status** | **PROPOSED** |
| **Spec section** | §3, §10(7) |

---

## Approval log

| Decision | Status | Approved by | Date | Reference |
|---|---|---|---|---|
| D1 | PROPOSED | — | — | — |
| D2 | PROPOSED | — | — | — |
| D3 | PROPOSED | — | — | — |
| D4 | PROPOSED | — | — | — |
| D5 | PROPOSED | — | — | — |
| D6 | PROPOSED | — | — | — |
| D7 | PROPOSED | — | — | — |

**Consequence of the open status:** per the specification and the sprint's
implementation gate, **no governance migration, role, dashboard, or oversight
endpoint may be built** until the decisions affecting it are APPROVED. This
register does not authorize any build.
