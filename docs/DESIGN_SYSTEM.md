# ELEKEZA DESIGN SYSTEM — Moss-Green Token Architecture (2026-09-17)

Status: **IMPLEMENTED & VERIFIED** (production build + live preview; see Evidence)

## 1. Audit findings (what was wrong)

| Finding | Scale | Resolution |
| --- | --- | --- |
| Purple-era hardcoded palette (Tailwind `purple/violet/indigo/fuchsia` utilities) | 875 instances / 65 files, 89 distinct classes | All remapped to tokens via generated remap layer — zero component edits |
| Blue-family utilities from an older identity | ~35 instances (incl. the login CTA gradient) | Remapped (second inventory pass) |
| Orange used aggressively | amber/orange accents | Reduced to one softened ember accent `#E8935A` (`--ek-ember-500`), used for emphasis only |
| `.btn-primary` **used in 5 files but never defined** — buttons rendered unstyled | real defect | Defined as a token-driven primitive (plus `.btn-secondary`, `.btn-warm`, `.ek-card`) |
| Single light theme with hardcoded sunset-orange overrides in CSS | 1 theme | Replaced by tokenized **dark / light / calm** themes |
| Body CSS hardcoded a purple gradient | global | Body now reads `--bg-gradient` per theme |
| Focus ring hardcoded violet | global | `*:focus-visible` reads `--focus-ring` per theme |
| Chart tooltip colors hardcoded | recharts | Per-theme via tokens (WCAG 1.4.3) |

## 2. Architecture

```
globals.css
  ├─ imports tokens.css          # semantic primitives + 3 theme palettes
  ├─ imports theme-remaps.css    # legacy utility -> token map (GENERATED) + primitives
  ├─ @tailwind base/components/utilities
  └─ base layer                  # body, cards, scrollbar
```

**Key mechanism:** components keep their existing Tailwind class names. The remap
layer (91 + 13 rules, selectors prefixed `html` to outrank `@tailwind utilities`)
points every legacy purple/blue/amber utility at CSS variables. Theme switching
therefore re-skins the whole app with **zero per-component work**. New pages
should prefer `brand-*`-style token classes (`btn-primary`, `btn-secondary`,
`btn-warm`, `ek-card`) and semantic tokens directly.

### Tokens (frontend/src/styles/tokens.css)

- **Brand** `--ek-moss-050…950` — deep moss/forest identity.
- **Warm accent** `--ek-ember-300…600` — the one orange, softened; emphasis,
  learning actions, selected states. Never warnings, never large fills.
- **Status** `--ek-ok/warn/danger/info` — themed variants for contrast.
- **Surfaces** `--bg-primary/secondary/card/card-hover`, `--border-color/strong`.
- **Text** `--text-primary/secondary/muted`.
- **Focus** `--focus-ring` (per theme).
- **Shape/motion** `--ek-radius-sm/md/lg`, `--ek-shadow-1/2`, `--ek-speed`.

### Themes (set via `data-theme` on `<html>`)

| Theme | Look | Notes |
| --- | --- | --- |
| `dark` (default) | deep moss gradient, light moss text | calm, premium, low glare |
| `light` | paper white + moss-050 wash | dark moss text, WCAG-checked |
| `calm` | flat low-stimulation surfaces | softer contrast (still ≥4.5:1 body), 106% base type, pairs with `body.calm-mode` (motion ~0, gradients flattened, shadows off) |

Settings wiring (`/dashboard/settings` → Appearance): **Light Theme** and
**Calm Mode** toggles; precedence Calm > Light > Dark; persisted in
`localStorage['elekeza-settings']` exactly as before (no schema change).

## 3. Age 7–16 & cognitive-accessibility alignment

- Single hue family (moss) + one warm accent → less chromatic noise than the
  purple/indigo/fuchsia mix.
- Calm theme + calm-mode is the low-sensory configuration (autism-friendly
  reduced stimulation; predictable, flat surfaces; still motion).
- All meaning continues to be carried by text/icons, never color alone
  (status pills keep labels; mastery keeps icons).
- Focus ring is token-driven and visible on every interactive element in all
  themes.
- Larger typography in calm mode (one `font-size` knob scales the whole UI).

## 4. Evidence (2026-09-17)

- Production build `npm run build` (webpack) — PASS, 55/55 pages.
- Live preview (production `next start`, :3000):
  - login CTA gradient `linear-gradient(to right, rgb(47,107,74), …)` — moss, was blue→purple.
  - body background `160deg rgb(13,26,18)…` — deep moss (was purple `#0F0A2E`).
  - `--p600 = #2f6b4a`, `--accent = #3d8a5f`, `--warm-accent = #e8935a`.
  - learner home: heading `rgb(140,199,162)` moss-300; zero purple-family
    computed text colors detected programmatically.
  - theme switch live-verified: dark / light / calm all render (computed
    backgrounds + text captured per theme).
- Frontend gates after changes: tsc 0 errors · eslint 0 errors (28 warnings,
  pre-existing) · vitest 17/17 · build PASS.

## 5. Migration path (incremental, no big-bang rewrite)

1. Remaps keep every existing page correct today.
2. When touching a page, replace legacy purple classes with token utilities.
3. Component-level consolidation (one Button, one Card, one Input) is the
   Phase-5 UX refinement — the primitives above are their target CSS.
4. Regenerate the remap inventory if new legacy color utilities appear
   (grep `(purple|indigo|violet|fuchsia|orange|amber|rose|pink|blue|sky|cyan)-\d+`).
