# ELEKEZA — End-to-End Pre-Pilot Readiness

**Date:** 15 November 2026 · **Branch:** `sprint-3-safe-config` @ `47d17f5` · no commit, push, deployment, DNS change or paid resource created.
**Programme:** database hardening, hosted staging preparation, pre-pilot audit, validation planning.

---

## 1. Executive summary

The **database layer is now genuinely hardened**. For the first time Elekeza can back up *and restore* its own database, proven on both PostgreSQL majors it uses: a dump is restored into a separate database, schema and data are compared to the original, Flyway checksums match, and the application boots against the restored data and serves an authenticated request. The backup tooling that could not run against PostgreSQL 16 at all now selects a client from the server's major version, fails safely without one, and leaves no artifact when interrupted.

**Everything around the database is not ready for real people.** There is no hosted environment, no legal review for children's data, no consent or erasure feature, no scheduled or off-site backups, and the teacher and learner journeys have not been demonstrated end to end. Those are not polish items; they are the difference between a system that can be demonstrated safely and one that can be handed to a school.

**Decision: NOT READY** for a controlled pilot with real learners or guardians. Two of the six workstreams are blocked on external authorisation (hosting, school contact), and four P0 gates remain open (§12–15).

## 2. Original repository baseline

| Item | Value |
|---|---|
| Branch / HEAD | `sprint-3-safe-config` / `47d17f5` |
| Working tree | 22 modified, 2 staged, 21 untracked — pre-existing work, preserved untouched |
| Stashes | 4, untouched |
| Scripts before | `db-backup.sh`, `db-restore-drill.sh`, `staging-gate.sh`, `reset-preview.sh` |
| Databases before | PostgreSQL 15.17 `localhost:5433`, 28 databases (shared cluster) |
| Deployment config | `docker-compose.yml` (postgres 16, redis, backend, ai-service, frontend, nginx) + `docker-compose.tls.yml` |
| Docs before | substantial existing audit history, no `docs/operations/` or `docs/pilot/` |

## 3. Database compatibility

Verified earlier and unchanged by this programme: V1–V20 apply cleanly from empty and V19→V20 upgrades in place on **PostgreSQL 15.17 and 16.16**; `county_code varchar(64) NULL` and `idx_deadline_county` present; legacy REGIONAL deadlines keep `NULL`; 59 tables / 505 columns / 176 indexes / 93 foreign keys; Flyway 11.20.3 + pgJDBC 42.7.14; migration checksums identical across Flyway 9→11 and PG15→PG16. Detail: `ELEKEZA_DATABASE_AND_STAGING_READINESS.md`.

## 4. Backup and restoration proof

| Proof | Result |
|---|---|
| Backup PG15 (native discovery) | exit 0, 208 KB, 118 table definitions |
| Backup PG16 (container client) | exit 0 |
| Restore into a **separate** database, both majors | exit 0; 59 tables, 505 columns, 176 indexes, 93 FKs, 20 migrations, v20, 0 failed |
| Restored vs source | identical schema counts, identical row counts, identical Flyway checksums |
| Application against restored data | "Schema is up to date", health **200**, login **200**, `/api/auth/me` **200**, `/api/deadlines` **200** |
| Failure paths | incompatible client → exit 3; unsafe target → exit 2; invalid archive → exit 2; empty database → exit 6; interrupted dump → partial removed, non-zero exit |

This closes the previous report's open defect and satisfies the rule that a backup is not reliable until a separate database has been restored and verified.

## 5. Staging evidence

`scripts/staging-gate.sh` passes end to end: PASS ×3 on PostgreSQL 15 and ×2 on PostgreSQL 16 (exit 0), covering fresh provisioning, ownership marker, 20/20 migrations, V20 assertions, production-profile boot, an API-provisioned STUDENT identity, authenticated smoke through the frontend proxy, zero administrator accounts, teardown and database cleanup.

## 6. Hosted staging architecture **and status**

Designed, documented and **not provisioned**. `docker-compose.yml` is deployable as-is on a 4 vCPU / 8 GB VPS (Option A recommended), with TLS via certbot, secrets from a host `.env`, no published database port and `DEMO_SEED_ENABLED=FALSE`. Runbook, rollback and an env template are written. **Status: BLOCKED** — no provider account, payment method, DNS control or approval was available, and none was assumed. No URL exists.

## 7. Security and privacy audit

| Strong | Weak |
|---|---|
| CSRF with narrow, documented exemptions | No consent screen calls the API yet (backend endpoint exists) |
| Secure cookies by default in prod | No legal/DPIA review of children's data |
| CORS from configured origins | Consent wording not professionally reviewed |
| Login rate limiting | Rate limiting absent elsewhere |
| Upload: size, extension allowlist, path sanitisation, role gate | Upload stores to local disk; no content inspection |
| Role enforcement proven for guardian/county paths | No penetration test; no external review |
| pgJDBC security patch applied | No automated dependency scan |

## 8. Product and workflow audit

38 controllers, 176 endpoints, 61 routes, 5 roles. The **guardian** journey is proven live. **Teacher, learner-completion and school-admin journeys are implemented but unproven end to end** — the audit's most material product gap. Recommended first-contact scope is narrow: guardian visibility, school dates, reading assignment, accessibility aids.

