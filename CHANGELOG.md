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
