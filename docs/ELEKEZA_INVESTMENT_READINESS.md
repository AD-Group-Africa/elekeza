# ELEKEZA INVESTMENT READINESS

**Status: pre-investment.** This document states what exists, what is
assumed and what is unknown. It deliberately avoids invented numbers: no
revenue, no valuation, no projections are claimed.

## Product (what actually exists today)

- **Working end-to-end platform**: Spring Boot/Kotlin backend (146 tests
  green), Next.js frontend, FastAPI AI service, PostgreSQL/dev-H2, Flyway
  migrations V1–V9.
- **Adaptive learner experience**: companion character, learner home with
  one-primary-action design, lesson presentation adaptation (original/
  clearer/step-by-step/spaced/detailed), gamified progress (XP, levels,
  badges — non-competitive), celebration rewards, server-scored quizzes.
- **Learner experience profile**: per-learner learning preferences
  (density, text size, contrast, explanation style, visual support,
  read-aloud) with source precedence (learner > teacher > guardian >
  observed > system) — configuration signals, not diagnostic labels.
- **Adult surfaces**: teacher dashboard with class analytics + per-learner
  SNE support signals; guardian plain-language progress + notifications;
  school admin views.
- **AI**: deterministic local adaptation engine (honest, offline-safe);
  real-provider pipeline implemented and verified to the provider boundary.
- **Showcase seed**: coherent school (1 admin, 7 teachers, 30 learners,
  15 guardians, 6 subjects, 13–14 lessons) reproducible from
  `SHOWCASE_SEED=1`.

## Differentiation

- SNE-first adaptive *experience* (not just simplified text) — most local
  competitors are generic LMS portals.
- Guardian inclusion loop built in from the start.
- Honest AI: deterministic mode works without any external dependency,
  with a clean switch to a real provider.

## AI moat — current honesty

- Today's moat is **product design + preference model**, not model weights.
- Signals exist (adaptation events, per-answer latency, feedback) to train
  adaptation policies later, but **no learning-outcome dataset exists yet**.
- Real LLM generation is implemented but unvalidated against a live
  provider.

## Accessibility strategy

- Tablet-first, large touch targets, reduced-motion support, focus states,
  semantic landmarks on learner screens.
- Preferences (contrast, text size, density) are first-class data.
- Deeper work (screen-reader audits, switch access, dyslexia-tuned fonts)
  is scoped for the pilot phase — **not yet done**.

## Market

- **Beachhead: Kenya SNE schools** (private first, NGO programs second).
- Expansion thesis: East Africa → Anglophone West Africa → similar
  SNE-under-resourced markets. Thesis only; no market-sizing study done.

## Evidence — the biggest gap

| Evidence an investor will want | Status |
|---|---|
| Working product | **Validated** |
| Kids can use it (usability) | Internal demo only |
| Learning outcomes improve | **Not measured** |
| Teachers use it without prompting | **Not tested in classroom** |
| Buyers will pay | **Unknown** |
| Retention/engagement | **No data** |

## Technology readiness

- Architecture, security hardening, authz isolation: done and tested.
- Production hosting/staging: **not yet validated**.
- Load testing, backup/recovery drill, observability: **not done**.

## Capital requirements (categories only — no figures)

1. Cloud hosting + environments (staging/prod).
2. AI/API usage once a real provider credential is active.
3. Pilot devices (tablets) and accessories.
4. Accessibility testing with real SNE learners (ethics + stipends).
5. Security testing (external review before scale).
6. Legal/IP (entity formation, IP assignment, DP registration).
7. Pilot program management (teacher training, support).
8. Customer research (buyer interviews, outcome study design).

## Next milestone that unlocks conversations

A **4–6 week classroom pilot in one SNE school** producing: usage data,
teacher feedback, guardian engagement metrics, and a pre/post learning
measure. That evidence package — not more features — is the gate to any
serious investment discussion.

## Explicit non-claims

No pilot has been run. No revenue exists. No investor is engaged. Nothing
here should be read as a financial projection.
