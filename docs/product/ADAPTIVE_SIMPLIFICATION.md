# Adaptive Simplification — Product Guide

## What it is

A learner-facing engine that re-presents a lesson's content in the style that
helps **this** learner, on demand. It is not a "make it easy" switch: the same
lesson can be shown *clearer*, *step-by-step*, *spaced out*, or *in more
detail*, and the learner chooses which view they want at any moment.

## What changes — and what never changes

**Presentation and support change:**

* sentence/chunk structure (one idea at a time);
* explicit numbering/steps;
* spacing and reading density;
* emphasis of key terms;
* extra structure for visual learners.

**The curriculum never changes:**

* required learning outcomes stay present;
* factual meaning is preserved;
* no content is invented;
* correct answers and assessment intent are untouched;
* vocabulary and content are never dumbed down to a lower academic level —
  the original lesson remains the same document the teacher authored.

## Controls on every lesson (learners)

Each lesson page offers:

| Control | Behaviour |
| --- | --- |
| **Original** | the teacher's lesson as authored — always one click away |
| **My usual style** | the adaptation the learner's own profile suggests |
| **Clearer** | re-flowed text with key ideas emphasised |
| **Step-by-step** | one idea per numbered step |
| **Spaced out** | the same content with room between ideas |
| **More detail** | structured, fuller presentation |
| **Listen to this lesson** | read-aloud (shown when the learner turned it on) |
| **Was this helpful? 👍 / 👎** | lightweight feedback that improves future adaptation |

Learners are never trapped in an adapted view. If an adaptation cannot be
produced (AI down, cache miss, content without text), the page says so and the
original lesson is always still there.

## How an adaptation is chosen

1. The learner clicks a style, or "My usual style".
2. The profile-derived default maps preferences to a code
   (e.g. `STEP_BY_STEP → step_by_step`, `DETAILED → detailed`).
3. A cache lookup on `(learner, content, code)` returns an existing variant if
   the source text is unchanged — identical requests never re-invoke the AI.
4. On a cache miss, the engine generates the variant and stores it.

## Generation and safety

* **Deterministic local transform (always available, offline-safe).** The
  local engine splits the source into sentences and re-structures them by
  original order. It cannot invent facts by construction — every source
  sentence survives.
* **AI generation (when `ai.client.type=real`).** The AI is asked for a
  student-aware re-presentation of the same text; its output is validated
  before being shown:
  * no diagnostic phrasing ("you have dyslexia", "diagnosed with", …);
  * key terms preserved (it must not silently remove the curriculum);
  * not implausibly short or lossy.
* **Safe fallback.** Any AI failure, timeout, or failed validation falls back
  to the deterministic local variant, and, if even that is impossible, the
  original lesson is shown. Invalid AI output is never presented.

## Adaptation levels (internal)

Adaptation codes used by the engine:

| Code | Learner label | Presentation |
| --- | --- | --- |
| `original` | Original | as authored |
| `clearer` | Clearer | key idea first, duplicate sentences removed |
| `step_by_step` | Step-by-step | numbered one-idea steps |
| `spaced` | Spaced out | one concept per section, same content |
| `detailed` | More detail | structured original, no invented content |

These internal codes are never shown to learners; only the friendly labels are.

## Where text comes from

Adaptation reads the same readable text the lesson page shows:

1. `raw_text` when the content has it (uploaded source), otherwise
2. the structured lesson JSON (`simplified_text`) — headings, bodies and key
   terms — so every READY lesson a learner can open is adaptable.

## Cost and performance controls

* Adaptations are cached per `(learner, content, code)` with a source-text
  hash, so regenerating identical variants never happens.
* Every view/generation/feedback is an attributable event
  (`adaptation_events`) that can answer "who requested what, when" and feed
  usage/cost analytics without logging sensitive content.
* With `ai.client.type=mock` (the default in local/dev) no external AI is
  called at all; deterministic adaptation is used and the same code paths are
  exercised.

## Feedback loop

After viewing an adaptation the learner can answer "Was this helpful?". Helpful
feedback accumulates as a *learning signal*; enough consistent positive
evidence raises the signal's confidence until it may appear in the teacher's
"Responds well to" summary. One interaction never changes the profile.
