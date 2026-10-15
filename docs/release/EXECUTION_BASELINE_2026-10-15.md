# Elekeza — Execution Baseline

**Date:** 2026-10-15
**Prepared by:** Technical Lead / Release Manager
**Status:** VERIFIED — captured live at 2026-10-15 15:32 +03:00
**Purpose:** Establish the actual, current state of the Elekeza workspace before
any release, push or further code change.

---

## 1. Workspace

| Item | Value | Verified |
|---|---|---|
| Project root | C:\Users\thrillerpark\Desktop\Flagship Projects\Elekeza | yes |
| Backend | Kotlin / Spring Boot (Gradle 8.14.4, JDK 21.0.9 Temurin) | yes |
| Frontend | Next.js PWA (Node v24.19.0, npm 11.14.1) | yes |
| AI service | FastAPI (Python 3.14.4) | yes |
| Database | PostgreSQL 15 (port 5433) | yes |
| Backend port | 8097 — LISTENING (java, pid 49932) | yes |
| Frontend port | 3100 — LISTENING (node, pid 45296) | yes |
| AI port | 8001 — LISTENING (python, pid 40640) | yes |
| PostgreSQL port | 5433 — LISTENING (postgres, pid 7412) | yes |
| Free disk (C:) | 2.74 GB of 237.46 GB — TIGHT | yes |

---

## 2. Git state

| Item | Value |
|---|---|
| Current branch | feat/elekeza-pilot-completion |
| HEAD at capture | 4b36613 (196 commits) |
| HEAD after audit fixes | 05b31af |
| HEAD after this session | 7a7edd6 |
| Remote | https://github.com/AD-Group-Africa/elekeza.git (origin) |
| Upstream | origin/feat/elekeza-pilot-completion |
| Ahead / behind at capture | 0 / 0 |

### 2.1 Commits added this session

| SHA | Subject |
|---|---|
| 05b31af | fix(security+analytics): close P0 suspension bypass and P1 cross-tenant analytics leak; add governance audit |
| ec23b63 | test(e2e): refresh full journey evidence 2026-10-15 |
| 7a7edd6 | docs(release): capture baseline raw output for 2026-10-15 |

### 2.2 Historical checkpoints

| Item | Value |
|---|---|
| Previous exhibition RC | 4b36613 / tag v0.1.0-exhibition-rc4 |
| Earlier release branch | release/v0.1.0 |
| Earlier checkpoint | b0b4906 / tag v0.1.0-exhibition-rc3 |
| Prior safety tag | safety/pre-pilot-2026-10-13 |
| Newest pilot tag | v0.1.0-pilot-r2 |

### 2.3 Stashes (do not clean without owner approval)

- stash@{0} — On integration/staging-reconciliation: Elekeza reconciliation WIP
- stash@{1} — filter-branch: rewrite
- stash@{2} — WIP on staging: d755f52 deploy: add pre-built jar for Railway
- stash@{3} — On staging: gradle build artifacts

---

## 3. Session code changes (commit 05b31af)

| File | Change | Reason |
|---|---|---|
| backend/.../security/JwtAuthFilter.kt | Reject JWTs for inactive users | P0 — suspended session reuse |
| backend/.../auth/AuthController.kt | Refresh leg rejects inactive users | P0 — refresh minted full-role token for suspended account |
| backend/.../analytics/AnalyticsController.kt | Scope SCHOOL_ADMIN to own institution; key platform-wide on role ADMIN; count scoped guardians via active links | P1 — cross-tenant analytics leak |
| backend/.../notification/MessageController.kt | Include sender's own leg in thread | EL-NEW-02 follow-up |
| backend/.../notification/NotificationService.kt | findBySenderIdInOrderByCreatedAtDesc added | EL-NEW-02 follow-up |
| docs/AUDIT_2026-10-15_FINAL_PILOT_READINESS.md | New, 214 lines — governance section J | Audit deliverable |

---

## 4. Services and health

| Check | Result |
|---|---|
| GET http://localhost:8097/api/auth/csrf | 200 |
| GET http://localhost:8097/api/health | 401 (by design — auth-gated) |
| GET http://localhost:3100/ | 200 |
| GET http://localhost:8001/health | 200 |

---

## 5. Database

| Item | Value |
|---|---|
| Flyway on disk | V1 → V17 messaging_sender |
| Flyway applied (scratch DB) | V17, V16, V15, V14, V13 all success = t |
| Scratch DB | elekeza_chain_scratch |

