# B2B2C PRODUCT ASSUMPTIONS

**Status: working assumptions, not validated facts.** Nothing here has been
priced, contracted or pilot-tested. Each row states what we believe, why,
and what would prove it wrong.

## The model

```text
BUYER                School / NGO / Government / Sponsor (B2B)
                       ↓
PLATFORM             ELEKEZA (adaptive learning, SNE-first)
                       ↓
DEPLOYMENT           Device / deployment partner (tablets into classrooms)
                       ↓
USER                 Learner (C)
                       ↓
INFORMED             Parent / Guardian (receives progress, reinforces at home)
```

## Product distribution ambiguity today

One honest caveat for this assumptions register: as of this sprint the public
routes called "Government Portal", "Resource Marketplace", "Therapist Portal"
and "Platform / Super-admin" exist in the frontend as **Coming Soon** surfaces,
not as working product. They are placeholders, not demonstrated capabilities.
If a buyer conversation presupposes any of those as live, say so explicitly.

## Assumptions register

| # | Assumption | Type | Evidence today | Unknown / validation needed |
|---|---|---|---|---|
| 1 | SNE schools will buy per-learner software | Assumed | Product works; no school has paid | Willingness-to-pay interviews with 5–10 SNE school heads |
| 2 | Teachers adopt if it answers "who needs me today?" | Partially observed | Teacher dashboard built around that question; positive internal demos | Classroom observation over weeks, not demos |
| 3 | Guardians engage via simple progress notifications | Partially observed | Guardian journey is plain-language and notification-driven | Do parents *act* on notifications? Track open/retention |
| 4 | Learners with dyslexia/ADHD/autism benefit measurably | Core belief, not measured | Adaptation engine + preference model implemented | Pre/post learning-outcome study in a pilot class |
| 5 | Tablets in classrooms are available or procurable | Assumed | Not verified in target market | Device inventory at partner schools; sponsor programs |
| 6 | Low-bandwidth operation is required | Likely | Offline queue exists in quiz runner | Real school connectivity profiling |
| 7 | Revenue: per-learner-per-year institutional licence | Assumed | Nothing priced | Pricing research; NGO sponsored-cohort models |
| 8 | Distribution via school contracts + NGO programs | Assumed | No channel agreements | Identify 2–3 anchor institutions for a paid pilot |
| 9 | Government/county programs are reachable eventually | Unknown | No contacts yet; portal is a placeholder | Map education-tech procurement pathways (Kenya first) |

## Buyer personas to validate first

1. **SNE school head** — budget authority, cares about outcomes + inclusion credibility.
2. **NGO education program lead** — cares about measurable impact per child, reporting.
3. **Device program manager** — cares about durability, offline, shared-device logistics.

## What would falsify the model

- Schools expect one-off payments, not licences.
- Teachers treat another dashboard as workload, not help.
- Guardians without smartphones (SMS fallback becomes mandatory).

## Immediate validation steps (pilot phase)

1. 5 buyer interviews (2 SNE private, 2 NGO, 1 public program).
2. 4-week classroom pilot with pre/post comprehension measures.
3. Guardian notification engagement tracking (open + follow-through).
4. Device and connectivity audit at the pilot school.
