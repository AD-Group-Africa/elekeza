# GAMIFICATION — Elekeza

## Principle

> Gamification must reinforce genuine learning — never rank children, never shame, never make engagement more important than outcomes.

## What exists (verified)

Implemented in `learner/GamificationController.kt`, computed **only** from persisted completion data (completed lessons, quiz attempts, scores) — the same source of truth teacher and guardian surfaces read:

- **XP/points** for lesson and quiz completion
- **Levels with friendly names** (e.g. "Sprout") and `nextLevelPoints` — progress toward the next level, never against other children
- **Stars** as achievement markers
- **Achievements** earned from learning milestones
- **Learning streak** surfaced honestly via `/analytics/student` (no penalty mechanics, no "streak shaming")
- **Celebration moment** on quiz completion (`Celebration` component, reduced-motion aware, `aria-live="assertive"` so screen readers announce success)
- **Companion reactions** (`LearningCompanion`): greeting, encouragement, hinting, celebration — the character reacts to *learning*, not to speed

## What is deliberately absent

- ❌ Public leaderboards or ranking of children by ability
- ❌ Shame mechanics for missed days
- ❌ Manipulative infinite streak pressure
- ❌ Gambling-like or pay-to-win mechanics
- ❌ Time-pressure-based rewards (a learner with motor or processing differences is never disadvantaged)
- ❌ Excessive animation (all celebration respects reduced motion)

## Character system (current, lightweight)

`LearningCompanion` is the learner's guide — pure SVG + CSS, no asset loading, no animation library. States: idle, greeting, explaining, thinking, encouraging, hinting, celebrating, concerned. It is a **UX primitive** (explains, encourages, celebrates) rather than a cosmetic mascot, and the learner-facing progress page reads real points/level/stars/achievements rather than invented metrics.

## Intended evolution (next phase)

- Character dimensions that grow with learning (knowledge, confidence, curiosity, persistence, exploration, mastery) — never a proxy for academic rank
- Missions tied to mastery rather than raw completion counts (depends on the mastery/competency layer)
- Avatar/companion customization as a P1 after the mastery loop exists
- Personal-best progression only; classroom collaboration mechanics that never expose one child's performance to another

## Anti-goals guardrail

Any future mechanic must pass this test: **does it help a learner with a disability progress meaningfully without being disadvantaged by motor speed, reading speed, sensory needs or processing speed?** If not, it does not ship.
