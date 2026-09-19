# PILOT SUCCESS CRITERIA — Elekeza

Measurable questions — not vanity metrics. Baseline: what a school does today
without Elekeza. Targets are thresholds for "learned something useful", not
success theatre. Real users, real school, 2–4 weeks (`docs/PILOT_PLAN.md`).

## Learner

| Question | Signal | Target |
| --- | --- | --- |
| Can learners find today's work without help? | % of sessions reaching assignments from home in ≤2 taps | ≥ 70% unassisted |
| Can they submit without adult help? | submissions per assignment vs. enrolled | ≥ 60% |
| Do they understand feedback? | resubmission after grading (a proxy for "read + acted") | ≥ 25% of graded work |
| Do they continue learning independently? | sessions outside mandated class time | ≥ 1/learner/week |
| Does it hold attention without dark patterns? | median session length; voluntary return rate | documented, no streak-guilt complaints |

## Teacher

| Question | Signal | Target |
| --- | --- | --- |
| Is attendance faster than paper? | register time-on-task vs. paper baseline | ≤ 2 min/class, and "faster" in interview |
| Can they create classwork alone? | % of assignments created unassisted after week 0 | ≥ 80% |
| Can they grade without confusion? | grade saves without retry; interview | no recurring friction |
| Does it reduce repetitive admin? | weekly interview, self-reported minutes saved | positive trend by week 3 |

## Guardian

| Question | Signal | Target |
| --- | --- | --- |
| Do they understand the digest at a glance? | 5-second test in orientation + week-1 interview | ≥ 80% correctly state one action |
| Can they see attendance and classwork status? | digest views; questions to school drop over time | documented |
| Do they understand the fee balance? | matched against school ledger in interview | 100% consistency (DATA ISSUE if not) |
| Is it overwhelming? | complaints of "too much information" | near zero; simplify if recurring |

## School admin

| Question | Signal | Target |
| --- | --- | --- |
| Can they operate enrollment/attendance/finance views? | task completion in orientation | all core tasks |
| Are records consistent? | weekly ledger reconciliation | zero unexplained mismatches |
| Do permissions make sense? | admin interview | no confusion about who sees what |

## Platform / trust gates (any failure = pilot blocked until fixed)

- No cross-tenant data access in production logs (audit + tests)
- No unplanned downtime > 4h during school hours
- All `BUG`/`DATA ISSUE` reports reproduced and triaged within 48h
- M-Pesa mock mode clearly communicated to every participant (consent + guide)

## What success looks like (3–4 weeks in)

We can say, with quotes and numbers: **what learners struggled with, what teachers
repeatedly asked for, whether guardians understood their child's day, and whether
the school's records stayed consistent** — and we have a prioritized, evidence-backed
backlog for the next cycle.
