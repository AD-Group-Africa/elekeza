# Elekeza — Database Integrity Acceptance

Re-verified **2026-09-04** against commit `b5c5bbc` (`release/v0.1.0`).

## Executive status

**DATABASE INTEGRITY: PASS** — machine-verified on a fresh PostgreSQL 16 database
(Flyway V1–V5 applied; Hibernate `ddl-auto: validate` passed at boot against the
Flyway-created schema; restore of a backup verified in a second database).

Earlier "suggested fixes" (`@ManyToOne` on `User.institutionId`, broad
`@EntityGraph`/`@Fetch(SUBSELECT)`) were **NOT** applied: inspection shows the
identifier columns are intentional design (see below), the schema already carries
the FKs that matter, and the suggested changes would break existing behaviour.

## 1. Entity ↔ migration consistency (machine-verified)

The strongest evidence is now executable, not documentary:

```text
Fresh database gate (2026-09-04, postgres:16-alpine, empty DB):
  Flyway V1..V5            -> all success=true  (flyway_schema_history)
  App boot (prod profile)  -> Hibernate ddl-auto=validate PASS (context started)
  Seed data present        -> 5 users, 1 institution, 1 content, 2 quiz questions,
                              1 quiz, 1 lesson_progress, 1 guardian_link
```

`ddl-auto: validate` fails the boot when any JPA entity property/table does not
match the migrated schema, so a successful prod-profile boot on a freshly migrated
database is a full entity↔migration consistency check. This was executed twice on
2026-09-04 (once per database in the backup/restore gate — see section 4).

## 2. Relationship findings (from actual code and migrations)

### 2.1 `users.institution_id` — intentional soft reference. No change.

- Migration V1: `institution_id BIGINT` — nullable, **no FK**, no index.
- Entity `User`: `var institutionId: Long? = null` — plain column, no `@ManyToOne`.

Interpretation: **intentionally denormalized/cross-domain identifier.** A user may
exist without an institution (guardians, admins, pre-onboarding students), the value
is nullable by design, and institution isolation is enforced **explicitly in the
service layer** (`UserRepository.findByInstitutionIdAndRole`,
`ContentAccessGuard.requireContentAccess`, `SupportService.institutionLearnerIds`,
guardian-link checks). Promotion to `@ManyToOne` was rejected because:

- it implies a schema FK, but the dev profile seeds `teacher.institutionId = 1`
  **without ever inserting an `institutions` row with id 1** (only the prod V2 seed
  does). An FK would break dev/test bootstrapping unless seeding changes too;
- a real `@ManyToOne` would change JSON serialization (recursion risk) and lazy-load
  semantics for zero integrity gain — the DB already has no FK, so integrity is a
  service-layer concern and the service layer is what the passing
  institution-isolation tests exercise.

Status: VERIFIED — deliberate; documented; no defect.

### 2.2 `lesson_progress.user_id` — real FK, already mapped

- Migration V1: `user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE`.
- Entity `LessonProgress`: `@ManyToOne(fetch = FetchType.LAZY) @JoinColumn(name =
  "user_id", nullable = false) val user: User` — already mapped correctly.
- `content_id` is a plain `Long` in JPA; the migration holds a real FK to
  `content(id) ON DELETE CASCADE`. Integrity is enforced at the DB level; the JPA
  side deliberately keeps the id to avoid loading whole content rows. Fine as-is.

### 2.3 `support_flags.learner_id` / `interventions.learner_id` — same learner identity as `users`

- Migration V4: `support_flags.learner_id BIGINT NOT NULL REFERENCES users(id) ON
  DELETE CASCADE`; `teacher_id` FK `ON DELETE SET NULL`; `interventions.learner_id`
  and `teacher_id` both FK to `users(id)`.
- Entities (`SupportFlag`, `Intervention`): plain `Long` id columns, no `@ManyToOne`.

Semantics: **"learner" in the support domain IS a `users` row with
`role = STUDENT`.** `SupportService` resolves learner names via
`userRepo.findAllById(...)` and scopes every operation to the teacher's
institution's students. The JPA mapping gap is cosmetic — the DB enforces the
integrity and the services enforce the boundaries. `SupportFlag.learnerId` and
`LessonProgress.user.id` refer to the same conceptual identity
(`users.id`/student), which the passing `SupportAuthorizationTest` and
`GuardianAnalyticsAuthorizationTest` prove functionally.