## 9. Accessibility and mobile audit

TTS hook, reading toolbar and accessibility profiles exist and are wired. No assistive-technology test, no contrast or touch-target measurement, no low-end Android testing, partial Kiswahili coverage. **No WCAG conformance is claimed.** For an SNE-focused product this is a P1.

## 10. Performance and reliability findings

Cold start 32–105 s on an 8 GB developer laptop; migrations 4.7–9.9 s; datasets of 4–9 rows. No load test, no concurrency test, no realistic-volume measurement. **No scalability claim is made.** One frontend build failed with Node out-of-memory at 826 MB free host memory — environmental, but it shows the stack is sensitive to host resources.

## 11. Integration readiness

SMS, email, storage and AI all default to **mock** providers. M-Pesa code exists with `FEES_MPESA_MODE=mock`. No sandbox calls were executed in this programme (no credentials); no integration is production-tested. Nothing was sent or charged.

## 12. School and guardian validation results

**None.** No school or guardian was contacted, no message sent and no real data collected — that requires authorisation that has not been given. Plans and instruments are written: `docs/pilot/ELEKEZA_SCHOOL_VALIDATION_PLAN.md`, `docs/pilot/ELEKEZA_GUARDIAN_VALIDATION_PLAN.md`, `docs/pilot/ELEKEZA_CONTROLLED_PILOT_PROPOSAL.md`. Any claim of school interest would be fabricated; there is none.

## 13. Open risks and remediation owners

| Risk | Severity | Owner | Action |
|---|---|---|---|
| No hosted environment | **P0** | Founder + engineering | Approve provider + budget, then run the documented runbook |
| No legal/DPIA review for children's data | **P0** | Founder + legal adviser | Engage Kenyan data-protection adviser |
| No consent, erasure or retention | **CLOSED 2026-11-15** | Backend | Delivered as `V21` + `/api/privacy/**`; consent wording and erase-vs-retain position still need legal review |
| Backups unscheduled, on-host, unencrypted | **P0** | Operations | Cron + object storage + encryption |
| Teacher/learner journeys unproven | P1 | Engineering | Scripted walkthrough on staging |
| Accessibility unassessed | P1 | Frontend + specialist | Screen reader + low-end device pass |
| No penetration test | P1 | Security | Commission external review |
| Integrations unverified | P1 | Integrations | Sandbox verification |
| Rollback unexercised | P1 | Operations | Rehearse on staging |
| Rate limiting, alerting, incident process | P2 | Backend/Ops | Mitigate with an owner and date |

## 14. Pilot scope recommendation

Proceed **only** with a single-class, single-term, read-mostly pilot covering guardian visibility of school dates, teacher reading assignment and accessibility aids; fees, messaging, AI and analytics excluded. Prerequisites are the nine gates in the pilot proposal, of which four are P0 and currently open.

## 15. Final readiness decision

# NOT READY

- **Hosted staging:** BLOCKED (no authorisation, account or DNS control).
- **School/guardian validation:** NOT STARTED (not authorised).
- **Pilot gates:** 0 of 4 P0 gates closed.

What *is* ready and defensible: the database layer — migrations, upgrades, isolation contracts, backup and restore — verified with reproducible evidence on two PostgreSQL majors, including a restored database the application actually runs against.

What is missing is not engineering confidence but the operational and legal scaffolding that lets real children's information be handled responsibly. Until hosting exists, consent and erasure exist, and a data-protection review has been done, Elekeza is a well-tested system that should stay in front of synthetic data.

---

## Appendix — deliverables created

| Document | Purpose |
|---|---|
| `docs/operations/ELEKEZA_DATABASE_BACKUP_AND_RESTORE.md` | Backup/restore procedure, tools, failure modes, measured evidence |
| `docs/operations/ELEKEZA_HOSTED_STAGING_ARCHITECTURE.md` | Hosting options, recommendation, runbook, rollback, acceptance checklist |
| `docs/operations/ELEKEZA_STAGING_ENV_TEMPLATE.env` | Environment template, placeholders only, no secrets |
| `docs/audit/ELEKEZA_DATABASE_AND_STAGING_READINESS.md` | Consolidated database/staging evidence with labels |
| `docs/audit/ELEKEZA_READINESS_REGISTER.md` | One-page executive register |
| `docs/audit/ELEKEZA_PRE_PILOT_AUDIT.md` | Full audit with severity-rated findings |
| `docs/audit/ELEKEZA_PILOT_READINESS_MATRIX.md` | Domain-by-domain requirement matrix |
| `docs/audit/ELEKEZA_PRE_PILOT_EXECUTION_LOG.md` | Task register with statuses and evidence |
| `docs/pilot/ELEKEZA_SCHOOL_VALIDATION_PLAN.md` | Discovery + demonstration + questionnaires |
| `docs/pilot/ELEKEZA_GUARDIAN_VALIDATION_PLAN.md` | Guardian sessions, trust questions, accessibility checklist |
| `docs/pilot/ELEKEZA_CONTROLLED_PILOT_PROPOSAL.md` | Scope, measures, governance, gates, exit plan |
