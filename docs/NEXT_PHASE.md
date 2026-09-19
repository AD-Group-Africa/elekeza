# NEXT_PHASE — Elekeza

Roadmap after this transformation gate. Classified MUST HAVE / SHOULD HAVE / DEFERRED.

## MUST HAVE (pilot-critical, next 2–4 weeks)

1. **Pre-launch pilot gates** (see `PILOT_PLAN.md`): staging deploy, restore drill, live walkthrough re-run, consent records
2. **Live browser walkthrough codified** as Playwright E2E for the 14-step learner journey — so every future change is regression-checked against the core loop
3. **Mastery engine v0** — deterministic, explainable: per-skill correctness tracking on existing quiz data → "what does this learner know / what's next" recommendations teachers can review. (No ML; rules first, exactly as the adaptive-assessment contract requires.)
4. **Real-user accessibility pass** — pilot learners with disabilities are the test: their feedback drives the next a11y fixes
5. **Per-learner deletion workflow** — MUST before any second cohort

## SHOULD HAVE (pilot → January)

6. Adaptive assessment v0: correct → harder item, incorrect → prerequisite item, repeated difficulty → remediation, successful remediation → reassessment (deterministic, explainable)
7. Offline hardening: full sync-conflict resolution tests; "saved locally / syncing / synced / sync failed" status surfaced everywhere progress is written
8. SMS channel adapter (guardian notifications + reminders first) behind the existing provider abstraction; USSD read-only guardian basics after
9. Automated a11y (axe-core) + IDOR sweep + dependency audit wired into CI
10. Character growth v1: knowledge/confidence/curiosity/persistence dimensions fed by mastery data — never academic rank
11. Component tests for learner primitives (companion, celebration, quiz feedback)

## DEFERRED (documented, not scheduled)

- KEMIS/KNEC/KICD interoperability adapters (design constraint already respected: nothing government-specific in the learner core)
- Multi-country configuration (Uganda/Tanzania/Rwanda) — architecture keeps Kenya configurable, not hard-coded
- Device management / school offline servers
- Advanced AI (adaptive item generation with real provider, translation) — only after pilot evidence justifies it
- Frontend component library consolidation, brand/design-token extraction
- Payments beyond M-Pesa; procurement/billing systems

## The one rule for everything above

Every item must answer: **does this help a school identify learners' needs earlier, deliver better interventions and improve learning outcomes?** Feature counts are not the goal; the earliest-possible trustworthy signal about every learner is.
