# PILOT READINESS — Elekeza

*Status date: 2026-09-17. Every claim carries evidence; unverifiable items are marked NOT VERIFIED or EXTERNAL.*

## Verdict

**PILOT: GREEN — with explicitly documented limitations.** Elekeza is ready for a small,
controlled pilot with a real school under the terms of `docs/PILOT_PLAN.md`.
**PRODUCTION: NOT VERIFIED** — one external gate remains (real M-Pesa Daraja credentials
+ HTTPS callback, owner-side; see `docs/MPESA_PRODUCTION_CHECKLIST.md`).

## Evidence base (2026-09-17)

| Gate | Result |
| --- | --- |
| Backend `./gradlew test` | **220/220, 0 failed, 0 skipped** (27 suites) |
| Frontend TypeScript | exit 0 |
| Vitest | **17/17** |
| Production build (`next build`) | exit 0 |
| Playwright E2E (real stack, fresh DB per run) | **31/31, 0 failed, 0 flaky** (12.4m) |
| Fresh PostgreSQL 15.17 → Flyway V1–V12 | all 12 migrations applied + validated; app boot 200; FK/unique/check constraints verified; zero orphan rows |
| Manual API journeys (all four roles) | learner 200s + 403 on finance-create; teacher 200s + 403 on finance-read; guardian ward 200 + unlinked ward 403; admin summaries 200 |
| M-Pesa | mock mode honest end-to-end (`/finance/payments/mpesa/mode` flag; live-without-credentials → 503; callback idempotency tested) |

## What the pilot includes (working today)

- Learner loop: lesson → quiz → progress; assignments (submit, resubmit, view feedback)
- Teacher loop: attendance register, classwork creation, submission grading
- Guardian loop: wards, daily digest ("Today at a glance"), fees/balances/receipts, ward evidence
- Admin loop: finance dashboard, fee structures/charges, manual payments, attendance summaries
- Offline assignment queue (IndexedDB sync queue, E2E-verified)
- axe-core a11y gate on key surfaces (part of the 31 E2E specs)

## Explicit pilot limitations

1. **M-Pesa runs in mock mode.** No real money moves. Production Daraja + HTTPS callback is
   an external gate (`docs/MPESA_PRODUCTION_CHECKLIST.md`). The UI labels the mode honestly.
2. **Demo data resets** with the in-memory dev database; a pilot deployment needs the
   PostgreSQL runbook (`docs/DEPLOYMENT_RUNBOOK.md`) — migrations are verified reproducible.
3. **SMS/email providers default to mock.** Real Africa's Talking/SMTP are configured but
   not pilot-blocking (in-app notifications work).
4. **AI runs on the deterministic mock client** (`AI_CLIENT_TYPE=mock`) — honest, labelled,
   no fabricated intelligence. Real provider wiring exists but needs a valid key (EXTERNAL).
5. **Accessibility is baseline-verified** (axe gate, labels, focus, keyboard paths) — not yet
   validated with real assistive-technology users; that is a pilot *output*, not a blocker.
6. **No file uploads on assignments yet** (text submissions only) — documented backlog item.

## Pre-launch checklist (owner-side)

| # | Item | Status |
| --- | --- | --- |
| 1 | PostgreSQL staging deployed via runbook | ⬜ owner |
| 2 | Domain/DNS + HTTPS | ⬜ owner |
| 3 | Backup taken and restore tested once | ⬜ owner |
| 4 | Teacher/guardian orientation (30 min) | ⬜ week 0 |
| 5 | Consent records for participating minors | ⬜ owner |
| 6 | (Optional) real Daraja sandbox credentials | ⬜ external |

## Success measurement

See `docs/PILOT_SUCCESS_CRITERIA.md` (learning questions → signals → targets) and
`docs/PILOT_FEEDBACK.md` (issue capture + classification).
