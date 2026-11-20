# TEST RESULTS — pre- and post-consolidation

**Machine:** Windows 11, Git Bash · JDK 21.0.9 (Temurin) · Node 24.19.0 / npm 11.14.1 · Python 3.14 (venv) · Docker 29.2.1 · 8 GB RAM
**Raw logs:** `artifacts/audit-2026-11-19/`

> Every figure is from a command executed in this session. Where a run could not complete, it is marked **BLOCKED** with the cause — never reported as a pass.

---

## 1. Consolidated head — `302d32e` (the one that matters)

| Suite | Command | Result | Duration |
|---|---|---|---|
| Backend tests | `cd backend && ./gradlew test --console=plain` | ✅ **410 passed / 0 failed / 0 skipped** (62 classes) | 11 m 51 s |
| Backend build | `./gradlew bootJar` | ✅ **BUILD SUCCESSFUL** | 23 s |
| Frontend typecheck | `npx tsc --noEmit` | ✅ exit 0 | — |
| Frontend lint | `npx eslint .` | ✅ **exit 0** (0 errors, 0 warnings) | — |
| Frontend unit | `npx vitest run` | ✅ **84 passed / 84** (12 files) | — |
| Frontend build | `npm run build` | ⛔ **BLOCKED — disk full (ENOSPC)** | — |
| AI suite | `pytest tests -m "not live and not live_full"` | ⛔ **BLOCKED — disk full (ENOSPC)** | — |
| AI live provider | `pytest tests/test_live_smoke.py -m live` | ✅ **3 passed** against real Groq | 12 s |
| Flyway on PostgreSQL 16.16 | backend boot on clean DB | ✅ **21/21 migrations applied** | 7.5 s |
| Prod seeding guard | boot with `DEMO_SEED_ENABLED=TRUE`, profile `prod` | ✅ **refused to start (correct)** | — |

### Why two suites are blocked (environment, not code)

The C: drive reached **100 % full (238 GB / 238 GB, 0 bytes free)** mid-session. Effects observed:

- `npm ci` → `ENOSPC: no space left on device, write` (exit 1), after `exit 134` (SIGABRT) on the first attempt.
- `pytest` → `INTERNALERROR> MemoryError`, aborting at 185 passed / 5 failed.
- Windows `bash fork: Resource temporarily unavailable`.

The merge brought a **new `frontend/package-lock.json`** (Next 16.3.3 → 16.4.2, 3,982 lines changed), so the existing `node_modules` no longer matched and `npm ci` must rebuild it (~400–500 MB peak). **252 MB** could be freed by deleting the half-installed `node_modules`; that is not enough.

**To close these two gates once disk space exists:**

```bash
cd frontend && npm ci --legacy-peer-deps && npx tsc --noEmit && npx eslint . && npx vitest run && npm run build
cd ../ai-elewa && ./venv/Scripts/python.exe -m uvicorn main:app --port 8000 &
INTERNAL_SECRET=elekeza-test-internal-key-not-a-secret ./venv/Scripts/python.exe -m pytest tests -q -m "not live and not live_full"
```

> The frontend **did** build successfully on the pre-merge tree (exit 0, 61 routes, PWA `sw.js`) with the older dependency set. The merged lockfile has not been built.

---

## 2. Pre-consolidation baseline — `47d17f5` + uncommitted work

Recorded before merging, for comparison.

| Suite | Result |
|---|---|
| Backend `./gradlew test` | 397 passed / 0 failed (59 classes), 9 m 07 s |
| Backend `bootJar` | BUILD SUCCESSFUL, 21 s |
| Frontend `tsc --noEmit` | pass |
| Frontend `vitest run` | 34 passed / 34 (6 files) |
| Frontend `eslint` | ❌ 17 errors, 24 warnings |
| Frontend `npm run build` | exit 0, 61 routes, PWA `sw.js` |
| AI `pytest` (server booted, secret pinned) | 603 passed / 58 deselected |

