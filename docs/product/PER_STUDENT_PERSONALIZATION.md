# Per-Student Personalization — Product Guide

> Elekeza adapts to the learner, not the learner to Elekeza.

## What this is

Every learner in Elekeza can have an individual **learning-presentation profile**.
Elekeza uses that profile to adjust *how* lessons are shown — chunking,
step-by-step structure, spacing, text size, examples, read-aloud — without
changing the curriculum objective, the assessment, or the academic standard of
the lesson.

Personalization is **not** a special-needs feature and is **not** optional
only for some learners. Standard, advanced, accessibility-focused, and
high-support learners all use the same architecture; the difference is only in
the preferences expressed.

## Product principles (hard rules)

1. **Never assume disability from difficulty.** A learner who benefits from
   shorter sections is described as *benefiting from shorter sections*, never
   as *probably dyslexic*.
2. **Never reduce a learner to a diagnosis.** The engine may surface
   learning-support signals; it never surfaces medical conclusions.
3. **Never silently lower academic expectations.** Presentation complexity and
   academic level are separate. "Step-by-step" is a presentation choice, not a
   lower expectation.
4. **The learner always has agency.** Any adapted view can be switched back to
   the original, changed to another style, or made more detailed.
5. **Explicit human configuration outranks inference.** A learner's own choice
   outranks teacher guidance; teacher guidance outranks observed signals;
   observed signals only become persistent after enough consistent evidence.
6. **There is no "disability mode".** There is "Personalized Learning" with
   granular, respectful preferences.

## What every learner can control — "How I Learn"

| Area | Options | Effect |
| --- | --- | --- |
| How much on each screen | More at once / Balanced / Roomier | `density` — drives chunking and spacing of lesson views |
| Text size | Smaller / Standard / Larger | `textSize` — CSS text-size class on lesson content |
| Screen contrast | Standard / High contrast | `contrast` — high-contrast class for readability |
| How explanations are written | Short and clear / Step by step / Examples first / Detailed | `explanationStyle` — the learner's default adaptation code |
| Examples | A few / Some / Plenty | `exampleFrequency` — desired worked-example density |
| Visual support | on/off | `visualSupport` — structured, visual presentation |
| Listen to lessons | on/off | `readAloud` — shows a "Listen" button that reads lessons aloud |

Every saved preference is labelled with its source so the learner always knows
what is "chosen by you" versus a teacher recommendation versus a system
default. Changing a preference takes effect from the learner's next lesson and
persists across devices and logins.

## What the teacher sees

The teacher student-management page includes a **learning support summary** for
each student:

* current mastery;
* **Responds well to** — behaviours with consistent positive evidence (e.g.
  "Step-by-step explanations");
* **Currently benefits from** — contextual notes (e.g. repetition in
  fractions), when available;
* **Preferred presentation** — the effective profile, labelled with its source;
* **Add your guidance** — the teacher can recommend a presentation preference.
  If the learner has chosen that dimension themselves, the learner's choice
  wins and the teacher is told so respectfully.

Teachers never see AI-inferred diagnoses. The summary is deliberately a
*learning-support* view, not a psychological profile.

## What the guardian sees

The guardian ward page includes **"How `<child>` is learning right now"** — a
plain-language sentence such as:

> "Elekeza is presenting lessons in a way that suits Juma right now. Lessons
> are broken into small, step-by-step sections, which has been helping them
> work through activities…"

Guardians see only their own linked wards, and only an understandable summary —
no internal confidence scores, no inferred labels.

## Sources and precedence

Every preference has a source: `EXPLICIT` (learner), `TEACHER`, `GUARDIAN`,
`OBSERVED` (behaviour with evidence), or `SYSTEM` (default). Resolution order:

```
EXPLICIT  >  TEACHER  >  GUARDIAN  >  OBSERVED  >  SYSTEM
```

* The learner can always change their own preference.
* Teacher/guardian guidance never overwrites a preference the learner chose
  explicitly (the write is rejected with a clear conflict response).
* Observed signals require at least 3 consistent events and confidence ≥ 0.6
  before they become persistent `OBSERVED` preferences; confidence decays over
  time so inferences re-evaluate instead of permanently labelling a learner.

## Same lesson, different learners

| Learner | Profile | Result |
| --- | --- | --- |
| A — standard | defaults | Original lesson, normal density |
| B — high support | Step-by-step, Roomier, Plenty examples | Step-structured, spaced, example-rich presentation of the **same** content |
| C — advanced | Detailed | Structured, more thorough presentation; challenge remains available |
| D — accessibility | Larger text, high contrast, read-aloud | Same content in a more readable presentation with audio |

The lesson never changes *what* is taught: adaptation changes presentation and
support. Original content remains available to every learner at all times.

## Scope

Personalization is expressed per student globally today. The preference model
(JSONB key/value with source metadata) and the adaptation cache key are
designed to extend to student × subject/competency scope without schema change;
that extension is listed as future work, not shipped scope.
