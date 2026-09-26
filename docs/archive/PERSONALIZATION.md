# PERSONALIZATION — Elekeza

## Design rules (from `personalization/LearningPreferences.kt`, verified)

1. Every adaptation has a **Source**: `EXPLICIT` (learner), `TEACHER`, `GUARDIAN`, `OBSERVED` (behaviour), `SYSTEM` (defaults)
2. Resolution precedence: **EXPLICIT > TEACHER > GUARDIAN > OBSERVED > SYSTEM**
3. Observed preferences only become persistent after **enough evidence** — never after a single interaction
4. **Academic expectations are separate from presentation.** This model never contains ability or diagnosis labels — a guard list (`DIAGNOSTIC_PHRASES`) actively rejects diagnostic phrasing in AI/adaptation output
5. Every adaptation is explainable and reversible — the learner's explicit choice always wins

## The preference keys

| Key | Values | What it changes |
| --- | --- | --- |
| `density` | COMPACT / STANDARD / SPACIOUS | Visual density of content |
| `explanationStyle` | CONCISE / STEP_BY_STEP / EXAMPLE_FIRST / DETAILED | How explanations are structured |
| `exampleFrequency` | LOW / MEDIUM / HIGH | Number of worked examples |
| `textSize` | SMALL / MEDIUM / LARGE | Typography scale |
| `contrast` | STANDARD / HIGH | Contrast theme |
| `visualSupport` | flag | Visual scaffolds on/off |
| `readAloud` | flag | Audio support cue |

Learner-facing surface: **"How I Learn"** (`/learner/preferences`), reading/writing to `/api/learner/preferences` — the same JSONB `LearnerProfile.preferences["learning"]` document the AI context, teacher support view and guardian summary read.

## Deterministic adaptation engine (`TextAdaptation`)

Presentation codes: `ORIGINAL`, `CLEARER` (chunked, key terms emphasized, duplicates removed), `STEP_BY_STEP` (numbered, one idea per step), `SPACED` (one concept per section), `DETAILED` (structured original).

Guarantees, enforced by construction and by `AdaptationSafety.validate` for AI variants:

- **Never invents facts, examples or curriculum content**
- Every content sentence survives (duplicates may be dropped for CLEARER; steps preserve original order)
- Rejects adapted output that loses key terms, is implausibly short, or contains diagnostic phrasing
- Works offline — it is pure text transformation, no model required

## Learning signals (behaviour → preference, safely)

`SignalAccumulator`:

- An interaction records for/against evidence for a direction (e.g. `explanationStyle=STEP_BY_STEP`)
- **Persistent OBSERVED preference requires ≥ 3 evidence events AND confidence ≥ 0.6**
- Negative evidence halves confidence; confidence decays with a 30-day half-life so stale inferences re-evaluate instead of permanently labelling the learner

## Explainability contract

Every adaptation must be explainable to the learner, e.g.:

> "You're getting another example because this concept has been difficult in your last two activities."

No opaque automated educational decisions: AI can **suggest**; explicit human configuration and the deterministic engine decide presentation. The AI tutor simplifies/explains supported content within `AdaptationSafety` boundaries and never grades, never diagnoses, never makes high-stakes decisions.

## Surfaces that read the profile

- Lesson page (adaptation mode picker, persisted per learner)
- AI tutor context
- Teacher: `/teacher/student/{id}/learning-support` and `/learning-preferences`
- Guardian: plain-language support summary (`GuardianLearningSupportController`)
- Offline: preferences cached by the service worker so the adapted experience survives connectivity loss

## Honest limitation

The current profile encodes *presentation* preferences deeply, but the **mastery/competency model** (what the learner knows, prerequisite gaps, misconceptions) is the next build. Today's OBSERVED signals adjust presentation; they do not yet drive adaptive item selection.
