# Post-Pilot Roadmap

Written: 2026-09-06 · Status: **PLANNING ONLY — nothing here is implemented; do not start it before the pilot stabilizes.**

## PHASE 1 — Pilot Stabilization (0–3 months)

Theme: *prove reliability and real-world value with the first cohort.*

| Item | Priority | Rationale |
| ---- | -------- | --------- |
| Production PostgreSQL deploy + backup drill (per `backup-and-recovery.md`) | P0 | Foundation for everything else |
| Sentry/monitoring activation + error triage routine | P0 | Can't fix what you can't see |
| School onboarding white-glove (CSV import + guardian linking in person) | P0 | First impressions determine retention |
| Weekly pilot metrics review (see Metrics below) | P0 | Evidence drives priorities 3–6 |
| Teacher feedback loop (2-weekly interviews) | P1 | Teachers are the daily-active users |
| Guardian activation push (invite flow + plain-language onboarding) | P1 | Guardian engagement is the differentiator; measure it |
| Performance work only where measured (slow dashboards, N+1s) | P2 | Optimize against pilot data, not speculation |

## PHASE 2 — School ERP Expansion (3–6 months)

Theme: *become the daily operating system; start where pilot pain is loudest.*

Evaluate against pilot demand — indicative priorities:

| Item | Priority | Notes |
| ---- | -------- | ----- |
| Attendance (daily register) | P1 | Highest-requested ERP module in school platforms; natural teacher workflow |
| Report cards (built from existing assessments/progress) | P1 | Reuses data already in the system; visible value to parents |
| Timetable | P2 | Medium complexity, high switching-cost benefit |
| Fee management / invoices (feeds M-Pesa billing) | P1 | Commercial enabler — links ERP to revenue |
| School calendar & announcements upgrade | P2 | |
| Transport / library / inventory / discipline | P3 | Only on evidence |

## PHASE 3 — Intelligence (6–12 months)

Theme: *insights with human oversight.*

| Item | Priority | Notes |
| ---- | -------- | ----- |
| Learner risk signals (non-diagnostic, strength-based language) | P1 | Builds on existing analytics; **must** stay inclusive (no labels) |
| Intervention recommendations for teachers | P1 | Human-in-the-loop: teacher approves/edits |
| School analytics dashboards | P1 | Admin retention driver |
| Automated parent-friendly progress narratives | P2 | AI-assisted, teacher-reviewed |
| AI-assisted content creation (CBC-aligned) | P2 | Teacher tooling, not learner-facing |
| Institution benchmarking | P3 | Requires cohort scale |

## PHASE 4 — Scale (12+ months)

| Item | Priority | Notes |
| ---- | -------- | ----- |
| Multi-school onboarding tooling / self-serve growth | P1 | |
| County/national partnerships | P2 | Requires compliance groundwork (Phase 1–2) |
| Enterprise admin (roles, delegations, bulk ops) | P2 | |
| High availability / disaster-recovery hardening | P1 | Before county-scale |
| Data governance program (retention, DSAR tooling) | P1 | Prerequisite for partnerships |
| Advanced billing (annual plans, per-learner tiers, invoicing) | P2 | |

## Pilot success metrics

| Domain | Metric | Early signal |
| ------ | ------ | ------------ |
| Schools | schools onboarded · onboarding completion time · weekly active schools | ≥1 onboarding/week during pilot |
| Teachers | weekly active teachers · assignments created · assessments completed | teacher WAU ≥ 60% of roster |
| Learners | weekly active learners · lessons completed · quiz completion rate | ≥3 sessions/learner/week |
| Personalization | % learners with explicit preferences set · feedback submissions | ≥50% of active learners set preferences |
| Guardians | guardian activation rate · weekly progress views per learner | ≥1 view/learner/week |
| Inclusion | SNE-profile learner engagement vs baseline | engagement gap closing |
| Business | pilot→paid conversion · cost per school · support tickets/school/week | conversion ≥ target set at pilot start |

## Commercial plan (post-pilot)

- **Target segment (start narrow):** low-fee private & CBC-focused academies in urban counties — fastest decision cycles, SNE-differentiation resonance, WhatsApp-era guardian engagement.
- **Pricing model:** per-learner monthly, M-Pesa billing (adapter already built), guardian-free tier to drive activation.
- **Sales motion:** school demo (this Tuesday's script) → 2-week free pilot cohort → conversion at term boundary.
- **Onboarding:** templated CSV import + guardian-link day; target < 1 week to first active class.
- **Customer success:** weekly check-ins first term; success = weekly-active teacher + guardian-viewed progress.
- **Expansion:** second school per referral; county association partnerships later.

**Sequencing rule:** nothing in Phases 2–4 starts until Phase-1 metrics are green for one full month.
