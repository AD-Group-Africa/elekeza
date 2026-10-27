# Theme system: role palette x mode

## How it works

Two attributes on `<html>` drive every colour:

| Attribute | Values | Set by |
|---|---|---|
| `data-role` | `learner` (bright purple), `teacher` (moss green), `guardian` (forest green), `admin` (light blue) | `RolePaletteSync`, from the signed-in user's role (`SCHOOL_ADMIN` and `ADMIN` both use `admin`) |
| `data-theme` | `dark` (default), `light` (warm cream), `calm` (low stimulation) | Accessibility settings (Appearance: Light Theme, Calm Mode; calm wins) |

- `src/styles/tokens.css` defines every colour ramp at `:root`, maps the generic `--hue-*` ramp per role, and derives the semantic tokens (`--bg-*`, `--text-*`, `--accent*`, `--border-*`) and the legacy `--p*` aliases per mode. 4 roles x 3 modes = 12 looks from 7 blocks.
- `src/styles/theme-remaps.css` keeps legacy palette classes (`text-purple-200`, `bg-purple-600` ...) working through the `--p*` aliases. A light/calm compatibility layer keeps white-on-dark utilities (`text-white`, `bg-white/10`, pale status text) readable on cream and calm surfaces, except on filled buttons and accent gradients.
- `src/app/layout.tsx` restores both attributes from local storage before first paint, so reloads never flash the wrong colours. `RolePaletteSync` keeps `data-role` current after sign-in. While signed out, the last palette stays.
- `--accent-hover` is the hover fill for filled buttons. `--accent-strong` is the readable accent text colour.

New code should use the semantic Tailwind tokens (`bg-canvas`, `bg-surface`, `text-fg`, `text-fg-muted`, `border-line`, `bg-accent`, `hover:bg-accent-hover`, `text-accent-strong`) rather than palette classes.

## What was verified (2026-10-27, branch `Iyann`)

- `npx tsc --noEmit`: clean. `npm run lint`: clean. `npx vitest run`: 50/50 (19 new). `npm run build`: compiled successfully.
- New guard test `src/styles/tokens.test.ts`:
  - every mode defines every semantic token
  - every role defines the whole hue ramp
  - no impossible `[data-theme=a][data-theme=b]` selectors
  - every `var(--x)` used anywhere resolves in every role and mode

  Run against the previous CSS, it fails on the exact variables that made the light-mode Login button disappear (`--ek-blue-700` and the rest).
- Browser check against the real backend (dev profile, demo accounts), signed in as learner, teacher, guardian and admin:
  - All 12 role x mode combinations: the correct `data-role` and `data-theme` are present at `DOMContentLoaded` (before React hydrates) and after hydration, and they survive a reload.
  - 9 contrast pairs per combination (body text, secondary, muted, button text, button hover, accent text, legacy purple text, success, danger): all 108 are >= 4.5:1 (WCAG AA). The lowest is 4.64 (admin dark danger text).
  - Login button in light mode: purple fill `#7c3aed` with white text (previously white on white).
  - Screenshots reviewed: every role in every mode at 1280px, and every role in light mode at 390px.
  - Learner screens (home, lessons, a lesson, quizzes, progress, settings) were reviewed in all three modes.

## Known limitations / next steps

- Teacher (moss) and guardian (forest green) are close in hue. Waiting on product direction for guardians.
- Lesson body text still uses the legacy purple class, so it reads in the role colour rather than near-black. It is readable (>= 4.5:1) but will move to `text-fg` during screen migration.
- About 550 legacy palette classes remain in screens. The compatibility layer keeps them readable. Migrating screens to semantic tokens is the next workstream.
- Theme mode is saved on the device and mirrored to `/api/accessibility-profiles`, but it is not yet loaded back on sign-in. Custom accent colours need a new allowed key on that endpoint (backend dependency).
