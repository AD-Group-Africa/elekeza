# ELEKEZA — UX AND DESIGN SYSTEM

> Canonical UX reference. Contains the colour system, role-specific experiences, navigation rules,
> back-button contract, notification/Assist behaviour, and responsive standards.

## 1. Colour system (consolidated)

The repo carries **three generations of visual direction**: (a) purple glassmorphism era,
(b) the moss-green token architecture (`docs/archive/` DESIGN_SYSTEM: tokens.css + theme-remaps.css,
themes dark/light/calm), (c) scattered semantic utilities (attendance page's gray/emerald light
theme). Consolidation rule:

| Token role | Value | Rule |
|---|---|---|
| **PRIMARY — purple** | existing purple brand scale (globals.css tokens) | brand/identity, primary actions, active nav; **deliberate, not everywhere** |
| **SECONDARY — deep forest / moss green** | `--ek-moss-*` scale (existing tokens) | secondary surfaces, learning/positive emphasis, calm theme base |
| ACCENT | `--ek-ember-*` (softened ember) | emphasis/selected states only — never warnings, never large fills |
| SUCCESS / WARNING / ERROR / INFO | semantic `--ek-ok/warn/danger/info` | status semantics only |
| SURFACE / TEXT / BORDER / FOCUS | `--bg-*/--text-*/--border-*/--focus-ring` per theme | all surfaces read tokens; themes: dark (default), light, calm |

**Anti-pattern to retire:** glassmorphism-as-design (translucent blur panels as a style statement).
Glass effects may remain only where they serve legibility, never as the design idea. New surfaces
use token classes (`btn-primary`, `btn-secondary`, `ek-card`) — no raw purple/blue/amber utilities;
the generated remap layer keeps legacy pages correct while pages are touched.

**Known outlier:** attendance page uses light gray/emerald utilities — reconcile to tokens during
this closure (it was already contrast-fixed: `text-gray-900` + emerald-700 button).

## 2. Role-specific experiences (rule: “this is my space”)

| Role | Home | Primary actions |
|---|---|---|
| LEARNER | learner home (companion greeting) | Learn → Continue → Practice → Progress → Help. **No admin navigation, ever.** |
| GUARDIAN | **“Today” home** (ward digest) | See child's day, progress, communication, fees |
| TEACHER | teacher dashboard | Students, assignments, attendance, analytics |
| SCHOOL_ADMIN | school dashboard | Learners, staff, classes, finance, settings |
| ADMIN | platform admin | cross-institution oversight |

Learner screens are audited against: typography, button size, navigation depth, reading difficulty,
contrast, spacing, **number of actions per screen**, language, audio support, feedback, errors,
progress indicators.

## 3. Guardian “Today” home (implemented contract)

Order of answers on the guardian dashboard: **what is my child learning → what did they complete →
anything I should know → how progress is going**. Concretely: Today at a glance card (lessons done,
attendance, classwork ✓/○/past-due, fees balance) → progress bars per subject → teacher note →
actions `[View Progress] [Support My Child] [Contact School]`. Do not overcomplicate; no ERP widgets;
ward-scoped by server checks. (Existing: `guardian/page.tsx` + DailyDigest; this session's polish
keeps that hierarchy and clarifies labels.)

## 4. Navigation

**Desktop (≥1024px): side navigation** via `SidebarLayout` — learner: Home, Learning, Progress,
Messages, Support, Settings. School administration: Dashboard, Learners, Classes, Teachers,
Learning, Guardians, Reports, Communication, Settings, Audit (as implemented per role).

**Mobile (<768px): bottom navigation** (this session's closure work): learner
`Home | Learn | Progress | Help | Profile`; guardian `Home | Child | Progress | Messages | More`.
The desktop sidebar is never forced onto mobile; bottom nav is fixed, safe-area aware
(`env(safe-area-inset-bottom)`), ≥48px targets, `aria-current` preserved.

**Back button contract:** browser/device back must never log out, reset workflows, duplicate form
submissions, or land on unrelated screens. In-app `← Back` appears only where hierarchy requires it
(lesson → learner home; ward detail → guardian home; assignment → list; settings groups). Back
never closes modals unexpectedly — modals own their own close.

## 5. Notifications vs Elekeza Assist (the clash fix)

**Problem (verified):** the in-app notification popovers and tutor/chat UI occupied the same
screen region as page controls and each other — notification clashes with content, chat looks like
a generic AI widget.

**Resolution (this session):**
- **Notifications** = system surface: bell in the top bar (existing `NotificationBell`) → panel;
  toasts for transient confirmations only (dismissible, auto-stack limit, never cover nav/forms,
  keyboard reachable, mobile-safe).
- **Elekeza Assist** = the assistance interface: **bottom-left floating assistant**.

```
┌──────────────────────────────────────────┐
│              PAGE CONTENT                │
│                                          │
│                                  ┌─────┐ │   collapsed: “?” button, bottom-LEFT
│ ┌────────────────────┐           │  ?  │ │
│ │ Elekeza Assist     │           └─────┘ │   expanded: panel with actions:
│ │ How can I help?    │                   │   Explain this lesson · Read this aloud ·
│ │ [ Explain lesson ] │                   │   Help me understand
│ │ [ Read aloud ]     │                   │
│ │ Ask anything...    │                   │
│ └────────────────────┘                   │
└──────────────────────────────────────────┘
```

Requirements (binding): bottom-left placement; never covers primary controls or form fields;
responsive (desktop floating, mobile sheet above bottom nav); keyboard accessible (focus trap in
panel, Esc closes, focus returns to trigger); screen-reader labelled (`aria-label="Elekeza Assist"`,
`role="dialog"` when open); expand/collapse with a clear close button; **never auto-opens**; never
pretends to be human (labels itself “Elekeza Assist — automated helper”); never fabricates
educational information (tutor answers come from the lesson/AI contract in AI_ARCHITECTURE.md);
respects `prefers-reduced-motion`; safe-area aware; preserves page context (lesson-aware actions).

## 6. Notification types (do not treat every event as a toast)

| Type | Surface | Behaviour |
|---|---|---|
| Toast | transient, bottom/top corner | confirmations only; auto-dismiss; max 3 stacked |
| System notification | bell panel | persistent, mark-read, deep-link |
| Message | guardian/teacher communication | thread surface (EL-NEW-02 fix tracked separately) |
| Alert | role="alert" inline | errors/validation, announced |
| Assist prompt | Elekeza Assist panel | contextual help, never auto-open |

## 7. Responsive standards (audit grid 320/375/390/430/768/1024/1280/1440)

Forbidden at any width: clipped navigation, overlapping modals, inaccessible buttons, notification
collisions, floating assistant covering controls, broken tables, horizontal overflow, unusable
forms. Tables collapse to cards on mobile; bottom nav + safe areas on phones; sidebar persists on
desktop; learner typography scales via preference classes (`a11y-*` body classes from
`useAccessibilitySettings`).

## 8. Loading / empty / error states (rule)

Every async surface has all three, in plain language: loading = skeleton or announced text (not
only spinners); empty = honest “nothing here yet” with the next action; error = what happened +
what to do, announced via role="alert". Offline: “Saved offline — will sync when you reconnect”
style honesty; no fake success.
