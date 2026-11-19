# ELEKEZA — ACCESSIBILITY AUDIT (WCAG 2.2 AA)

**Date:** 14 Nov 2026 · **Branch:** `sprint-3-safe-config` @ `47d17f5`
**Standard applied:** WCAG 2.2 AA (the brief's target). Where the repo tests against 2.1, that is called out.
**Method:** static source inspection + review of the existing automated axe-core gate. **No manual screen-reader pass, no device pass and no real-user testing was performed in this audit.** Claims are marked accordingly.

---

## 1. Headline position

The accessibility *engineering* in this codebase is better than typical for this stage: there is a dedicated settings provider, real CSS classes for calm/high-contrast/dyslexia/reduced-motion modes, a skip link, `aria-current` on navigation, a reading-ruler component, and an axe-core gate wired into CI as a release gate.

The three real problems are **coverage**, **conformance target**, and **feature accessibility** — not absent intent:

| Issue | Severity |
|---|---|
| Automated gate tests WCAG **2.1**, not the 2.2 the brief requires | P2 |
| Gate covers **7 of 61 routes**; no admin/school-admin surface is scanned at all | **P1** |
| Assistive features exist in settings but are only wired on one page; several do not work end-to-end | **P1** |
| No manual screen-reader, keyboard-only or switch-access validation recorded anywhere | **P1** |
| No Kiswahili / no second language at all (`LanguageToggle.tsx` is a 0-byte file) | P2 |
| 11 authenticated routes render outside any app shell, so they lose the skip link entirely | P2 |

---

## 2. Findings

### A11Y-P1-01 — The accessibility gate covers 7 of 61 routes, and no administrator surface at all

- **Component:** `frontend/e2e/a11y.spec.ts`
- **Evidence:** The spec scans exactly seven pages: `/login`, `/student-home`, `/progress`, `/learner/preferences`, `/student-exams`, `/teacher/students`, `/guardian`. The route inventory counts **61** `page.tsx` routes. There is no `SCHOOL_ADMIN` or `ADMIN` login anywhere in the E2E helpers (`frontend/e2e/helpers.ts` exports only `LEARNER`, `TEACHER`, `GUARDIAN`), so `/admin`, `/admin/staff`, `/finance`, `/attendance`, `/analytics` and `/super-admin` are never scanned or crawled.
- **Expected:** Every route in the inventory scanned at least once per role that can reach it, with a documented rule for pages excluded because they are placeholder or redirect-only.
- **Actual:** 54 routes unverified. The most complex, most form-dense surfaces (attendance register, finance, staff management) have **zero** automated accessibility evidence.
- **Impact:** The release gate reports "Accessibility PASS on tested surfaces" — true, but easily misread as product-wide. For an inclusive-education product this is the most damaging kind of gap: a school admin with a screen reader is the least-tested user in the system.
- **Remediation:** Add `SCHOOL_ADMIN` and `ADMIN` fixtures; extend the scan list to cover every route returned by the route inventory, grouped by role; keep exclusions in an explicit allowlist with a reason per entry.
- **Acceptance criteria:** A CI run produces one axe result per route per role, the excluded list is empty except for documented placeholders, and any new route without a scan fails the build.

### A11Y-P1-02 — The conformance target is WCAG 2.1, not 2.2

- **Component:** `frontend/e2e/a11y.spec.ts`
- **Evidence:** `new AxeBuilder({ page }).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa'])`. The 2.2 tag set (`wcag22aa`) is absent.
- **Impact:** The 2.2 additions that matter most for this audience are exactly the ones untested: **2.4.11 Focus Not Obscured (Minimum)**, **2.5.7 Dragging Movements**, **2.5.8 Target Size (Minimum) 24×24**, **3.3.7 Redundant Entry**, **3.3.8 Accessible Authentication**. `SidebarLayout` renders a fixed bottom navigation on mobile with 56 px targets (good) but there is no measurement of the rest of the app, and the floating Elekeza Assist pill and the mobile hamburger are `fixed` overlays that can obscure a focused element — precisely what 2.4.11 exists to catch.
- **Remediation:** Switch the tag set to include `wcag22aa`; add explicit checks for target size on icon-only buttons, for focus obscuring by the fixed bottom bar and Assist pill, and for accessible authentication on `/login` (no cognitive test, paste allowed).
- **Acceptance criteria:** The gate fails if a focused control is fully covered by a fixed overlay, and if an interactive target measures under 24×24 CSS px.

### A11Y-P1-03 — Assistive features are present in settings but not wired into learning workflows

- **Component:** `useAccessibilitySettings`, `useTextToSpeech`, `/student-ai-tutor`, lesson/quiz pages
- **Evidence:** The settings provider defines and applies CSS classes for `calmUI`, `focusMode`, `highContrast`, `dyslexiaSupport`, `reducedMotion`, `largeText`, a `fontFamily` enum including `dyslexiaFriendly`, and a `textToSpeech` flag. However, `grep -rl 'speechSynthesis|SpeechRecognition'` matches **only two files**: `hooks/useTextToSpeech.ts` and `app/student-ai-tutor/page.tsx`.
- **Expected:** "Read aloud" available wherever there is substantial text a learner must read — lesson body, quiz question and answer options, assignment instructions, exam questions. This is a core inclusion requirement, not a nice-to-have.
- **Actual:** Text-to-speech exists on the AI tutor page and nowhere else. A learner who needs reading support in a **quiz** — the highest-stakes reading moment in the product — has no read-aloud. There is no speech-to-text at all (`SpeechRecognition` has zero matches), so a learner who cannot type has no input alternative.
- **Also:** no captions/transcripts are applicable yet (no audio/video content surfaced in the app), which should be stated rather than assumed.
- **Remediation:** Extract a `<ReadAloud>` control and mount it on lesson, quiz question, exam question and assignment surfaces; persist the reading position; respect `prefers-reduced-motion` and `textToSpeech` preference; add speech-to-text as an input method for short answers where the pedagogy allows.
- **Acceptance criteria:** A learner can complete an entire quiz using only keyboard + read-aloud + speech-to-text, and the preference survives navigation.

### A11Y-P1-04 — No manual verification of screen-reader, keyboard-only or switch access is recorded

- **Component:** process / evidence
- **Evidence:** `docs/ACCESSIBILITY.md` exists and `a11y.spec.ts` explicitly labels itself "the automated floor, not the whole claim". No document records an NVDA/TalkBack/VoiceOver pass, a keyboard-trap test, or a reduced-mobility evaluation.
- **Impact:** For a product whose stated mission is learners with disabilities, an automated axe pass is a floor that will not catch focus-order defects, meaningless ARIA on custom widgets, unlabelled icon buttons (one was just found and fixed in guardian messaging), or unusable quiz controls under a screen reader.
- **Remediation:** Record a manual matrix: OS × browser × AT (NVDA+Chrome, TalkBack+Android, VoiceOver+iOS) × 5 critical journeys. Include at least one learner with lived experience of a reading or motor difficulty in the pilot accessibility review.
- **Acceptance criteria:** A signed manual report exists for the five critical journeys on each AT combination, listing defects found and their fixes.

### A11Y-P2-01 — Eleven authenticated routes render outside the application shell and therefore lack the skip link and landmark structure

- **Evidence:** `SidebarLayout` contains the only `Skip to main content` link and `<main id="main-content">`. A route only gets it by importing `SidebarLayout`/`DashboardLayout`, or by sitting under `/guardian` or `/teacher` layouts (the only three layouts in the app: root, guardian, teacher). Routes with **no** shell: `/admin/staff`, `/analytics`, `/assignments`, `/attendance`, `/exam`, `/finance`, `/government`, `/marketplace`, `/school/onboarding`, `/teacher-assignments`, `/therapist`.
- **Impact:** Keyboard users on the attendance register or finance dashboard have no bypass mechanism (WCAG 2.4.1) and land at the top of a long form on every navigation.
- **Remediation:** Move the shell into route-group layouts (`(staff)`, `(learner)`, `(admin)`) so every authenticated route inherits the same landmarks, skip link and `<main>`. This is the same change that fixes the visual sidebar problem — see `ELEKEZA_UI_UX_REVIEW.md` UX-P1-01.
- **Acceptance criteria:** Every non-public route renders exactly one `<main>`, exactly one skip link, and one navigation landmark.

### A11Y-P2-02 — No second language; the language toggle is an empty file

- **Evidence:** `frontend/src/components/LanguageToggle.tsx` is **0 bytes**. `frontend/src/contexts/LocaleContext.tsx` is under 200 bytes. `grep -i "kiswahili"` over `frontend/src` returns nothing.
- **Impact:** The brief asks for Kiswahili support. There is no i18n layer and no string catalogue, so this is a build task, not a switch. For a Kenyan product serving the stated audience, English-only is a real inclusion barrier for both learners and guardians.
- **Remediation:** Introduce a message catalogue (e.g. `next-intl`) with `en` + `sw`; extract learner and guardian strings first; do not localise the admin surfaces in the first pass.
- **Acceptance criteria:** A guardian can switch to Kiswahili and complete the messaging and progress-reading journeys without English fallback text appearing.

### A11Y-P2-03 — Icon-only controls remain a recurring defect class
The guardian send button was just given an `aria-label`. The same pattern must be audited everywhere: `SidebarLayout`'s collapse button uses `Menu`/`X` icons with a label (good), but `DashboardLayout`/`Navbar` and various page-level icon buttons were not systematically checked. Treat "icon-only button without accessible name" as a lint rule (`jsx-a11y/control-has-associated-label`) rather than a manual review.

### A11Y-P3-01 — Reading-ruler and reading-toolbar components exist; their coverage is unverified
`components/accessibility/ReadingRuler.tsx` and `ReadingToolbar.tsx` are present. Which routes mount them was not established in this pass; a learner should not have to discover a separate page to get a reading aid.

---

## 3. Component-level notes from inspection

| Surface | Observation |
|---|---|
| `SidebarLayout` | Skip link present and correctly first-focusable; `aria-current="page"` on active links; mobile bottom nav has `aria-label="Primary"` and ≥56 px targets; hamburger and Assist pill are `fixed` and can overlap focused content (2.4.11 risk). |
| `Sidebar` (learner) | `aria-current` on active link, `aria-label` on collapse and logout; good. Used by `DashboardLayout`. |
| `RoleLayout` | No skip link, no `<main id>`, no `aria-current` on nav links, footer says "Copyright 2026 DocuEase". Not compliant enough to be a shell. |
| Guardian messaging | Fixed in `47d17f5`: send button now has an accessible name that changes with state. |
| Attendance register | Status controls are real radios (good pattern); page has no shell, so no skip link. |
| Quiz | Answer options are buttons labelled `A.`/`B.`; acceptable names, but no read-aloud and no documented screen-reader pass. |

---

## 4. What must be true before the pilot

1. Route-group layouts so all 61 routes inherit one shell, one `<main>`, one skip link.
2. Gate switched to WCAG 2.2 AA tags, extended to all routes, with `SCHOOL_ADMIN`/`ADMIN` fixtures.
3. Read-aloud on every substantial reading surface (lesson, quiz, exam, assignment).
4. One recorded manual AT pass across the five critical journeys.
5. A written decision on Kiswahili: either committed scope for the pilot or explicitly deferred with a date.

Items 1–3 are engineering. Item 4 needs a human tester. Item 5 is a product decision.
