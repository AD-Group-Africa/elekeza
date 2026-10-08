# ELEKEZA — ACCESSIBILITY

> Canonical accessibility reference. Target: **WCAG 2.1 AA now; 2.2 AA as the next hardening pass.**
> Accessibility is Universal Design — built into the platform, not an isolated "SNE feature".
> **No clinical claims. Elekeza does not diagnose disabilities.**

## 1. The assistive identity (must stay real)

Elekeza was founded as assistive technology. It supports different learning needs through
**accessibility and personalization — never medicine**:

- dyslexia-type reading needs → OpenDyslexic + font scaling, spacing, chunked sections, TTS,
  CLEARER/STEP_BY_STEP/SPACED presentation
- dyscalculia-type needs → step-by-step structure, examples-first, low-distraction surfaces
- autism-related needs → calm theme + calm mode (flat, motion ≈ 0, predictable navigation)
- attention difficulties → one primary action per screen, focus mode, spaced presentation
- intellectual disabilities → validated simplified language, large targets, forgiving feedback
- cerebral palsy / motor access → large targets, no precision gestures, keyboard operability, no
  timed lesson gates
- language barriers → simplified explanations; Kiswahili toggle where implemented
- different speeds → self-pacing, persistent progress, repetition without penalty

**Never claimed:** diagnosis, therapy, clinical outcomes. AI output is screened against a
diagnostic-phrase blacklist (`AdaptationSafety`), and teacher/guardian summaries are tested to never
contain diagnostic terms.

## 2. Preference systems (both verified)

| System | Store | Scope | Surface |
|---|---|---|---|
| Instant a11y settings | `localStorage['elekeza-settings']` → `useAccessibilitySettings` hook → `a11y-*` body classes (BODY_CLASS_MAP) | per-device, all roles | AccessibilityToolbar, dashboard settings |
| Server learner preferences | `/learner/preferences` (PUT {key,value}) + `/dashboard/settings` mirror → `accessibility_profiles` (ttsEnabled etc.) | per-user, cross-device | How I Learn (`learner/preferences`), lesson TTS gate (serverTts) |

The two systems coexist deliberately: instant local rendering + durable server profile. Documented
so future work unifies rather than duplicates.

## 3. Implemented WCAG-oriented controls (verified)

- **Perceivable:** `lang="en"`; metadata titles; role="status"/"alert"/aria-live on load/save/error/
  offline across learner surfaces; readable type scale; high-contrast preference; non-colour-only
  meaning (icons + text everywhere); calm/large-type modes.
- **Operable:** skip link ("Skip to main content" → `main#main-content`) in `SidebarLayout` and
  `DashboardLayout`; `aria-current="page"` on nav links; global `*:focus-visible` ring (token-driven
  per theme); reduced-motion honoured globally (`prefers-reduced-motion`) incl. companion/
  celebration components; no drag-only/gesture-only interactions; large touch targets (learner
  primary actions ≥ ~40–92px); exam timing server-authoritative and never a lesson gate.
- **Understandable:** one primary action per learner screen; plain-language errors; honest empty
  states; forgiving quiz feedback; consistent shells.
- **Robust:** semantic HTML (`main/nav/aside/headings`), native elements over ARIA reinvention,
  accessible names on icon-only controls (sidebar collapse, mobile menu, logout).

## 4. Cognitive-load design

Adaptation visible but unobtrusive: one idea per card/step for high-support learners; pill-sized
presentation bar; feedback asked once; "Back to the original" always in reach; learner agency rule
EXPLICIT > TEACHER > GUARDIAN > OBSERVED > SYSTEM (single interactions never re-label a learner —
observed preferences require ≥3 consistent events, ≥0.6 confidence, time decay).

## 5. Elekeza Assist accessibility requirements (verified 2026-10-03 closure)

The floating assistant ([ElekezaAssist.tsx](../frontend/src/components/assist/ElekezaAssist.tsx))
is: keyboard operable (trigger focusable, Esc closes, focus returns — verified live), screen-reader
labelled, `role="dialog"` + focus trap when open, reduced-motion aware, ≥44px trigger target, never
auto-opening, honest about being automated, and **geometry-safe**: anchored to the content column
via the sidebar-width-aware `collapsed` prop so it can never intercept the sidebar Logout button
or the mobile bottom navigation (verified by probe + all five journeys green).

## 6. Honest gaps

1. **Real-user validation with learners with disabilities not yet done** — the primary pilot
   deliverable; automation cannot substitute.
2. Full screen-reader walkthrough (NVDA/VoiceOver) per journey — manual only so far.
3. Zoom/reflow 400%, high-contrast OS themes, 200% text — audit scheduled.
4. Automated axe/Playwright WCAG suite **not yet in CI** (manual checks done this closure; CI suite
   tracked as post-closure work).
5. Switch-access / alternative-input testing — not started.
6. WCAG 2.2 additions (focus appearance, dragging alternatives, target-size minimum) — formal audit
   pending.

**Status: YELLOW** — strong verified foundation; formal assistive-technology validation with real
users is a pilot-phase requirement, not a completed one.
