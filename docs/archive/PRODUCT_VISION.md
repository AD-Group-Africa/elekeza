# PRODUCT_VISION — Elekeza

## Vision

> **A new-generation, inclusive digital education system for East and Central Africa.**

Elekeza is the flagship education product of Afrika Digitalis. It is not a school ERP and not an LMS demo. It is inclusive learning and education infrastructure: the system a school uses to **understand, teach, support and develop every learner** — including learners with disabilities.

## The central principle

> Every learner should be understood, supported and given an accessible path to learning.

There is no single "SNE learner". One learner with dyslexia may need simplified text; another learner with cerebral palsy may need large targets and no timed interactions; a third may need none of these and more challenge. So Elekeza does not adapt only the content — it adapts the **experience**: presentation, pacing, guidance level and interaction style, always learner-visible and always reversible.

## Pillars and their real status

| Pillar | Purpose | Status (verified) |
| --- | --- | --- |
| **Elekeza Learn** | Lessons, activities, quizzes, progress | **Working** — companion-first learner home, lesson reader with adaptation modes, server-scored quizzes, exam runner, progress page on real data |
| **Elekeza ERP** | Institutions, classes, teachers, guardians | **Working core** — institution registration, admin, teacher and guardian dashboards on real scoped APIs |
| **Elekeza Intelligence** | Learning signals, support recommendations, AI assistance | **Working, honest AI** — deterministic adaptation engine, evidence-gated signals, AI provider abstraction with mock/real switch; AI never diagnoses or grades |
| **Elekeza Assistive** | Universal design for disability | **Partially built** — per-learner presentation preferences, read-aloud, text size/contrast, reduced motion, keyboard support, skip links; deeper assistive tech (switch access, captions pipeline) deferred |
| **Elekeza Data** | Canonical learner data, structured events | **Partially built** — canonical profiles + progress + quiz events exist; mastery/competency model is the next big build |
| **Elekeza Connect** | Guardians, teachers, notifications | **Working** — guardian ward summaries in plain language, teacher communication surfaces, notification chain verified end to end |

## What we are building toward, in order

1. A pilot a real school can run safely (learner + teacher + guardian journeys, real data, known limitations).
2. A mastery/competency layer that answers "what does this learner know, what's next?" deterministically and explainably.
3. Channel reach: offline-first hardening, then SMS/USSD adapters behind the existing abstraction.
4. Interoperability (KEMIS/KNEC/KICD) as configurable adapters — never hard-coded into the learner core.
5. Multi-market readiness (Kenya first; country configuration for curriculum/grading/languages).

## Evidence discipline

By January 2027 the credible claim is:

> "We built Elekeza and tested it with real learners, teachers and guardians — here is completion, engagement, accessibility and learning-signal evidence."

Not user counts. Not feature counts. Every readiness claim in this repository must trace to a test, a build, or a documented limitation.
