# ELEKEZA — Pilot Readiness Matrix

**Date:** 15 November 2026 · companion to `ELEKEZA_PRE_PILOT_AUDIT.md`.
Severity: P0 blocks a real-user pilot · P1 before the affected workflow · P2 needs mitigation and owner · P3 after pilot start.

| Domain | Requirement | Evidence | Status | Severity | Remediation |
|---|---|---|---|---|---|
| Product | Core guardian journey works against real PostgreSQL | 37/37 live contract on PG16; H2 lifecycle suites | VERIFIED | — | — |
| Product | Learner journey demonstrated end to end | `/api/deadlines` 200 only | PARTIALLY VERIFIED | P1 | Script and run a learner walkthrough on staging |
| Product | Teacher journey demonstrated end to end | controllers exist; unexercised | NOT VERIFIED | P1 | Assign → record → review walkthrough |
| Product | School-admin journey demonstrated | controllers exist; unexercised | NOT VERIFIED | P2 | Walkthrough before any admin onboarding |
| Product | Module scope for pilot agreed | this audit §10 | VERIFIED (proposal) | — | Founder sign-off |
| Database | Migration integrity V1–V20 | both majors, 0 failed, checksums identical | VERIFIED | — | — |
| Database | V19→V20 upgrade preserves legacy rows | 2/2 REGIONAL kept NULL | VERIFIED | — | — |
| Database | Hibernate validation against migrated schema | both majors | VERIFIED | — | — |
| Database | Isolation from unrelated databases | shared PG15 cluster unchanged at 28 DBs | VERIFIED | — | — |
| Recovery | Backup creation | exit 0 on PG15 and PG16 | VERIFIED | — | — |
| Recovery | Restore into separate database | exit 0 both majors; schema/data/checksums identical | VERIFIED | — | — |
| Recovery | Application runs on restored data | health 200, login 200, `/me` 200 | VERIFIED | — | — |
| Recovery | Scheduled backups | none | NOT VERIFIED | **P0** | Cron on staging host + alert on failure |
| Recovery | Off-site, encrypted backups | none | **BLOCKED** | **P0** | Object storage + encryption key management |
| Recovery | Restore rehearsal on the real host | none (no host) | **BLOCKED** | P1 | After hosting is provisioned |
| Recovery | Measured RTO/RPO | none | NOT VERIFIED | P2 | Measure once on staging |
| Staging gate | Repeatable pass with ownership and cleanup | PASS ×2 on PG16, ×3 on PG15 | VERIFIED | — | — |
| Staging gate | Runs against the compose stack (nginx/TLS) | not attempted | NOT VERIFIED | P2 | Extend gate after hosting |
| Authentication | Register/login/session on a real server | live 201/200/200 | VERIFIED | — | — |
| Authentication | Logout, password reset, activation | endpoints exist | PARTIALLY VERIFIED | P2 | End-to-end auth journey test |
| Authentication | MFA for administrators | absent | NOT VERIFIED | P2 | Decide: required before admin accounts on staging |
| Security | CSRF, secure cookies, CORS from config | code verified | VERIFIED | — | — |
| Security | Role enforcement and cross-role isolation | code + contract + tests | PARTIALLY VERIFIED | P1 | Re-verify on the hosted environment |
| Security | Penetration test / external review | none | NOT VERIFIED | P1 | Commission before real learner data |
| Security | Dependency vulnerability scanning | driver patched; no scanner | PARTIALLY VERIFIED | P2 | Add a scan to CI |
| Security | Rate limiting beyond login | login + waitlist only | PARTIALLY VERIFIED | P2 | Add gateway/app throttling for public endpoints |
| Privacy | Legal review / DPIA for children's data | none | **BLOCKED** | **P0** | Engage Kenyan data-protection adviser |
| Privacy | Consent capture | `/api/privacy/consent` + versioned policy text; 12 privacy tests; exercised on PG16 | VERIFIED (backend) — **no guardian UI calls it yet** | **P0** | Build the consent screen; wording still needs legal review |
| Privacy | Account erasure / deletion | `/api/privacy/erasure`: anonymise, revoke links, deactivate, destroy sessions | VERIFIED (tests + PG16 end-to-end) | **P0** | Confirm the erase-vs-retain-a-record position with counsel |
| Privacy | Retention and disposal policy | daily 03:30 sweep + `retention_runs` evidence + admin dry run; `docs/operations/ELEKEZA_PRIVACY_CONSENT_ERASURE_RETENTION.md` | VERIFIED (dry run vs real sweep on PG16) | **P0** | Agree school-record retention with counsel |
| Accessibility | TTS, reading toolbar, accessibility profiles | code verified | PARTIALLY VERIFIED | P1 | Test with screen reader + low-end device |
| Accessibility | WCAG conformance claim | none made | NOT VERIFIED | P1 | Specialist assessment; do not claim compliance before it |
| Accessibility | Kiswahili coverage | partial | PARTIALLY VERIFIED | P2 | Audit strings and gaps |
| Performance | API/DB behaviour at realistic volume | trivial datasets | NOT VERIFIED | P2 | Seed realistic data and measure |
| Performance | Load/concurrency | none | NOT VERIFIED | P2 | Basic load test on staging |
| Reliability | Health checks, restart policy | compose healthchecks + `restart: unless-stopped` | VERIFIED (config) | — | — |
| Reliability | Error visibility (Sentry, logs) | DSN passed; wiring unverified | PARTIALLY VERIFIED | P2 | Confirm Sentry receives events; centralise logs |
| Integrations | SMS / Email / Storage | mock providers by default | NOT VERIFIED | P1 | Sandbox verification before any real send |
| Integrations | M-Pesa | code present; `FEES_MPESA_MODE=mock` | NOT VERIFIED | P2 | Keep mock for pilot; sandbox test only when fees are in scope |
| Integrations | AI service | mock client available | NOT VERIFIED | P2 | Decide whether AI is in the first pilot (recommended: no) |
| Operations | Hosted environment | none; documented design | **BLOCKED** | **P0** | Approval + account + DNS |
| Operations | Monitoring/alerting | healthchecks only | NOT VERIFIED | P2 | Uptime + error alerts |
| Operations | Incident process, support rota | absent | NOT VERIFIED | P2 | Write before first school session |
| Operations | Rollback procedure | documented; unexercised | PARTIALLY VERIFIED | P1 | Rehearse once on staging |
| UX | Learner usability on mobile | not tested with users | NOT VERIFIED | P1 | Observed sessions (supervised) |
| Mobile | Older/low-spec Android behaviour | not tested | NOT VERIFIED | P2 | Device matrix test |
| Data | Synthetic-only data during validation | enforced in this programme | VERIFIED | — | Keep until consent exists |
| Validation | School discovery completed | not authorised | NOT STARTED | — | Founder to authorise and name a school |
| Validation | Guardian validation sessions | not authorised | NOT STARTED | — | Follows school discovery |

## Gate summary

A controlled pilot may be approved only when every **P0** row is closed:

1. Hosted staging operational (row "Hosted environment").
2. Legal/DPIA review complete.
3. ~~Consent capture, erasure and retention implemented.~~ **Closed 2026-11-15** in the backend — no guardian-facing consent screen yet, and the consent wording awaits legal review.
4. Scheduled, off-site, encrypted backups running.

As of 15 November 2026, **one of the four is closed** (consent/erasure/retention in the backend); hosting, legal review and scheduled off-site backups remain open.
