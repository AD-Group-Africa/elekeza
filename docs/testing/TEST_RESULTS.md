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
