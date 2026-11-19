# ELEKEZA — RELEASE CHECKLIST

**Target:** launch before 1 December 2026
**Baseline audited:** 2026-11-19 · `sprint-3-safe-config` @ `47d17f5` + uncommitted work
**Rule:** a gate is passed only with **evidence attached**. Code existing is not evidence.

---

## Gate 1 — Source consolidation ❌ BLOCKED

- [x] Canonical repository identified: `AD-Group-Africa/elekeza` (only Elekeza repo; 0 forks)
- [x] Duplicate repositories ruled out (no second repo; `Elekeza-iyann-review` is a worktree)
- [x] Divergence measured: `sprint-3` vs `pilot` = **1 vs 25** commits
- [x] Merge simulated: **exactly 1 conflict** (guardian communication page, modify/delete)
- [ ] 42 uncommitted paths committed — **OWNER ACTION**
- [ ] `feat/elekeza-pilot-completion` merged
- [ ] 2 `origin/staging`-only commits reconciled
- [ ] `main` = consolidated head; GitHub default branch changed from `staging` — **OWNER APPROVAL**
- [ ] Exactly 3 permanent branches (`main`, `develop`, `staging`); others classified

**Evidence:** `docs/REPOSITORY_CONSOLIDATION_REPORT.md`

---

## Gate 2 — Backend ✅ PASS (on the current tree)

- [x] Production build: `./gradlew bootJar` → BUILD SUCCESSFUL (21 s)
- [x] Tests: `./gradlew test` → **397 / 397 pass, 0 failures, 0 skipped** (59 classes, 9 m 07 s)
- [x] Migrations V1–V21 present; applied in test profile
- [x] Authentication: five roles; JWT token-type test added
- [x] Authorization: role + cross-school isolation covered by tests
- [x] Guardian→learner lifecycle covered (`GuardianDeadlineLinkLifecycleTest`)
- [x] Prod profile: `ddl-auto=validate`, `JWT_SECRET` required, demo seed off by default
- [ ] PostgreSQL 16 migration run re-verified (suite uses H2) — **GAP**

**Re-run required after the merge** (Gate 1).

---

## Gate 3 — AI service ⚠️ PARTIAL

- [x] Tests: **603 pass / 58 deselected** (2 m 13 s) with server booted as CI does
- [x] `/health` → `{"status":"ok"}` HTTP 200
- [x] 4 providers + per-stage model map; 4 endpoint modules
- [x] Internal-key auth enforced (tests cover 401 on missing/wrong key)
- [x] Safety/validation: 31 edge-case tests pass (422 contracts)
- [ ] **Real-provider test (`-m live_full`) — NOT RUN, no API key** — BLOCKED
- [ ] Langfuse observability: logs contradict themselves (disabled vs connected) — **fix logging**
- [ ] Backend→AI connectivity verified on a live stack — **NOT RUN**

**A model integration may not be called operational until `live_full` passes.**

---

## Gate 4 — Frontend ⚠️ PARTIAL

- [x] Production build: `npm run build` → exit 0, 61 routes, PWA `sw.js`
- [x] Typecheck: `tsc --noEmit` → exit 0
- [x] Unit tests: **34 / 34 pass**
- [ ] **Lint: 17 errors** → CI red — **BLOCKER**
- [ ] E2E / Playwright — **NOT RUN this session**
- [ ] Five-role verification against a hosted stack — **NOT RUN**
- [ ] Fake/fabricated metrics audit — spot-checked only (`frontend/src` search for hardcoded/mock data found 1 benign comment); **full page-by-page review not done**

---

## Gate 5 — Database ⚠️ PARTIAL

- [x] 21 migrations present and consistent
- [x] Schema integrity exercised by backend tests (H2)
- [ ] PostgreSQL 16 rehearsal — **NOT RUN**
- [ ] Backup + restore drill executed — **NOT RUN** (scripts and dumps exist)
- [ ] Production DB provisioned — **BLOCKED (infrastructure)**

---

## Gate 6 — Integrations ❌ NOT READY

- [x] Register produced and classified: `docs/integrations/INTEGRATION_REGISTER.md`
- [x] Adapters exist: M-Pesa, Africa's Talking SMS, SMTP email, Cloudflare R2, Groq
- [ ] Any credential provisioned — **BLOCKED**
- [ ] Any provider exercised end-to-end — **NONE**
- [ ] Sentry on backend and AI — **NOT IMPLEMENTED** (frontend only)
- [ ] SMS/USSD/WhatsApp scope confirmed with owner — **DECISION**

**Launch on mocks only with explicit disclosure** (no SMS delivered, no reset email).

---

## Gate 7 — Deployment ❌ NOT READY

- [x] Dockerfiles for all three services
- [x] `render.yaml` created (backend + AI, `sync: false` secrets, health checks)
- [x] `netlify.toml` present
- [x] Deployment guide + env register written
- [ ] Anything deployed — **NOTHING**
- [ ] Remote health checks passing — **N/A**
- [ ] Rollback rehearsed — **N/A**
- [ ] Owner approval to deploy — **REQUIRED**

---

## Gate 8 — Android ⚠️ PARTIAL

- [x] Capacitor project present, `appId com.elekeza.app`, `webDir out`
- [x] APKs on disk (debug 2026-07-17, release 2026-07-30)
- [x] Keystore present **and correctly untracked/gitignored**
- [ ] APK is a **WebView wrapper** (no native Kotlin) — document, don't overstate
- [ ] Signing configuration — **absent** in `app/build.gradle`
- [ ] Fresh build from current code — **NOT RUN**
- [ ] Device install + smoke test — **NOT RUN**
- [ ] Play Store readiness — **NOT CLAIMED** (needs signing, policy, listing)

---

## Gate 9 — Security ⚠️ MOSTLY PASS

- [x] No committed secrets (scan for `sk-`, `gsk_`, `AKIA`, `xox[baprs]-`, private keys → **0 hits**)
- [x] No tracked `.env` files; only `.env.example`
- [x] No tracked logs or build artefacts
- [x] Keystore gitignored
- [x] CSRF enforced (`X-XSRF-TOKEN`); foreign-origin requests rejected (covered by tests)
- [x] Demo seed disabled by default in prod
- [ ] Backend/AI error reporting absent — **operational risk**
- [ ] Dependency vulnerability scan — **NOT RUN**
- [ ] Branch protection / secret scanning on GitHub — **NOT ENABLED**

---

## Gate 10 — Release ❌ NOT REACHED

- [x] Audit deliverable set produced
- [x] `CHANGELOG.md`, `RELEASE_CHECKLIST.md`, readiness report
- [ ] Consolidated `main` verified
- [ ] `v0.2.0-launch` tag + GitHub Release
- [ ] Final acceptance report against a **deployed** stack
- [ ] Operational runbook signed off

---

## Summary

| Gate | Status |
|---|---|
| 1 Source consolidation | ❌ Blocked (owner action) |
| 2 Backend | ✅ Pass on current tree |
| 3 AI | ⚠️ 603 pass, no live provider |
| 4 Frontend | ⚠️ Build/typecheck/tests pass, lint red |
| 5 Database | ⚠️ Migrations present, PG16 unverified |
| 6 Integrations | ❌ None operational |
| 7 Deployment | ❌ Nothing deployed |
| 8 Android | ⚠️ Wrapper only, unsigned |
| 9 Security | ⚠️ Clean, but no monitoring |
| 10 Release | ❌ Not reached |

**2 gates pass, 4 partial, 4 blocked. Gate 1 is the critical path: nothing else can close until the branches are joined.**
