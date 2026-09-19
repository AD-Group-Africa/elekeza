# ACCESSIBILITY — Elekeza

Target: **WCAG 2.1 AA now; 2.2 AA as the next hardening pass.** Accessibility is Universal Design — built into the platform, not an isolated "SNE feature".

## What is implemented (verified in code)

### Perceivable

- `lang="en"` on the root document; metadata-driven titles (stale template `head.tsx` removed)
- `role="status"` / `role="alert"` / `aria-live` on load, save, error and offline messages across learner, exam, quiz, login, register and forgot-password surfaces
- Large, readable learner typography with spacing controls; global `*:focus-visible` outline in `globals.css`
- Non-color-only meaning: icons + text accompany state everywhere (connectivity, quiz feedback, achievements)
- Resizable/reflow-friendly layouts; tablet-first learner sizing

### Operable

- **Skip navigation** (WCAG 2.4.1): "Skip to main content" link as the first focusable element in `SidebarLayout` and `DashboardLayout`, targeting `main#main-content`
- `aria-current="page"` on all sidebar navigation links in `SidebarLayout`, `Sidebar`, and `RoleLayout`
- Global reduced-motion support (`prefers-reduced-motion` in `globals.css`; `LearningCompanion` and `Celebration` disable animation)
- No drag-only or gesture-only interactions in any learner flow
- Server-authoritative exam timing with visible countdown — timing is required for exam integrity but never used as a pedagogical gate in lessons or quizzes
- Large touch targets in learner surfaces (≥ 92px primary actions on learner home)

### Understandable

- One primary action per learner screen; companion greets and guides
- Explicit, plain-language errors (`role="alert"`), honest empty states, offline notices that say what actually happened ("Saved offline — will sync when you reconnect")
- Consistent shells and predictable navigation across roles
- Forgiving quiz feedback ("Not quite — keep going, you are learning.") — no shame mechanics

### Robust

- Semantic HTML (`main`, `nav`, `aside`, headings), native elements over ARIA reinvention
- Accessible names on icon-only controls (sidebar collapse, mobile menu, logout)

## Beyond WCAG: cognitive accessibility

- Per-learner presentation profile (`/learner/preferences`): density, explanation style, example frequency, text size, contrast, visual support, read-aloud
- Deterministic, curriculum-safe text adaptation: `ORIGINAL / CLEARER / STEP_BY_STEP / SPACED / DETAILED` — never invents facts, never drops key terms (enforced by `AdaptationSafety.validate`)
- Observed preferences flip only after repeated evidence (`SignalAccumulator`: ≥3 events, ≥0.6 confidence, time decay) — a single interaction never re-labels a learner
- Explicit source precedence: **EXPLICIT (learner) > TEACHER > GUARDIAN > OBSERVED > SYSTEM** — the learner can always override any inference

## Disability coverage in the model

The learner model supports configurable needs (dyslexia, dyscalculia, autism-related sensory/cognitive preferences, intellectual disability, cerebral palsy, visual/hearing/speech differences, motor limitations, attention difficulties) — as **preferences and support needs, never as behavior-inferred diagnoses**. AI output is guarded against diagnostic phrasing (`AdaptationSafety.DIAGNOSTIC_PHRASES`), and teacher/guardian surfaces use plain, respectful language.

Cerebral palsy and motor limitations are first-class: large targets, no precision-dependent interactions, no timed lesson interactions, persistent progress, forgiving forms, full keyboard operability in the shells.

## What is tested

- Keyboard: skip link reaches `main#main-content`; nav is link/button-based; global focus-visible ring
- Reduced motion: honored globally and in companion/celebration components
- Screen-reader semantics: status/alert/live regions on every async learner interaction
- Automated: typecheck + lint + build all green after the accessibility pass (151 backend tests unaffected)

## Honest gaps (next passes)

1. **Real-user testing with learners with disabilities** — not yet done; automation cannot substitute for it
2. Full screen-reader walkthrough (NVDA/VoiceOver) documented per journey
3. Zoom/reflow audit at 400%, high-contrast OS themes, 200% text enlargement
4. Captions/transcripts pipeline for any future audio/video content
5. Switch-access and alternative-input testing
6. WCAG 2.2 additions: focus appearance, dragging alternatives, target size (minimum) formal audit

**Status: YELLOW** — strong implemented foundation with verified primitives; formal assistive-technology validation with real users is a pilot-phase requirement, not a completed one.
