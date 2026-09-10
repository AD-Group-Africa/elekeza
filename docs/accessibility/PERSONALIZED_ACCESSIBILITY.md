# Personalized Accessibility

## Approach

Elekeza does not ship a separate "accessible mode" or "disability mode".
Accessibility is a set of granular, learner-controlled preferences inside
**How I Learn**, the same place every learner personalizes their experience.
This keeps the product calm, modern and respectful — a learner who benefits
from larger text or read-aloud uses ordinary, dignified controls, and a learner
who needs nothing extra simply keeps the standard presentation.

Accessibility preferences implemented:

| Preference | Learner-facing option | What it does |
| --- | --- | --- |
| Text size | Smaller / Standard / Larger | Applies a text-size class to lesson content |
| Contrast | Standard / High contrast | High-contrast styling for text/background separation |
| Density | More at once / Balanced / Roomier | Roomier = one idea at a time, extra spacing |
| Explanation style | Short & clear / Step-by-step / Examples first / Detailed | Chooses the default adapted presentation |
| Visual support | on/off | Structured/visual lesson presentation |
| Listen to lessons | on/off | Adds a "Listen to this lesson" button (Web Speech API) |

All of these are ordinary preferences with no diagnostic connotation — no
learner is ever asked to select a "condition" and no profile is ever labelled.

## WCAG-oriented review

The learner-facing surfaces (How I Learn page, lesson page, adaptation
controls, teacher support panel, guardian card) follow:

* **Semantic structure** — pages use real headings, `main`, labelled form
  groups; preference groups are fieldset/radiogroup elements with visible
  legends and `aria-label`s; toggles are `role="switch"` with accessible
  names.
* **Keyboard access** — every control is a native `<button>`, radio or link,
  so the default tab order works; focus states are visible; Enter/Space
  activate buttons.
* **Screen readers** — icons carry `aria-label`s ("Yes, helpful",
  "Not helpful"), the read-aloud button announces state via
  `aria-pressed`, loading states are announced as text, not only spinners.
* **Colour independence** — status/feedback is never conveyed by colour
  alone ("Could not save that preference…", "Thanks — Elekeza keeps learning
  …", "Guidance was not applied" are textual).
* **Contrast & typography** — readable type scale, letter-spaced
  uppercase labels kept small and decorative, `high-contrast` and
  `a11y-font-lg/sm` utilities applied from profile values.
* **Motion** — the app respects OS-level reduced motion through CSS
  (`prefers-reduced-motion`) where animations are used; spinners are small and
  non-essential.
* **Touch targets** — controls are padded to ≥ ~40px hit areas on mobile.
* **Error recovery** — every failing network action on the lesson/preferences
  pages degrades to a visible message while keeping the original content
  usable.

## Language that preserves dignity

The UI never uses "deficient", "low ability", "cognitive problem", "disabled
learner", "slow learner", "special needs mode" or diagnostic phrasing. It uses
"How I Learn", "Learning support", "Preferred learning style", "Areas needing
practice" and "Helpful strategies". Teacher/guardian summaries are checked by
backend tests to never contain diagnostic terms
(`dyslexia`, `adhd`, `autistic`, `disability`, `diagnos…`).

## Cognitive-load design

Adaptation is visible but unobtrusive:

* high-support learners get one idea per card/step instead of a wall of text;
* the adaptation bar is collapsible in visual weight (small pill controls);
* feedback prompts appear once per adaptation and disappear after answering;
* every adapted view keeps "Back to the original" in reach.

## Verification

* Live browser checks: the How I Learn page and lesson adaptation controls
  were exercised end-to-end (see acceptance doc), including the read-aloud
  button state and feedback flow.
* Automated coverage: personalization tests assert the accessible labels and
  dignity-language rules at the API level; TypeScript/ESLint clean.
* Residual gaps (documented): a full automated axe/Playwright WCAG suite is
  not yet part of CI, and automated keyboard walkthroughs are manual for now.
