# ELEKEZA — CHANGELOG

> Canonical release history. Root `CHANGELOG.md` merged here 2026-10-03.

## [0.1.0-pilot-r3-closure] — 2026-10-03 (this closure session, branch `integration/staging-reconciliation`)

### Added
- `docs/` canonical documentation set (15 files): ELEKEZA_MASTER, PRODUCT, ARCHITECTURE,
  DOMAIN_MODEL, API, SECURITY, AI_ARCHITECTURE, INTEGRATIONS, UX_AND_DESIGN_SYSTEM, ACCESSIBILITY,
  TESTING, DEPLOYMENT, PRODUCTION_READINESS, PILOT, CHANGELOG — synthesized from 116 legacy
  documents; superseded material moved to `docs/archive/`.
- UX closure: **Elekeza Assist** bottom-left floating assistant (accessible, collapsible, safe-area
  aware, reduced-motion, never auto-opens, never pretends to be human); mobile bottom navigation;
  back-button audit fixes; guardian “Today” home polish; design-token colour consolidation.
- Accessibility closure pass: keyboard/focus/responsive verification grid 320–1440.

### Fixed (2026-10-03 production-completion closure)
- **P0 security:** ai-elewa `INTERNAL_SECRET` fail-open → fail-closed (`bool(INTERNAL_SECRET) and
  compare_digest`); live-verified both directions (unset → 401 on all endpoints incl. `/docs`;
  valid key → passes). Backend `RealAiClient`/`AiWebClientConfig` `:dev-secret` fallbacks removed
  (boot fail-fast). AI pytest 606 passed; backend 278/278.
- `test_live_smoke.py` hardcoded `:8000` → `AI_TEST_BASE_URL` env (EL-F-AIport class); live smoke 3/3.
- Elekeza Assist intercepted the desktop sidebar **Logout** button (E2E-caught): Assist now anchors
  to the content column (sidebar-width aware), restyled onto canonical design tokens with an opaque
  panel surface; mobile `left-4` inset restored. All 5 journeys + Playwright spec suite green.
- Production build re-verified (59/59 pages); tsc clean; vitest 17/17.

### Fixed (this engagement, prior fix loop — retained)
- Learner login credentials surfaced after CSV import (learner logins panel in import UI).
- Staff temp password shown exactly once (create response only).
- Lesson TTS gate (`serverTts` prop), attendance contrast tokens, quiz copy, teacher assignment
  dropdowns + toast, AI edge-case test base URL env.

### Known open (honest)
- AI r3 release authorization to ship the (now fixed + verified) fail-closed auth fix.
- EL-NEW-02: guardian/teacher messages stored sender-only.
- EL-F-007: class creation (seed-only classes) — scope decision pending.

## [0.1.0-pilot-r2] — 2026-09-03 (tag `v0.1.0-pilot-r2`, commit b139b8e)
- fix(ai): reconcile Groq model IDs with live catalog.
- Evidence pack: `release-evidence/` (8 docs, screenshots, recordings), `e2e-evidence/`
  (78 screenshots, 6 videos, logs, DB verifications), system map, runbook, integration matrix,
  pilot decision, closure audit (TASK 11 gate GREEN).

## [0.1.0-pilot] — 2026-09 (tag `v0.1.0-pilot`, commit b2da56e)
- chore(release): prepare ai-elewa v0.1.0-pilot.
- feat(ai): provider-guaranteed Stage 2 JSON + explicit completion bound (Gate 3);
  system-owned adaptive directive (Gate 2); deterministic directive engine (Gate 1).

## Earlier milestones (condensed from git history + docs)
- Personalization engine (sourced preferences, deterministic adaptation, adaptation cache V7,
  safety validation, teacher/guardian summaries) — 108/108 tests at the time.
- Security hardening: cross-tenant IDOR fixes (roster read + import), upload path-traversal fix,
  quiz duplicate-submission score-inflation fix, M-Pesa callback state machine + idempotency
  (6 chain tests), login rate-limiter interval refill, CSRF on browser write-flows, `/auth/me`
  institutionId, duplicate-registration 409, CSP frame-ancestors + no-referrer headers.
- Institution/CSV import alignment (8-column template, guardian relationships, one-time
  credentials), staff management, attendance (V10), finance/fees (V11), exam “Coming Soon”
  placeholders, PWA offline caching, moss-token design layer, demo-seed gating (DEMO_SEED_ENABLED).
