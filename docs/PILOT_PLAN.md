# PILOT_PLAN — Elekeza

## Objective

> The pilot is for learning, not vanity numbers.

Run a small, controlled pilot with a real school to validate that learners (including learners with disabilities), teachers and guardians can use Elekeza's core loop — and to collect trustworthy product-learning signals.

## Timing

**October 2026** — a few weeks of real usage. December = observe/learn/improve; January 2027 = evidence review.

## Scope (intentionally small)

- **1 school** (or 2 small groups), 1–2 selected classes
- **5–15 learners**, including 2–4 learners with documented support needs (with guardian consent)
- **2–3 teachers**, **5–10 guardians**
- **2 subjects only** (the strongest content: Mathematics, Science)
- Devices: school tablets + home where available; connectivity assumed intermittent (offline queue in use from day one)

## Pre-launch gate (all must be true)

| # | Gate | Status |
| --- | --- | --- |
| 1 | Backend suite green (151 tests) | ✅ verified |
| 2 | Frontend typecheck/lint/build green | ✅ verified |
| 3 | Live browser walkthrough of the full learner → guardian → teacher loop re-executed on the pilot build | ⬜ before launch |
| 4 | PostgreSQL staging environment deployed + smoke-tested | ⬜ before launch |
| 5 | Seed accounts + guardian consent records prepared | ⬜ before launch |
| 6 | AI mode decided and labelled (`mock` deterministic for pilot; real provider optional) | ✅ mock is default-safe |
| 7 | Backup taken and restore actually tested once | ⬜ before launch |
| 8 | Teacher/guardian 30-minute orientation session delivered | ⬜ week 0 |

## What we will measure (learning questions → signals)

**Learner:** Can they understand the lesson? Navigate independently? Which accessibility modes help? Where do they struggle? What keeps them engaged?
→ completed lessons, quiz scores/attempts, adaptation-mode usage, session length, drop-off points, offline-queue frequency

**Teacher:** Can they see who needs attention? Does the dashboard save time?
→ support-signal dashboard usage, intervention notes, weekly time-on-task interviews

**Guardian:** Do they understand progress? Do they find it useful?
→ notification open rates, guardian logins, plain-language summary comprehension (short interview)

**Product:** Which lessons complete? Where do users drop? Which accessibility configurations correlate with completion?
→ per-lesson funnel, preference-vs-completion correlation, sync-failure rates

## Privacy rules during pilot

- Guardian consent on file for every learner
- Child-level data visible only to that learner's teachers/guardians (enforced by tested authorization)
- Pilot reports aggregate; never publish child-level analytics
- No model training on pilot data

## Honest known limitations at launch

- AI runs in deterministic mock mode (clearly labelled in-app)
- M-Pesa/email/SMS live providers optional; app degrades gracefully
- Mastery/competency engine not yet built — progress is lesson/quiz-based
- Accessibility validated by automation + code review, not yet by learners with disabilities (their feedback is a primary pilot deliverable)
