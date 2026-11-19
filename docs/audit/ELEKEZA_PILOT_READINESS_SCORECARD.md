# ELEKEZA — PILOT READINESS SCORECARD

**Date:** 14 Nov 2026 · **Branch:** `sprint-3-safe-config` @ `47d17f5`
**Verdict: NOT READY for external pilot. Ready for continued internal testing only.**

The blocker is not code quality — the backend is genuinely solid. The blocker is that **three P0 items protect children's data and none of them is closed**, and one of them (open registration of minors with no consent) is a structural hole rather than a missing polish item.

---

## 1. Three distinct stages — do not blur them

| Stage | Definition | Gate |
|---|---|---|
| **S1 — Internal testing** | Team only; synthetic/demo data; no external user | **PASSING TODAY** |
| **S2 — Controlled external pilot** | 1–3 named schools, real or consented staff, learners only with guardian consent under an executed agreement | **BLOCKED** (3 × P0) |
| **S3 — Unrestricted public launch** | Anyone can sign up and pay | **BLOCKED** (P0 + P1 + commercial metering) |

Everything below is about S2.

---

## 2. Acceptance criteria scorecard

| # | Criterion (from the brief) | Status | Evidence / gap |
|---|---|---|---|
| 1 | Reliable authentication | **PASS** | JWT + rotated hashed refresh tokens, suspension cuts both legs, rate-limited login, 357/357 backend tests. Caveat SEC-P1-03 (proxy-keyed limiter) |
| 2 | Correct role permissions | **PARTIAL** | Mid-hierarchy (teacher/guardian/school-admin/student) is well enforced and tested. **Top is missing**: no `SUPER_ADMIN`, no national role; `ADMIN` is all-powerful (SEC-P1-01) |
| 3 | Secure data isolation | **PASS in code** | `MultiTenantAuthorizationTest`, `GuardianRelationshipTest`, institution scoping from the principal only. Not adversarially tested against a live host |
| 4 | Functional onboarding | **FAIL** | No guardian registration or child-linking path (FUNC-P1-01); no age/consent flow (SEC-P0-01); no admin provisioning procedure |
| 5 | Working navigation | **FAIL** | 11 routes with no shell; two contradictory learner sidebars; five dead admin nav targets (FUNC-P1-03/04/05) |
| 6 | Responsive interfaces | **NOT VERIFIED** | Code structure is reasonable (mobile bottom nav, safe-area insets); **no device or viewport run** |
| 7 | Accessible core workflows | **PARTIAL** | axe gate green on 7 routes at WCAG 2.1; 54 routes unscanned; TTS on one page; no manual AT pass |
| 8 | Reliable student learning | **PASS** | Lesson→quiz→review→progress evidenced by `journey.spec.ts` + 38/38 E2E |
| 9 | Parent progress monitoring | **PASS where linked** | `/guardian`, wards, reports, digest functional; but a parent cannot join without a school |
| 10 | Teacher workflows | **PASS with defects** | Content, assignments, exams, attendance, messaging work; attendance has no shell; lesson plans/schedule don't persist |
| 11 | School administration | **PARTIAL** | Staff CRUD + CSV import + finance exist; **all render without a shell and none is covered by any automated test** |
| 12 | Secure document handling | **PARTIAL** | Extension allowlist + size + sanitisation present; **no content sniffing, no malware scan, local disk, no retention policy** (SEC-P1-04) |
| 13 | Appropriate child safeguarding | **FAIL** | No age gate, no parental consent, no DPA artefacts (SEC-P0-01/02) |
| 14 | Tested backend and frontend | **PARTIAL** | Backend 357/357 (excellent); frontend 20 tests for 61 routes (inadequate); no admin-role E2E |
| 15 | Working database migrations | **PARTIAL** | V1–V19 + Flyway + `ddl-auto: validate` correct; **never verified against real PostgreSQL** (DEP-P1-03) |
| 16 | Documented deployment configuration | **PARTIAL** | Compose, nginx, TLS template, scripts all exist; nothing deployed; 4 shipping defects (DEP-P0-01, DEP-P1-01) |
| 17 | Backup and recovery | **PARTIAL** | Scripts exist; no schedule, no off-site target, drill not re-run |
| 18 | Monitoring and incident handling | **FAIL** | No Sentry, no uptime check, no alerts, no runbook, no on-call (DEP-P1-02) |

**Score: 4 PASS · 9 PARTIAL · 4 FAIL · 1 NOT VERIFIED (of 18).**

---

## 3. Blocking issues (P0) — none may remain open for S2

| ID | Issue | Why it blocks |
|---|---|---|
| **SEC-P0-01** | No age gate, no parental consent, no DOB on open registration | Lawful-basis failure for a service aimed at 7–16-year-olds. Not fixable by config. |
| **SEC-P0-02** | No privacy policy, DPIA, retention schedule, DSAR/erasure procedure | Cannot process real child data without accountability artefacts. |
| **SEC-P0-03** | Demo super-admin/school-admin accounts seeded by default on the base profile | A misconfigured profile ships a platform admin with a published password. |

---

## 4. What S2 additionally requires (P1)

1. **Guardian self-service** — registration + code-based child linking (FUNC-P1-01). Without this the pilot is a school tool, not a home-learning platform.
2. **One application shell** across all 61 routes (UX-P1-01 / FUNC-P1-05) and one nav per role (FUNC-P1-03).
3. **Learner document ownership** — the `/upload` 403 must stop being reachable (SEC-P1-05).
4. **Upload hardening** — content sniffing, malware-scan strategy, object storage, retention (SEC-P1-04).
5. **Monitoring + incident runbook** (DEP-P1-02).
6. **Admin-role test coverage** — E2E fixtures for `SCHOOL_ADMIN` and `ADMIN` (TEST-P1-01).
7. **Role split at the top** — at minimum separate `SUPER_ADMIN` from operational admin (SEC-P1-01), otherwise a pilot school's admin account is one bug away from platform-wide access.
8. **Real-PostgreSQL migration verification** (DEP-P1-03).
9. **AI usage metering** — both a security control and the precondition for any free tier (SEC-P2-05, commercial §5).

---

## 5. What a *good* S2 looks like

- 1–3 schools, named in a written agreement, with a data-processing agreement referencing the DPIA.
- **Synthetic learner data** in the pilot tenant for the first two weeks, so that software and process failures teach you something without touching a child's record.
- Real guardian consent collected through the app before any real learner data is entered.
- A single named on-call person and a phone number the pilot head teacher can call.
- A weekly defect review against the remediation backlog, with P0/P1 fix timeboxed.
- An exit review that is **allowed to say no** to widening the pilot.

---

## 6. Honest assessment of the team's own claims

The existing gate matrix (`ELEKEZA_RELEASE_GATE_MATRIX.md`, 8 Nov) is unusually honest — it already records `Data protection — FAIL/BLOCKED`, `Mobile — NOT TESTED on device`, `AI usage quotas ABSENT`. This audit **confirms** those and adds four it did not capture:

1. The demo-seed default inversion (SEC-P0-03).
2. The 11 shell-less routes as a structural (not cosmetic) defect.
3. The absence of any guardian self-registration path.
4. The frontend/admin test desert.

Nothing in the repo was found to overstate readiness. That is worth preserving as a habit: the temptation at pilot time is to relabel PARTIAL as PASS.

---

## 7. The single question that decides S2

> Can a parent who is not already inside a school's system create an account, link their child safely, and watch that child learn?

Today: **no** — and it is blocked by three separate things at once (no guardian registration, no consent framework, no self-service linking). That is the gap between "an impressive school tool" and "inclusive education infrastructure".