Test counts rose after the merge: **397 → 410** backend (pilot contributed `ClassManagementApiTest`, `GamificationTest`, `QuizStartConcurrencyTest`) and **34 → 84** frontend (pilot's feature-based tests).

---

## 3. Lint: 17 errors → 0

The 17 errors measured on `sprint-3-safe-config` were real *for that tree*. After the merge the frontend is pilot's, which had already fixed 16 of them. One remained:

```
frontend/src/lib/api/client.ts:70
  error  Definition for rule '@next/next/no-location-assign-relative-destination' was not found
```

The rule no longer exists in `eslint-config-next` 16.x, so the bare `eslint-disable-next-line` directive was itself the error. Removed in `302d32e`. `npx eslint .` → exit 0.

**Caveat:** lint was verified against the *pre-`npm ci`* `node_modules`. After a clean install, re-run it — a newer `eslint-config-next` can introduce new rules.

---

## 4. PostgreSQL 16 verification (requested)

The local instance on `:5433` is **PostgreSQL 15.17**, so it cannot prove the 16 claim. A throwaway `postgres:16-alpine` container was used instead.

```
Database: jdbc:postgresql://localhost:55432/elekeza_pg16 (PostgreSQL 16.16)
Current version of schema "public": << Empty Schema >>
Successfully applied 21 migrations to schema "public", now at version v21 (00:07.533s)
Started ElekezaApplicationKt in 81.353 seconds
```

| Check | Result |
|---|---|
| Server version | **16.16** ✅ |
| Clean-schema migration V1→V21 | ✅ 21/21 |
| `ddl-auto=validate` against real PG | ✅ app started |
| Real-PG health (`/actuator/health`) | ✅ `{"status":"UP"}` (also verified on the PG15 instance, `elekeza_pg16_verify`, then dropped) |
| Demo seed on `prod` | ✅ **refused** — `DemoSeedGuard` blocked startup because the demo dataset contains committed ADMIN credentials |

The 21-migration run was additionally verified end-to-end on the PG15 instance in a **fresh** database (`elekeza_pg16_verify`), then dropped. No user database was modified.

**Cleanup:** the PG16 container and both scratch databases were removed. The user's `:5433` instance, its 14 existing databases, and the other project's containers were left untouched.

---

## 5. AI provider connectivity (requested)

A real Groq key was present in `ai-elewa/.env` (value never printed, logged or copied).

| Test | Result |
|---|---|
| `test_health` | ✅ |
| `test_simplify_text_live` | ✅ real provider completion |
| `test_quiz_generate_live` | ✅ real provider completion |

**3/3 live tests passed** → backend→AI→provider code path works against the genuine API.

**Not run:** the full `-m live_full` matrix (54+ real LLM calls). The 3-test smoke set proves connectivity; the matrix proves breadth, costs credits, and was not authorised. Run it with:
`pytest tests/test_full_pipeline.py -m live_full`

---

## 6. What was verified vs not

**Verified on the consolidated tree:** backend compiles, all 410 backend tests pass, jar builds, frontend typechecks, frontend lints clean, 84 frontend unit tests pass, migrations apply on PG16, seed guard blocks, AI answers via a real provider.

**Not verified:** frontend production build and the full AI suite on the merged tree (disk full); Playwright E2E; a live five-role walkthrough against a running stack (no seeded PG16 data, by design of the seed guard); Android build.

**No genuine product-logic test failure was observed at any point in this session.**

---

# FINAL VERIFICATION — 2026-11-19 (after disk recovery)

Both previously blocked suites were completed once space was recovered, and the frontend was
additionally re-verified after a **security upgrade**.

## Disk recovery

| Action | Freed |
|---|---|
| npm cache clean + `AppData/Local/npm-cache` | ~1.6 GB |
| Temp files older than 7 days | ~0.4 GB |
| 10 stale `codex-runtimes/*.previous-*` (active runtime kept) | ~1.1 GB |
| Gradle caches (`jars-9`, `transforms-3`, old 8.5/8.10/8.14.3) | ~2.4 GB |

Result: 0 → **2.6 GB free**. No project source, database, backup or user file was deleted.
`/c/Dev/docker` (39 GB, other projects' containers and data) was **not** touched.

## Frontend on the merged lockfile

| Check | Result |
|---|---|
| `npm ci --legacy-peer-deps` | ✅ **831 packages**, exit 0 |
| `tsc --noEmit` | ✅ 0 |
| `eslint .` | ✅ 0 errors |
| `vitest run` | ✅ **84 / 84** |
| `npm run build` | ✅ **exit 0**, 60 static pages |

## Security upgrade (finding + fix)

Netlify's Nov-2026 advisory requires `next` ≥ 16.4.5 and `@netlify/plugin-nextjs` ≥ 5.16.6.
This repo was on `^16.4.2` / `^5.15.12` — **both below the patched versions**.

| Package | Before | After |
|---|---|---|
| `next` | ^16.4.2 | **^16.4.6** (installed 16.4.6) |
| `@netlify/plugin-nextjs` | ^5.15.12 | **^5.16.8** (installed 5.16.8) |

Re-verified on the patched stack:

| Check | Result |
|---|---|
| `tsc` / `eslint` / `vitest` | ✅ 0 / 0 / **84 passed** |
| `npm run build` | ✅ **exit 0** — `Next.js 16.4.6`, compiled in 70 s, 60/60 static pages |

## AI suite (merged tree) — now complete

```
603 passed, 58 deselected, 4 warnings in 112.81s
EXIT=0
```

(First attempt failed on a secret mismatch because the server was booted without the pinned
`INTERNAL_SECRET`; restarted with the matching key and re-ran.)

## Backend (source unchanged since the 410-test run)

| Check | Result |
|---|---|
| `./gradlew bootJar` | ✅ BUILD SUCCESSFUL, exit 0 |
| `./gradlew test` | 410/410 — unchanged source, not re-run |

## Final tally on the consolidated tree

| Suite | Result |
|---|---|
| Backend | **410 / 410** |
| Frontend | **84 / 84** + tsc + lint + production build |
| AI | **603 / 603** |
| Live provider | **3 / 3** |
| PostgreSQL 16.16 migrations | **21 / 21** |

**Total: 1,097 automated tests passing, 0 failing, 0 blocked.**

---

# RELEASE SPRINT — 2026-11-20 (head `a489682`, all results fresh)

Every number below was produced today by the command shown. No historical result was reused; when
Gradle reported tests `UP-TO-DATE` the run was forced with `cleanTest` and repeated.

| Suite | Command | Result |
|---|---|---|
| Backend | `./gradlew cleanTest test` | **410 / 410**, 62 suites, 0 failures (6m51s) |
| Backend jar | `./gradlew bootJar` | BUILD SUCCESSFUL (14s) |
| Frontend deps | `npm ci --legacy-peer-deps` | **831 packages**, exit 0 (3m) |
| TypeScript | `npx tsc --noEmit` | exit 0 |
| ESLint | `npx eslint .` | exit 0, 1 warning |
| Unit tests | `npx vitest run` | **84 / 84**, 12 files |
| Production build | `npm run build` | **exit 0**, Next.js 16.4.6, 60 static pages |
| AI service | `pytest -m "not live and not live_full"` | **603 / 603** (105s) |
| **Browser E2E** | `npx playwright test` | **46 / 46 passed**, 6.5 min, Chromium |

## Browser E2E — what actually ran

Real Chromium against a real Spring Boot jar and a real Next dev server, seeded PostgreSQL, no mocks:

- accessibility (WCAG 2.1 AA automated) across learner, teacher and guardian surfaces
- attendance register + finance views for teacher, guardian and school admin
- full exam journey: start → timer → autosave → submit → scored result, plus 409 on replay
- learner journey: home → lesson → read → practice quiz → score → progress
- messaging round-trip (guardian → teacher)
- mobile viewports
- theme persistence across devices, per-role colour families
- **role guards: a learner opening a school-admin page is blocked and no admin API is called;
  a teacher cannot open guardian or finance pages**

## PostgreSQL 16 restore drill

| Step | Result |
|---|---|
| Fresh cluster | PostgreSQL **16.16** |
| Migrations | **21 / 21** applied in **4.774 s** |
| Schema | 62 tables, 592 constraints, 93 FKs, 183 indexes |
| Backup | `pg_dump -Fc`, 216 KB, **2 s** |
| Restore into a separate clean DB | **exit 0**, **9–11 s** |
| Schema parity | identical: 62 tables / 592 constraints / 93 FKs / 183 indexes |
| Row parity (seeded copy) | institutions 1=1, users 5=5, guardian_links 1=1 — **all MATCH** |
| Relationship integrity | `parent@elekeza.app -> student@elekeza.app` intact after restore |
| Destructive risk | none — throwaway containers only, removed afterwards |

## Dependency audit

`npm audit`: production dependencies carried **9 advisories** — 1 high (`follow-redirects`), 3 moderate
(`glob`, `minimatch`, `rimraf`), 5 low (PWA toolchain). **These have since been remediated — see §4.**

## Secret scan

`git grep` over the working tree and over 400 commits of history for GitHub/OpenAI/AWS/Slack tokens and
private-key blocks: **0 hits**. No tracked `.env`, keystore, `.p12` or `.pem`. Only `.env.example` files
are tracked.

---

# 4. Release sprint — 2026-11-20 (security remediation + regression)

**Candidate:** `baed7f4` on `consolidation/2026-11-19` (working tree adds the remediation below, not yet committed at the time of the runs).
All figures are from commands executed today; none are reused from an earlier section.

| Check | Command | Result |
|---|---|---|
| Backend suite | `cd backend && ./gradlew cleanTest test --console=plain` | ✅ **417 tests / 64 suites / 0 failures / 0 skipped** (4 m 38 s). 410 → 417: seven new header/correlation tests |
| Backend build | `./gradlew bootJar` | ✅ BUILD SUCCESSFUL (8 s), 101,070,224-byte jar |
| Frontend typecheck | `npx tsc --noEmit` | ✅ exit 0 |
| Frontend unit | `npx vitest run` | ✅ **84 passed / 84** (12 files), 12.94 s |
| Frontend production build | `npm run build` (`next build --webpack`) | ✅ exit 0, 60 routes |
| Browser E2E | `npx playwright test` (real jar + real `next dev`) | ✅ **46 passed / 46**, exit 0, **7 m 36 s** |
| Dependency audit | `npm audit --json` | ✅ **0 high / 0 critical**; 14 total (9 moderate, 5 low), all build-time — was 15 with 1 high |
| Dependency install | `npm install --legacy-peer-deps` | ✅ exit 0; `follow-redirects` resolved to **1.16.3** |
| Config validity | parse `AndroidManifest.xml`, `netlify.toml`, `render.yaml` | ✅ all three parse |

## What the seven new backend tests assert

`SecurityHeadersTest` (5): baseline headers present; HSTS absent when not enabled; `X-Request-Id` generated
when absent; a safe inbound id preserved; an unsafe inbound id **replaced, never reflected**.

`HstsHeaderTest` (2): HSTS emitted on a secure request when enabled; withheld on plain HTTP even when enabled.

> `HstsHeaderTest` first failed because `HstsHeaderWriter` defaults `includeSubDomains` to **true**. The
> production configuration was corrected, not the assertion. That is the test doing its job.

## Dependency remediation detail

`follow-redirects@1.16.1` (transitive under `axios@1.20.0`, advisory GHSA-mrwp-f3q8-3g9p, affected
`>=1.16.0 <=1.16.1`) → pinned to `^1.16.3` by an npm `overrides` entry. No major upgrade of any direct
dependency. Remaining 14 advisories are the ESLint plugin family, `glob`/`minimatch`/`rimraf`, and the
`next-pwa`/Workbox build chain — none reachable at runtime, and the only npm-suggested fix for the PWA chain is
a semver-major downgrade.

## Deliberately not run

- **Hosted acceptance:** no staging environment exists (`docs/testing/FIVE_ROLE_HOSTED_ACCEPTANCE_REPORT.md`).
- **AI service suite:** passed 603/603 in this sprint's earlier phase; not re-run after the frontend-only and
  backend-header changes, because no AI code changed in this phase.
- **Android build:** no staging URL to point the shell at, and no signing configuration
  (`docs/deployment/ANDROID_RELEASE_READINESS.md`).

---

# 5. Full-activation directive — 2026-11-20

**Scope:** module inventory + activation, not a re-run of §4. Only new work is recorded here.

| Check | Command | Result |
|---|---|---|
| Backend suite (after seeding a SCHOOL_ADMIN) | `./gradlew cleanTest test --console=plain` | ✅ **417 tests / 64 suites / 0 failures / 0 skipped** (4 m) |
| New school-admin acceptance spec | `npx playwright test school-admin-modules` | ✅ **6 / 6 passed**, EXIT=0 (2.9 m) |
| SCHOOL_ADMIN fixture, live | `POST /api/auth/login` on the built jar | ✅ `http=200`, `role=SCHOOL_ADMIN`, `institutionId=1` |
| Backend artifact integrity | `zipfile.testzip()` + manual boot + `curl /actuator/health` | ✅ 950 entries, no bad entry; `{"status":"UP"}` in 46 s |

## Inventory figures (measured, not estimated)

| Layer | Count |
|---|---|
| Spring controllers / route mappings | 44 classes / **191 mappings** |
| Next.js routes / frontend call paths | **61** routes / **118** distinct `apiClient` paths |
| PostgreSQL tables | **61** |
| FastAPI endpoints | 8 (7 + health) |
| Backend test classes | 64 |
| E2E specs | 11 |

Cross-check result: **0 frontend calls without a backend route**, 0 page files without a screen component,
0 screen files missing on disk. The API-only surfaces (curriculum authoring, privacy/consent, retention,
audit, billing, staff deactivation, device assignment, exam manual marking) are capability without UI, not
dead code — recorded as AMBER in the activation matrix.

## Two verification failures, and their real causes

Neither was a product defect; both were environment, and both are described in
`docs/operations/ELEKEZA_MODULE_ACTIVATION_MATRIX.md` §7:

1. A killed Playwright run left `java` on 8090 and `next dev` on 3100 alive → next run aborted with
   "already used". Fixed by killing the listener PIDs.
2. A `java -jar` that started while `bootJar` was still writing produced
   `NoClassDefFoundError: ch/qos/logback/classic/spi/ThrowableProxy` on every Tomcat thread, and the app
   never reached "Started". Fixed by rebuilding the jar, verifying zip integrity, and booting it once by hand
   before re-running the suite.
