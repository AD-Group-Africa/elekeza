# Changelog

All notable changes to Elekeza are recorded here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versioning follows [SemVer](https://semver.org/).

---

## [Unreleased] — consolidation & launch readiness (2026-11-19)

### Added
- `render.yaml` — Render Blueprint for `elekeza-backend` and `elekeza-ai`: Docker runtime, health checks (`/actuator/health`, `/health`), `autoDeploy: false`, and every secret declared `sync: false` so no credential enters the repository.
- `docs/REPOSITORY_DISCOVERY_REPORT.md` — canonical-repository determination with local and GitHub evidence.
- `docs/REPOSITORY_CONSOLIDATION_REPORT.md` — measured merge plan (1 conflict, 379 files) and branch classification.
- `docs/integrations/INTEGRATION_REGISTER.md` — 14 integrations classified by implementation and credential state.
- `docs/deployment/DEPLOYMENT_GUIDE.md`, `docs/deployment/ENVIRONMENT_VARIABLES.md`.
- `docs/testing/TEST_RESULTS.md` — re-established baseline from executed runs.
- `RELEASE_CHECKLIST.md`, `FINAL_LAUNCH_READINESS_REPORT.md`, `ELEKEZA_QUICK_STATUS.md`, `ELEKEZA_PRODUCT_MEETING_BRIEF.md`.
- `artifacts/audit-2026-11-19/` — raw build and test logs backing every reported figure.

### Changed
- `docs/ARCHITECTURE.md` — appended the 2026-11-19 consolidation section (topology, module map, deviations from the proposed `apps/` layout).

### Verified (no code change)
- Backend: `./gradlew test` → **397/397 pass**; `bootJar` → BUILD SUCCESSFUL.
- Frontend: `tsc --noEmit` → pass; Vitest **34/34**; `npm run build` → exit 0 (Next 16.3.3, PWA service worker emitted).
- AI service: **603 pass / 58 deselected** with uvicorn booted and `INTERNAL_SECRET` pinned.

### Known issues (open)
- Frontend ESLint fails with **17 errors** (10 × `no-explicit-any`, 5 × unescaped entity, 1 × `set-state-in-effect`, 1 × `<a>`-for-internal-navigation) — CI gate is red.
- GitHub default branch is `staging`, which holds 2 commits found nowhere else and lacks the main line's history.
- `main` is the June 2026 MVP commit; local `main`/`develop`/`staging` are all stale against their remotes.
- 42 uncommitted paths (privacy/consent module, V20/V21 migrations) exist on one disk only.
- Backend and AI service have no error reporting; `SENTRY_DSN_BACKEND` is inert without an SDK.
- AI `live_full` matrix never executed against a real provider.
- AI test suite is environment-coupled: reports 31 false 401 failures if run without the live server/matching secret.

### Not done deliberately
- No branch deleted, no history rewritten, no force-push, no remote mutation, no production deployment, no secret read or printed.

---

## [0.1.0] — 2026-11-15

### Merged
- PR #9 — integrated PR #7 (themes, role guard, account theme sync) onto `feat/elekeza-pilot-completion`.
- PR #8 — frontend revamp with readable colours and working learner gamification.
- PR #7 — frontend pilot integration from `Iyann`.

### Added
- Frontend feature-folder architecture, `lib/api` client with typed errors, design tokens, role-based navigation, PWA service worker.
- Backend sprint 3 regressions closed; guardian messaging made accessible and delivery verified.
- CI: backend JAR built for E2E; AI tests given dummy-provider env.

---

## [0.1.0-pilot] — 2026-10-09 (tag `v0.1.0-pilot`, `v0.1.0-pilot-r2`)

### Added
- Payment security sprint 2 (M-Pesa callback verification hardened; `V18__payment_integrity.sql`).
- Governance audit: suspended-account bypass and cross-tenant analytics leak closed.
- Exhibition assets and brand polish; purple-primary theme.
- Two-way guardian↔teacher messaging with tenant isolation (EL-NEW-02).
- Deadline county scoping groundwork; privacy consent/erasure groundwork.

---

## [0.1.0-mvp] — 2026-06-17 (`21512cb`, currently `main`)

### Added
- Initial MVP: authentication, learner content, quizzes, progress, role scaffolding.

---

> Historical note: the `main` branch has not been updated since the MVP commit. Between June and November 2026 all work landed on feature, audit, release and `sprint-*` branches. Consolidating that history is the subject of `docs/REPOSITORY_CONSOLIDATION_REPORT.md`.

---

## [Unreleased] — consolidation executed (2026-11-19)

### Added
- Consolidated head `302d32e`: sprint-3 backend (privacy module, county-scoped deadlines,
  V20/V21, auth hardening) merged with the 15-November frontend revamp.
- `render.yaml` JAVA_OPTS for the starter plan (heap raised from 400 MB to 1200 MB).
- `frontend/netlify.toml`: Node 20, service-worker no-cache, baseline security headers.

### Changed
- `main`, `develop`, `staging` now all point at `302d32e` **locally** (remotes untouched).
- Old tips preserved: `backup/main-mvp-21512cb`, `backup/staging-orphan-3d8c738`,
  `backup/develop-pre-consolidation`.
- Retired the parallel frontend shell (`Sidebar`, `SidebarLayout`, `navConfig`,
  `appShell.test`, 5 section layouts) in favour of `AppShell` + `config/navigation`.

### Fixed
- Frontend lint: stale `eslint-disable` for a rule removed in eslint-config-next 16.x.

### Verified
- Backend: 410/410 tests, bootJar OK. Frontend: tsc 0, eslint 0, vitest 84/84.
- Flyway: 21/21 migrations on PostgreSQL **16.16**. AI: 3/3 live Groq smoke tests.
- `DemoSeedGuard` refused to boot prod with demo seeding enabled (correct).

### Blocked at time of writing
- Frontend production build and the full AI suite could not run post-merge:
  the C: drive reached 0 bytes free (`ENOSPC`). Re-run after freeing space.

### Discovery
- `origin/staging` is a **2-commit orphan history with no shared ancestor** (snapshot import,
  1,077 files). Preserved as a patch, file manifest and Git bundle under
  `backups/consolidation-2026-11-19/`.

## [Unreleased] — 2026-11-19 (final verification)

### Fixed
- **Security:** upgraded `next` `^16.4.2` → `^16.4.6` and `@netlify/plugin-nextjs` `^5.15.12` → `^5.16.8`
  to meet Netlify's November 2026 advisory minimums (`next` 16.4.5+, adapter 5.16.6+). Full frontend
  regression re-run on the patched stack: tsc 0, eslint 0, 84/84 tests, production build exit 0.

### Added
- `docs/archive/from-staging-orphan-2026-11-19/` — the 8 files unique to the `origin/staging` orphan
  (AI strategy, cost model, financial model, decimal migration, 3 reliability runbooks, 1 abandoned
  pipeline module) with a provenance README.
- `docs/deployment/PR_MIGRATION_PLAN.md` — safe, reviewable path from the orphan/stale remotes to a
  single promoted history, with a damage-free option for the `staging` pointer.
- `FINAL_RELEASE_GATE_REPORT.md` — green / blocked-on-credentials / blocked-on-approval / not-verified.
- `docs/deployment/DEPLOYMENT_GUIDE.md` — Netlify/Render validation, per-layer rollback, minimum env.

### Verified
- AI suite on the merged tree: **603 passed, 0 failed** (`artifacts/audit-2026-11-19/final-ai-suite2.log`).
- `bootJar` BUILD SUCCESSFUL (exit 0) on the merged tree.
- Production frontend build: **exit 0**, 60/60 static pages, on Next 16.4.6.
- Disk recovered 0 → 2.6 GB free using caches only; no source, database, backup or user file deleted.
