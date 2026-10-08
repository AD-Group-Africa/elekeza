# ELEKEZA — DOMAIN MODEL

> Canonical data-model reference. Schema is owned by **Flyway migrations V1–V16** (`ddl-auto=validate`
> in prod — Hibernate boot fails on any entity↔schema drift, which doubles as a full consistency check).

## 1. Identity model

**One `users` table, role-discriminated.** There are exactly five roles:
`STUDENT, TEACHER, GUARDIAN, ADMIN, SCHOOL_ADMIN` (`auth/UserRole.kt`).

- Public self-registration creates **STUDENT only** (server-hardcoded; no escalation path).
- Institution registration creates the institution + its `SCHOOL_ADMIN`.
- Staff creation (`POST /api/institutions/{id}/staff`) creates TEACHER etc. with a one-time temp
  password returned **once** in the create response (fix r2: populated only there, not on re-list).
- Platform `ADMIN` is assigned operationally, never self-service.
- Legacy UUID `learners`/`guardians` tables (V1) coexist with the `users(id)` identity — known debt
  (`guardian_links.learner_id` → `users`; `guardians.learner_id` → legacy `learners`). Not an
  integrity defect; consolidation is future work.

## 2. Core entities

| Area | Entities | Key relations / notes |
|---|---|---|
| Identity | `User`, `RefreshToken` (SHA-256 hashed, rotated) | `users.institution_id` = deliberate soft reference (no FK) — isolation enforced in services, tested |
| Institution | `Institution` | FK root for tenancy; plan fields exist (no billing engine) |
| People | `GuardianLink` (guardianId ↔ learnerId, `relationship` ∈ PARENT/CAREGIVER/OLDER_SIBLING/LEGAL_GUARDIAN/OTHER) | one learner → many guardians, one guardian → many learners; normalized from CSV free text |
| Content | `Content` (+ raw text), `LessonSection`, `KeyTerm` | teacher-owned; `ContentAccessGuard` = institution/ownership/assigned-progress rule |
| Quiz | `Quiz`, `QuizQuestion`, `QuizAttempt`, `QuizAnswer` | answer key never returned while answering; attempts unique per user+quiz (409 on duplicate); server-side scoring only |
| Progress | `LessonProgress` (unique user+content) | updated in the same transaction as quiz completion; FKs CASCADE |
| Personalization | `LearnerProfile.preferences` JSONB (source-labelled entries), `ContentAdaptation` (unique learner+content+code + source hash), `AdaptationEvent` | learner-scoped cache; events append-only |
| Accessibility | `AccessibilityProfile` (ttsEnabled etc.) | server mirror of learner prefs |
| Notifications | `Notification` (userId, type, title, body, read, link) | **this table is also the messages store** — see known defect below |
| Payments | `MpesaTransaction` (merchantRequestId+checkoutRequestId, state machine), finance `Payment`/`Charge` | callback idempotent, amount-bound, terminal states final |
| Support | `SupportFlag`, `Intervention`, `Deadline` | learner_id FK → users CASCADE |
| Calendar | timetable/schedule entities | school ops |
| Audit | `audit_log` (via AuditLogService) | admin-readable |

## 3. Tenant isolation

Shared database, shared schema, `institution_id` scoping on tenant-owned entities. Every scoped call
re-derives tenancy **server-side** (client-supplied IDs never trusted): `findByInstitutionIdAndRole`,
`ContentAccessGuard.requireContentAccess`, guardian-link checks, class-session authorization.
Verified by automated suites (`MultiTenantAuthorizationTest`, `GuardianAnalyticsAuthorizationTest`,
`ContentAuthorizationTest`, `SupportAuthorizationTest`, personalization suites) and live two-
institution IDOR probes (roster read/import, profiles, adaptations, wards — all 403).

## 4. Migrations

- Flyway `V1__baseline_schema.sql` … `V16__fix_demo_admin_institution.sql`; append-only; verified
  from a clean database this engagement (backend test boot) and in prior audits (fresh PG 16 twice).
- `V2__seed_demo.sql` is **gated by `DEMO_SEED_ENABLED`** — prod boots with `users = 0` (verified).
- `V16` fixes demo-admin institution linkage.
- Never edit an applied migration; ship `V17+` forward-only.

## 5. Data integrity (verified)

- Restore drill (`scripts/db-restore-drill.sh`) **PASSED** this engagement: dump → disposable DB →
  core-table checks + Flyway history → drop.
- DB audit: **zero orphaned rows, zero duplicates** on the scratch instance.
- Cascades: lesson_progress/support rows CASCADE on user delete; guardian links handled explicitly.
- Known integrity notes: `users.institution_id` soft reference (deliberate); legacy dual learner
  identity (debt); per-learner deletion workflow **not implemented** (MUST-HAVE before scale beyond
  one pilot cohort — documented in DATA_GOVERNANCE rules below).

## 6. Data governance & child-data rules (binding)

- Learner PII = emails, names, phones, guardian relationships; access strictly role-scoped.
- Disability-related fields (`sneType`, cognitive profiles) are **support needs, never diagnoses**;
  never surfaced to other learners; never used by AI as labels (personalization AI path sends a
  neutral context).
- No model training on learner data; no advertising use; no child-level analytics published.
- Retention/deletion: institution cascade exists; **per-learner deletion API is a documented
  must-have before scale** (pilot-phase operational requirement with guardian consent records).
- Backups contain learner PII → encrypt at rest at hosting layer, restrict access, never web-reachable.