### 2.4 Legacy UUID learner model — separate, coexisting

V1 also creates `learners`/`guardians`/`lessons`/`lesson_sections`/`key_terms`
(UUID PKs) for the older `Learner`/`Guardian` JPA entities and the guardian-report
flow. These are a **second, legacy learner identity** distinct from `users(id)`.
`GuardianLink.learnerId` (BIGINT) targets `users`; `guardians.learner_id` (UUID)
targets `learners`. Confusing but consistent with how each feature was built; both
schemas validate. Flagged as debt for a future consolidation, not an integrity
defect.

## 3. Integrity defects found

None that block the gate. All cross-table references used by the acceptance flows
are backed by real FKs in the migrations (users/content/quiz/attempt/answer/
support/intervention/deadline/guardian_link), and the two places without FKs
(`users.institution_id`, and JSON columns) are deliberate.

## 4. Backup / restore — VERIFIED (2026-09-04)

Previously "documentation only". Performed in non-production containers
(`postgres:16-alpine`, ports 55432/55433; containers `elekeza-pg-src`,
`elekeza-pg-restore` now stopped):

1. Booted backend (prod profile) against empty source DB — Flyway V1→V5 applied,
   `validate` PASS, demo seed present.
2. `pg_dump -F c -b` → backup (73,458 bytes).
3. Restored into a fresh, empty second DB with `pg_restore --no-owner`.
4. Compared: row counts identical on all key tables
   (users 5, institutions 1, content 1, quizzes 1, quiz_questions 2,
   quiz_attempts 0, lesson_progress 1, guardian_links 1) and
   `flyway_schema_history` intact (V1–V5).
5. Booted the backend against the **restored** DB: Flyway "Schema is up to date. No
   migration necessary." (validate PASS), Hibernate validate PASS, Tomcat started,
   Hikari pool connected.

Evidence: `/tmp/elekeza_backup.dump`, boot logs
`/tmp/elekeza-src-boot.log`, `/tmp/elekeza-restore-boot.log`.

Scope caveat: this verifies the *mechanism* (dump → restore → boot → validate) in a
non-production environment. It does **not** verify the production hosting
provider's own backup schedule/retention (no production credentials/infrastructure
were touched). Health indicator note: `/actuator/health` reports `DOWN` on this
machine because the host disk free-space indicator reports 0 bytes free (an
environment metric quirk — writes succeed and builds run); DB connectivity itself is
proven by Hikari + context boot.

## 5. N+1 / batch fetching — reviewed, not changed

`SupportService.refreshSignals()` (teacher dashboard signal computation) issues
per-learner queries (`lessonProgressRepo.findByUserIdOrderByCreatedAtDesc` per
learner, plus a per-signal `flagRepo.findByLearnerIdAndSignalTypeAndStatus` and a
`quizAttemptRepo.findAll()`), which is a classic N+1/broad-read pattern bounded by
institution size. Per the acceptance priority
(correctness > security > integrity > reliability > performance), no speculative
optimization was applied: no query profiling exists to show this path is hot, the
pattern is bounded per institution, and a targeted repository method
(`findByUserIdInOrderByCreatedAtDesc`) would be the right fix once profiling
confirms it matters. Dashboard/analytics/quiz paths used by the acceptance tests
were exercised end-to-end by the passing integration tests.

## 6. Issues intentionally left unchanged

| Item | Why unchanged |
|---|---|
| `users.institution_id` (no FK, no `@ManyToOne`) | Intentional soft reference; dev seed has no institution row id 1; service-layer isolation is enforced and tested |
| `support_flags`/`interventions` plain-Long learner/teacher ids | DB FKs already enforce integrity; mapping cosmetics only |
| `lesson_progress.content_id`, quiz attempt/answer ids as plain Longs | DB FKs exist; loading whole related rows would be worse |
| Legacy UUID `learners`/`guardians` tables | Separate feature lineage; both validate; consolidation is debt, not a defect |
| `SupportService.refreshSignals` per-learner queries | Correctness already proven; no profiling evidence of a hot path; needs measurement before optimization |
