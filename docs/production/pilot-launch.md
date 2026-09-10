# Elekeza — Pilot Launch Checklist

A school's first two weeks on Elekeza, in order. Items marked ⛔ block the pilot; everything else can land during week 1.

## Before the school sees anything

- [ ] ⛔ Production stack deployed per `deployment.md`; `/actuator/health` UP; TLS valid.
- [ ] ⛔ `.env` values set from `environment-variables.md`; `SECURE_COOKIES=true`; CORS origin = the exact pilot domain.
- [ ] ⛔ `prod` profile confirmed (H2/demo seeder **not** running); any demo accounts absent or rotated.
- [ ] ⛔ Nightly backup scheduled + one restore drill completed (`backup-and-recovery.md`).
- [ ] Error tracking (Sentry DSNs) connected and receiving a test event.

## School onboarding (day 0–1)

- [ ] Register the school via `/register` (self-serve flow creates a `SCHOOL_ADMIN`).
- [ ] Admin imports learners by CSV (`/school/import`) — template columns: `firstName, lastName, grade, sneType, guardianEmail, guardianPhone, guardianName, guardianRelationship` (Parent / Caregiver / Older sibling / Legal guardian / Other). After import, the results panel lists one-time guardian logins the school hands over.
- [ ] Admin creates teachers; guardian relationships established during import (one learner may have several guardians — parent, caregiver, older sibling — each with their own account and relationship label).
- [ ] One teacher assigns a lesson; one learner opens it; one guardian sees the ward summary — the three-role smoke test.

## Week 1 — supervised usage

- [ ] Teachers use support signals + interventions; feedback round with 2–3 teachers.
- [ ] Learners personalize via "How I Learn"; watch for confusion — the page must need no explanation.
- [ ] Offline spot-check: load a lesson, go offline, reopen — cached content serves.
- [ ] Mobile/tablet pass on the actual devices schools use (Chromebook + Android tablet minimum).

## Week 2 — operational hardening

- [ ] Review Sentry for error clusters; fix or ticket anything recurring.
- [ ] Review M-Pesa sandbox flow end-to-end if the pilot charges schools.
- [ ] Confirm rate limiting, CSRF, and IDOR probes still pass after any hotfix (re-run `.freebuff/live_journey.py` against staging).
- [ ] Collect consent artifacts (see privacy checklist below).

## Privacy / legal gates (flag for qualified Kenyan counsel — engineering does not equal compliance)

- [ ] Privacy Policy + Terms published at the pilot domain.
- [ ] Data-processing agreement with the school signed (school remains data controller for its learners).
- [ ] Guardian consent capture for minors recorded in-app or on paper.
- [ ] Data-retention schedule agreed and documented.

## Known launch blockers (none in code; all operational)

- Real-provider activations (SMS/email/R2/AI/M-Pesa) — see `external-integrations.md`.
- Remote CI green run on GitLab shared runners (local rehearsal only so far).
- First staging-host deployment exercise.