### 5.1 Scratch fixture

| Role | Count |
|---|---|
| ADMIN | 1 |
| SCHOOL_ADMIN | 9 |
| TEACHER | 10 |
| STUDENT | 8 |
| GUARDIAN | 7 |
| Total users | 35 |
| Institutions | 9 |

---

## 6. Roles and permissions

Enum: STUDENT, TEACHER, GUARDIAN, ADMIN, SCHOOL_ADMIN.

- No SUPER_ADMIN.
- No national / county / sub-county / curriculum / SEN / inspector roles.
- No geographic columns on institutions. country_configs is deployment config.
- ADMIN = platform role, keyed on role not on institutionId (V16 seeds superadmin@elekeza.app with institutionId=1).

See companion: docs/architecture/ELEKEZA_ROLE_AND_SCOPE_MATRIX.md.

---

## 7. Test evidence

### 7.1 Freshly verified — 2026-10-15

| Suite | Result |
|---|---|
| Backend full regression post-fix | BUILD SUCCESSFUL, exit 0 |
| Adversarial T1 cross-tenant roster/staff/import | 403 |
| Adversarial T5 audit/overview/revenue as SCHOOL_ADMIN | 403 |
| Adversarial T6 cross-family ward (4 routes) | 403 x4 |
| Adversarial T7 teacher out-of-scope learner | 403 |
| Adversarial T8 learner cross-progress | 403 / 404 |
| Adversarial T9 JWT tamper | 401 |
| Adversarial T10 suspended session reuse | FIXED — 401 (was 200) |
| Adversarial T10 refresh for suspended account | FIXED — 401 (was 200) |
| Adversarial T4 cross-tenant analytics | FIXED — scoped |
| Adversarial T12 link-revocation lifecycle | code-verified |
| Frontend vitest | 20/20 (historical — frontend untouched) |
| TypeScript tsc | clean (historical — frontend untouched) |

### 7.2 Not tested / not testable

| Item | Classification |
|---|---|
| Adversarial cases 2/3/4/5 (sub-county, county, national, AD support) | NOT IMPLEMENTED — no such roles |
| Load / fixture growth beyond 35 users | UNTESTED |
| Live Daraja | NOT CONFIGURED |
| Production Core Web Vitals | NOT MEASURED |

---

## 8. Performance baseline

Fixture: 35 users, 7 guardian_links, 9 institutions, 3 payments.

| Endpoint | Warm latency | Note |
|---|---|---|
| Scoped SCHOOL_ADMIN analytics | 24-35 ms | full-table filter scan |
| Platform ADMIN analytics | 20-35 ms | full-table filter scan |
| Staff roster | 20-25 ms | tenant-scoped |
| First-hit JIT spikes | 88-208 ms | labelled honestly |

Scale flag: both scoped analytics queries use full-table filter scans.
Marked for findByInstitutionId-style rewrite before multi-school growth.
No index added — pending larger measured fixture.

---

## 9. Secret hygiene

| Item | Result |
|---|---|
| .env tracked in git? | Only .env.example files — clean |
| .env on disk (untracked, correctly ignored) | ai-elewa/.env, backend/.env, frontend/.env, frontend/.env.local |
| *.pem / *.key / id_rsa* in tracked tree | None |

---

## 10. Blockers

| ID | Blocker | Severity | Owner | Next |
|---|---|---|---|---|
| B1 | Daraja production credentials + callback signature scheme | P0 (release gate) | Owner + backend | Complete MPESA_GO_LIVE_CHECKLIST.md |
| B2 | Dev-seed demo credentials still live | P0 (release gate) | Owner | Rotate before any non-local env |
| B3 | Governance-hierarchy spec not approved | P0 (release gate) | Owner | Review ELEKEZA_ROLE_AND_SCOPE_MATRIX.md |
| B4 | Free disk 2.74 GB | Infra | Operator | Free space before next clean build |

---

## 11. Overall classification

CONDITIONALLY READY — with three release gates: B1 Daraja, B2 credential
rotation, B3 governance spec approval.

Not "READY FOR STAGING". Not "READY FOR PRODUCTION". A green build is not a
production integration.

---

## 12. Next

1. Push branch (Phase C, this session).
2. Approve role-and-scope matrix (B3).
3. Begin Phase B — integration audit, guardian messaging re-verify, M-Pesa checklist.
