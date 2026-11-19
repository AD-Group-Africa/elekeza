# Privacy: guardian consent, account erasure and retention

Status: **implemented in the backend** (migration `V21`, package
`com.elekeza.backend.privacy`). This closes the three P0 *engineering* gaps in
`docs/audit/ELEKEZA_PRE_PILOT_AUDIT.md`; it does **not** constitute a legal
data-protection review, and no consent copy has been reviewed by counsel.

## 1. Consent capture

Guardians (and any user acting about their own data) can record consent. Records
are append-only history, never edited in place.

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/privacy/policy` | The exact wording and version a user is being asked to accept |
| `POST` | `/api/privacy/consent` | Grant a consent (idempotent) |
| `GET` | `/api/privacy/consent` | The caller's full consent history |
| `GET` | `/api/privacy/consent/active` | Only consents still in force |
| `POST` | `/api/privacy/consent/{id}/withdraw` | Withdraw one consent |

All routes require an authenticated session (`/api/privacy/**` falls through to
`anyRequest().authenticated()`); writes are POSTs and are therefore CSRF-protected.

### Types

`GUARDIAN_DATA_PROCESSING`, `LEARNER_DATA_PROCESSING`, `GUARDIAN_COMMUNICATIONS`.

### Rules

* **Consent for a learner needs a currently active guardian link.** The check is
  `currentlyActive()` — a link with `is_active = true` that has not been revoked
  and has not expired. A revoked or expired link cannot be used to consent on a
  child's behalf (there is a regression test for exactly this).
* **Granting twice is idempotent** and returns the existing record rather than
  adding a duplicate history row.
* **Withdrawal stamps `withdrawn_at`; it never deletes the row.** The history is
  the school's evidence that consent existed and when it ended.
* **Only the owner of the record may withdraw it** — another guardian, even of
  the same learner, gets `403`.
* Every record stores `policy_version` and the wording presented, so a later
  policy change cannot be retro-fitted to an older agreement.

Policy version in force: `2026-11-15` (`ConsentService.POLICY_VERSION`). Bump it
whenever the wording changes.

## 2. Account erasure

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/privacy/erasure` | Erase your own account |
| `POST` | `/api/privacy/erasure?targetUserId=` (body) | Admin erasure of another account |
| `GET` | `/api/privacy/erasure/history` | Erasure evidence for the caller |

### What erasure does

1. Destroys identifying fields on `users`: email becomes
   `erased-<id>@erased.invalid`, name becomes `Erased account`, `phone` and
   `gender` are nulled, the password hash is replaced with an unusable random
   value, and `active` is set to `false` (login is impossible — verified `401`).
2. Revokes **every** guardian link where the user is guardian or learner.
3. Withdraws every active consent.
4. Deletes all refresh tokens and password-reset tokens.
5. Writes a `data_erasure_log` row (reason, actor, counts, timestamps) and an
   audit-log entry.

### What erasure deliberately does not do

The `users` row survives, anonymised, because attendance, submissions, deadlines
and other school records reference it. Hard-deleting the row would either break
those records or cascade a school's academic history away — not what a guardian
asking for erasure means, and not something the school can accept. After erasure
the person is unidentifiable, the account cannot be used, and no access path
remains. **This is a technical position, not a legal ruling.** A Kenyan
data-protection review may want academic rows deleted after a retention window,
or may want the row kept — that is a policy decision for the school and its
counsel, and it should be recorded before the pilot.

Erasing an already-erased account is idempotent: it records the second attempt
and changes nothing else.

## 3. Retention policy

| Data | Window | Rationale |
|---|---|---|
| Password reset tokens | deleted on expiry | single-use credential |
| Refresh tokens | deleted on expiry | session artefact |
| Notifications | 365 days | operational messages, not records |
| Engagement events | 365 days | pilot telemetry only |
| Withdrawn consents | 730 days after withdrawal | proof of consent, then no longer needed |
| Audit logs | 90 days | existing job in `AuditLogService` |

Nothing here deletes a learner, a live guardian link, a consent still in force,
or any academic record. Automatic deletion of school records is a school policy
decision, not a side effect of deploying code.

### Scheduling and evidence

* Scheduled sweep: `0 30 3 * * *` (03:30 daily), after the existing 02:00 audit
  purge.
* Every sweep — **including dry runs** — writes a `retention_runs` row, so the
  policy is evidenced rather than asserted.

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/admin/retention/policy` | The windows, as the service defines them |
| `GET` | `/api/admin/retention/runs` | The last 20 sweeps |
| `POST` | `/api/admin/retention/run?dryRun=` | Manual sweep — **defaults to a dry run** |

All three are `ADMIN` only; a guardian receives `403`.

## 4. Verification performed

* `PrivacyConsentErasureRetentionTest` — 12 tests on H2: policy exposure, self
  consent, learner consent via an active link, idempotent re-consent, refusal for
  an unlinked learner, refusal for a **revoked** link, refusal to withdraw
  another guardian's consent, history-preserving withdrawal, erasure
  (anonymisation, link revocation, consent withdrawal, evidence row),
  idempotent second erasure, retention dry run vs real sweep, admin-only run
  endpoint defaulting to dry run.
* Regression: 59 tests across the county-visibility, deadline-authorization,
  guardian-link, school-dates, county-migration, `DemoSeedGuard` and privacy
  suites — 0 failures.
* Real PostgreSQL 16: `V21` applied (21 migrations, 0 failed), health `200`, and
  the endpoints exercised end to end — consent for self and for a linked learner
  (`201`), consent for an unlinked learner (`403`), retention dry run reporting 2
  rows while deleting none, real sweep deleting both, erasure reporting
  `linksRevoked=1 consentsWithdrawn=2`, database confirming anonymised identity,
  no live links, consent history retained, and both the old email and the erased
  address returning `401` at login.
* Real PostgreSQL 15: `V21` applied on a fresh database and health `200`
  (see the PG15 section of the run log), confirming the migration is portable
  across the majors in use.

## 5. Still open (not engineering)

1. **Legal review of the consent wording and of the erasure semantics.** The
   policy text in `ConsentService.POLICY_TEXT` is a reasonable first draft, not
   reviewed copy.
2. **Guardian-facing UI.** The backend exposes everything a consent screen needs;
   no screen asks for consent yet, so in practice consent is currently only
   recorded when the API is called directly.
3. **A named data-protection contact and a data-subject request workflow** —
   who answers a request, within what period, and where it is logged.
4. **Consent for learners who are old enough to consent themselves**, and a rule
   for what happens at 18.
5. **In-app privacy notice** linking the policy endpoint's wording and version.
